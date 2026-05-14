import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { Router, ActivatedRoute } from '@angular/router';
import { NgbPaginationModule, NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ConfigService } from '../services/config.service';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { PermissionsService } from '../services/permissions.service';
import { EstadoDispositivoService, CambioEstadoDispositivoRequest } from '../services/estado-dispositivo.service';
import { AuthService } from '../services/auth.service';
import { TransferirEquipoModalComponent } from '../components/transferir-equipo-modal/transferir-equipo-modal.component';
import { forkJoin } from 'rxjs';
import { FormControl } from '@angular/forms';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TourRegistryService } from '../services/tour-registry.service';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface DeviceType {
  name: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  icon: string;
}

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbPaginationModule, NgbModule, NotificationContainerComponent],
  templateUrl: './devices.component.html',
  styleUrls: ['./devices.component.css']
})
export class DevicesComponent implements OnInit, OnDestroy {
  devices: NetworkInfoDTO[] = [];
  filteredDevices: NetworkInfoDTO[] = [];
  /**
   * Página actual ya cortada. Lo guardamos como propiedad y la actualizamos
   * desde `updatePagedDevices()` cada vez que cambia el filtro, el orden o la
   * página. Antes era un getter, lo que hacía que Angular llamara a `slice()`
   * en cada ciclo de change detection y volviera a renderizar toda la tabla.
   */
  pagedDevices: NetworkInfoDTO[] = [];
  /**
   * Configuración visual (icono, colores) ya resuelta para cada dispositivo
   * visible. Se actualiza junto con `pagedDevices`. El template lee de acá
   * directamente para no llamar a funciones costosas en cada CD.
   */
  pagedDeviceTypes: DeviceType[] = [];
  /**
   * Conteos precalculados por tipo. Antes el template llamaba a
   * `getDeviceCount(type)` 15 veces por cada ciclo de change detection y
   * cada llamada filtraba todos los dispositivos con `normalize('NFD')`.
   * Se recalcula sólo cuando cambia `devices`.
   */
  deviceCountsByType: { [type: string]: number } = { all: 0 };
  /**
   * Cache de iconos por tipo de dispositivo. `getDeviceTypeConfig` aplica
   * `toLowerCase().normalize('NFD').replace(...)` para comparar nombres y eso
   * se ejecutaba para cada fila en cada CD; ahora lo hacemos una sola vez por
   * tipo y reutilizamos el resultado.
   */
  private deviceTypeCache = new Map<string, DeviceType>();
  /**
   * Cache de permisos. Las llamadas a `permissionsService` aparecen en el
   * template (`canManageDevices`, `canManageDeviceStates`) y se evaluaban
   * múltiples veces por fila por cada CD; el resultado no cambia durante la
   * vida del componente, así que las computamos una vez.
   */
  private _canManageDevicesCache?: boolean;
  private _canManageDeviceStatesCache?: boolean;
  errorMessage: string | null = null;
  loading: boolean = true;
  
  // Variables para paginación
  page: number = 1;
  pageSize: number = 20;
  collectionSize: number = 0;

  // Filtro activo
  activeFilter: string = 'all';
  
  // Variables para ordenamiento
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Definición de tipos de dispositivos con colores e iconos
  deviceTypes: DeviceType[] = [
    { name: 'Impresora', color: '#2e7d32', backgroundColor: '#e8f5e9', borderColor: '#c8e6c9', icon: 'fa-print' },
    { name: 'Teléfono IP', color: '#1976d2', backgroundColor: '#e3f2fd', borderColor: '#bbdefb', icon: 'fa-phone' },
    { name: 'Cámaras IP', color: '#7b1fa2', backgroundColor: '#f3e5f5', borderColor: '#e1bee7', icon: 'fa-video' },
    { name: 'Plotter', color: '#f57c00', backgroundColor: '#fff3e0', borderColor: '#ffe0b2', icon: 'fa-print' },
    { name: 'Switch', color: '#1b5e20', backgroundColor: '#c8e6c9', borderColor: '#81c784', icon: 'fa-network-wired' },
    { name: 'Router', color: '#d32f2f', backgroundColor: '#ffebee', borderColor: '#ffcdd2', icon: 'fa-wifi' },
    { name: 'Reloj de Marcado', color: '#6a1b9a', backgroundColor: '#f3e5f5', borderColor: '#e1bee7', icon: 'fa-clock' },
    { name: 'Access Point WiFi', color: '#0277bd', backgroundColor: '#e1f5fe', borderColor: '#b3e5fc', icon: 'fa-wifi' },
    { name: 'Scanner', color: '#8e24aa', backgroundColor: '#f3e5f5', borderColor: '#e1bee7', icon: 'fa-camera' },
    { name: 'UPS', color: '#e65100', backgroundColor: '#fff3e0', borderColor: '#ffcc02', icon: 'fa-battery-full' },
    { name: 'Access Point', color: '#1565c0', backgroundColor: '#e3f2fd', borderColor: '#bbdefb', icon: 'fa-broadcast-tower' },
    { name: 'Reloj Biométrico', color: '#4a148c', backgroundColor: '#f3e5f5', borderColor: '#ce93d8', icon: 'fa-fingerprint' },
    { name: 'Firewall', color: '#d81b60', backgroundColor: '#fce4ec', borderColor: '#f8bbd9', icon: 'fa-shield-alt' },
    { name: 'PLCs/Scada', color: '#5d4037', backgroundColor: '#efebe9', borderColor: '#d7ccc8', icon: 'fa-microchip' }
  ];

  // Agregar propiedades
  deletingDeviceMac: string | null = null;
  changingStateDeviceMac: string | null = null;
  transferiendoDeviceMac: string | null = null;
  showConfirmDialog: boolean = false;
  deviceToDelete: any = null;
  showEstadoDialog: boolean = false;
  estadoAction: 'baja' | 'almacen' | null = null;
  deviceToChangeState: any = null;
  estadoObservaciones: string = '';

  /** Búsqueda por MAC (literal o solo hex) o por IP */
  macSearchControl = new FormControl('');
  private tourCleanup?: () => void;

  constructor(
    private networkInfoService: NetworkInfoService,
    private router: Router,
    private route: ActivatedRoute,
    private configService: ConfigService,
    private http: HttpClient,
    private notificationService: NotificationService,
    private permissionsService: PermissionsService,
    private estadoDispositivoService: EstadoDispositivoService,
    private authService: AuthService,
    private modalService: NgbModal,
    private tourRegistry: TourRegistryService
  ) {
    this.macSearchControl.valueChanges.subscribe(value => {
      this.aplicarFiltroBusqueda(value || '');
    });
  }

  ngOnInit(): void {
    this.cargarDispositivos();
    this.tourCleanup = this.tourRegistry.register('devices', [{
      id: 'devices-overview',
      title: 'Tour de dispositivos',
      icon: 'fa-route',
      beforeStart: () => this.resetScroll(),
      afterEnd: () => this.resetScroll(),
      steps: [
        { selector: '#tour-devices-title', title: 'Dispositivos de red', description: 'Periféricos y equipo activo de red excluyendo bajas y stock en almacén.', side: 'bottom' },
        { selector: '#tour-devices-filters', title: 'Tipos', description: 'Filtrá por categoría: impresoras, switches, APs, etc.', side: 'bottom' },
        { selector: '#tour-devices-search', title: 'Búsqueda', description: 'Buscá por MAC o dirección IP.', side: 'bottom' },
        {
          selector: '#tour-devices-table',
          title: 'Tabla',
          description:
            'Hacé clic en los encabezados para ordenar. Cada fila abre el detalle; con permisos, al final de la fila tenés acciones (baja, almacén, transferir, eliminar).',
          side: 'bottom'
        },
        { selector: '#tour-devices-print', title: 'PDF', description: 'Exportá el listado filtrado.', side: 'left' }
      ]
    }]);
  }

  private resetScroll(): void {
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
  }

  cargarDispositivos(): void {
    this.loading = true;
    this.errorMessage = null;
    
    forkJoin({
      dispositivos: this.networkInfoService.getNetworkInfo(),
      estadosBaja: this.estadoDispositivoService.getDispositivosEnBaja(),
      estadosAlmacen: this.estadoDispositivoService.getDispositivosEnAlmacen()
    }).subscribe({
      next: (response) => {
        if (response.dispositivos.success) {
          // Obtener dispositivos en baja y en almacén para filtrarlos
          const dispositivosEnBaja = response.estadosBaja.success ? response.estadosBaja.data : [];
          const dispositivosEnAlmacen = response.estadosAlmacen.success ? response.estadosAlmacen.data : [];
          const macsEnBaja = dispositivosEnBaja.map((d: any) => d.mac);
          const macsEnAlmacen = dispositivosEnAlmacen.map((d: any) => d.mac);
          
          // Filtrar dispositivos que NO están en baja NI en almacén
          this.devices = response.dispositivos.data.filter((device: NetworkInfoDTO) => 
            !macsEnBaja.includes(device.mac) && !macsEnAlmacen.includes(device.mac)
          );
          this.recomputeDeviceCounts();
          this.applyFilter();
          this.checkQueryParams();
        } else {
          this.errorMessage = response.dispositivos.message || 'Error al cargar los dispositivos';
          this.devices = [];
          this.filteredDevices = [];
          this.recomputeDeviceCounts();
          this.updatePagedDevices();
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al obtener los dispositivos:', error);
        this.errorMessage = 'Error al cargar los dispositivos. Por favor, intente nuevamente.';
        this.devices = [];
        this.filteredDevices = [];
        this.recomputeDeviceCounts();
        this.updatePagedDevices();
        this.loading = false;
      }
    });
  }

  // Aplicar filtro por tipo de dispositivo
  applyFilter(filter: string = 'all'): void {
    this.activeFilter = filter;
    this.page = 1; // Resetear a la primera página al cambiar filtro
    
    let dispositivosFiltrados: NetworkInfoDTO[] = [];
    
    if (filter === 'all') {
      dispositivosFiltrados = [...this.devices];
    } else {
      dispositivosFiltrados = this.devices.filter(device => {
        if (!device.type) return false;
        return device.type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
               filter.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      });
    }
    
    // Aplicar filtros de búsqueda si existen
    dispositivosFiltrados = this.aplicarFiltrosDeBusqueda(dispositivosFiltrados);
    
    this.filteredDevices = dispositivosFiltrados;
    
    // Aplicar ordenamiento si existe
    if (this.sortColumn) {
      this.applySorting();
    }

    this.updatePagedDevices();
  }

  // Método para ordenar los datos
  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.applySorting();
  }

  // Método auxiliar para aplicar el ordenamiento
  private applySorting(): void {
    if (!this.sortColumn) return;

    this.filteredDevices.sort((a, b) => {
      let valueA: any = a[this.sortColumn as keyof NetworkInfoDTO];
      let valueB: any = b[this.sortColumn as keyof NetworkInfoDTO];

      // Manejar valores nulos o undefined
      if (valueA === null || valueA === undefined) valueA = '';
      if (valueB === null || valueB === undefined) valueB = '';

      // Ordenamiento especial para direcciones IP
      if (this.sortColumn === 'ip') {
        return this.compareIPs(valueA, valueB);
      }

      // Para otras columnas, usar comparación de strings
      if (typeof valueA === 'string') valueA = valueA.toLowerCase();
      if (typeof valueB === 'string') valueB = valueB.toLowerCase();

      // Comparar valores
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

    this.updatePagedDevices();
  }

  // Método para comparar direcciones IP correctamente
  private compareIPs(ipA: string, ipB: string): number {
    // Convertir IPs a números para comparación
    const numA = this.ipToNumber(ipA);
    const numB = this.ipToNumber(ipB);
    
    // Debug: mostrar conversiones
    console.log(`Comparando IPs: ${ipA} (${numA}) vs ${ipB} (${numB})`);
    
    if (this.sortDirection === 'asc') {
      return numA - numB;
    } else {
      return numB - numA;
    }
  }

  // Método para convertir IP a número
  private ipToNumber(ip: string): number {
    if (!ip || typeof ip !== 'string') return 0;
    
    // Dividir la IP en octetos
    const octets = ip.split('.');
    if (octets.length !== 4) return 0;
    
    let result = 0;
    for (let i = 0; i < 4; i++) {
      const octet = parseInt(octets[i], 10);
      if (isNaN(octet) || octet < 0 || octet > 255) return 0;
      result = (result << 8) + octet;
    }
    
    // Debug: mostrar conversión
    console.log(`IP ${ip} convertida a número: ${result}`);
    
    return result;
  }

  /**
   * Devuelve la configuración visual (icono, colores) para un tipo de
   * dispositivo. Memoizada por tipo crudo: el template llama a esta función
   * en cada celda de cada fila y, sin cache, ejecutaba dos `normalize('NFD')`
   * más un `.find()` lineal sobre 14 tipos en cada ciclo de change detection.
   */
  getDeviceTypeConfig(type: string): DeviceType {
    const key = type ?? '';
    const cached = this.deviceTypeCache.get(key);
    if (cached) {
      return cached;
    }

    const resolved = this.resolveDeviceTypeConfig(type);
    this.deviceTypeCache.set(key, resolved);
    return resolved;
  }

  private resolveDeviceTypeConfig(type: string): DeviceType {
    if (!type) {
      return {
        name: 'Desconocido',
        color: '#6c757d',
        backgroundColor: '#f8f9fa',
        borderColor: '#dee2e6',
        icon: 'fa-question-circle'
      };
    }

    const normalizedTarget = type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const deviceType = this.deviceTypes.find(dt =>
      dt.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalizedTarget
    );

    return deviceType ?? {
      name: type,
      color: '#6c757d',
      backgroundColor: '#f8f9fa',
      borderColor: '#dee2e6',
      icon: 'fa-question-circle'
    };
  }

  // Obtener icono y color para un dispositivo
  getDeviceIcon(device: NetworkInfoDTO): { icon: string, color: string } {
    const config = this.getDeviceTypeConfig(device.type);
    return {
      icon: config.icon,
      color: config.color
    };
  }

  // Verificar si un filtro está activo
  isFilterActive(filter: string): boolean {
    return this.activeFilter === filter;
  }

  // Verificar si el usuario tiene permisos para actualizar dispositivos
  canUpdateDevices(): boolean {
    return this.permissionsService.canUpdateNetworkDevices();
  }

  // Obtener el conteo de dispositivos por tipo
  getDeviceCount(type: string): number {
    if (type === 'all') {
      return this.devices.length;
    }
    return this.devices.filter(device => {
      if (!device.type) return false;
      return device.type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
             type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }).length;
  }

  verDetallesDevice(device: NetworkInfoDTO) {
    if (device && device.mac) {
      console.log('Navegando a:', `/menu/device-details/${device.mac}`);
      this.router.navigate(['/menu/device-details', device.mac]);
    } else {
      console.error('Error: MAC address no disponible', device);
      this.errorMessage = 'No se puede ver los detalles del dispositivo: MAC address no disponible';
    }
  }

  /**
   * Recalcula `pagedDevices` y `collectionSize`. Llamar manualmente cada vez
   * que cambien `filteredDevices`, `page` o `pageSize`. Evita el getter que
   * antes corría en cada ciclo de change detection.
   *
   * También precomputa `pagedDeviceTypes`: la configuración visual de cada
   * dispositivo visible. El template lee de ahí en lugar de invocar
   * `getDeviceIcon`/`getDeviceTypeConfig` en cada binding por cada CD.
   */
  private updatePagedDevices(): void {
    this.collectionSize = this.filteredDevices.length;
    const start = (this.page - 1) * this.pageSize;
    const end = this.page * this.pageSize;
    this.pagedDevices = this.filteredDevices.slice(start, end);
    this.pagedDeviceTypes = this.pagedDevices.map(d => this.getDeviceTypeConfig(d.type));
  }

  /**
   * Recalcula el conteo de dispositivos por tipo. Sólo se llama cuando
   * cambia la lista cruda (`this.devices`). Antes el template ejecutaba 15
   * filtros con `normalize('NFD')` por cada ciclo de change detection.
   */
  private recomputeDeviceCounts(): void {
    const counts: { [type: string]: number } = { all: this.devices.length };
    for (const dt of this.deviceTypes) {
      counts[dt.name] = 0;
    }
    const normalize = (s: string): string =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const typeKeyByNormalized = new Map<string, string>();
    for (const dt of this.deviceTypes) {
      typeKeyByNormalized.set(normalize(dt.name), dt.name);
    }
    for (const device of this.devices) {
      if (!device.type) {
        continue;
      }
      const key = typeKeyByNormalized.get(normalize(device.type));
      if (key) {
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    this.deviceCountsByType = counts;
  }

  /** Handler de `(pageChange)` del componente de paginación. */
  onPageChange(newPage: number): void {
    this.page = newPage;
    this.updatePagedDevices();
  }

  /** trackBy estable: mantiene el DOM al re-renderizar la lista. */
  trackByDeviceMac(_index: number, device: NetworkInfoDTO): string {
    return device.mac ?? `${_index}`;
  }

  /** trackBy para la lista estática de tipos de dispositivo. */
  trackByTypeName(_index: number, deviceType: DeviceType): string {
    return deviceType.name;
  }

  private checkQueryParams(): void {
    this.route.queryParams.subscribe(params => {
      const filterType = params['filterType'];
      const filterValue = params['filterValue'];
      
      if (filterType && filterValue) {
        console.log('Parámetros de filtro recibidos:', { filterType, filterValue });
        this.applyFilterFromParams(filterType, filterValue);
      }
    });
  }

  private applyFilterFromParams(filterType: string, filterValue: string): void {
    if (filterType === 'dispositivos') {
      // Normalizar el valor del filtro para que coincida con los tipos de dispositivos
      const normalizedValue = this.normalizeDeviceTypeFilter(filterValue);
      console.log('Aplicando filtro normalizado:', normalizedValue);
      this.applyFilter(normalizedValue);
    }
  }

  private normalizeDeviceTypeFilter(filterValue: string): string {
    const normalizedValue = filterValue.trim();
    
    // Mapear los tipos que pueden venir del dashboard a los tipos del componente devices
    switch (normalizedValue.toLowerCase()) {
      case 'impresora':
      case 'printer':
        return 'Impresora';
      case 'teléfono ip':
      case 'telefono ip':
      case 'phone':
        return 'Teléfono IP';
      case 'cámaras ip':
      case 'camaras ip':
      case 'camera':
        return 'Cámaras IP';
      case 'plotter':
        return 'Plotter';
      case 'switch':
        return 'Switch';
      case 'router':
        return 'Router';
      case 'reloj de marcado':
      case 'clock':
        return 'Reloj de Marcado';
      case 'access point wifi':
      case 'wifi':
      case 'ap wifi':
        return 'Access Point WiFi';
      case 'scanner':
        return 'Scanner';
      case 'ups':
        return 'UPS';
      case 'access point':
      case 'ap':
        return 'Access Point';
      case 'reloj biometrico':
      case 'reloj biométrico':
      case 'biometrico':
      case 'biométrico':
        return 'Reloj Biométrico';
      case 'firewall':
        return 'Firewall';
      case 'plcs':
      case 'scada':
      case 'plcs/scada':
      case 'plc':
        return 'PLCs/Scada';
      default:
        return normalizedValue;
    }
  }

  darDeBaja(device: any): void {
    this.estadoAction = 'baja';
    this.deviceToChangeState = device;
    this.estadoObservaciones = '';
    this.showEstadoDialog = true;
  }

  enviarAAlmacen(device: any): void {
    this.estadoAction = 'almacen';
    this.deviceToChangeState = device;
    this.estadoObservaciones = '';
    this.showEstadoDialog = true;
  }

  eliminarDevice(device: any): void {
    this.deviceToDelete = device;
    this.showConfirmDialog = true;
  }

  confirmarCambioEstado(): void {
    if (!this.deviceToChangeState || !this.estadoAction) {
      return;
    }

    this.changingStateDeviceMac = this.deviceToChangeState.mac;

    const request: CambioEstadoDispositivoRequest = {
      observaciones: this.estadoObservaciones.trim(),
      usuario: this.authService.getUsuarioParaAuditoria()
    };

    const observable = this.estadoAction === 'baja' 
      ? this.estadoDispositivoService.darDeBaja(this.deviceToChangeState.mac, request)
      : this.estadoDispositivoService.enviarAAlmacen(this.deviceToChangeState.mac, request);

    observable.subscribe({
      next: (response) => {
        if (response.success) {
          // Recargar dispositivos para actualizar la lista
          this.cargarDispositivos();
          
          const accionTexto = this.estadoAction === 'baja' ? 'dado de baja' : 'enviado a almacén';
          this.notificationService.showSuccessMessage(
            `Dispositivo "${this.deviceToChangeState.name}" ${accionTexto} exitosamente.`
          );
        } else {
          throw new Error(response.message || 'Error al cambiar el estado del dispositivo');
        }
      },
      error: (error) => {
        console.error('Error al cambiar estado:', error);
        const accionTexto = this.estadoAction === 'baja' ? 'dar de baja' : 'enviar a almacén';
        
        if (error.status === 403) {
          this.notificationService.showError(
            'Sin permisos suficientes',
            `Para ${accionTexto} dispositivos necesitas rol de GM o Administrador.`
          );
        } else {
          this.notificationService.showError(
            'Error al cambiar estado',
            `No se pudo ${accionTexto} el dispositivo "${this.deviceToChangeState.name}": ${error.message || 'Error desconocido'}`
          );
        }
      },
      complete: () => {
        this.changingStateDeviceMac = null;
        this.showEstadoDialog = false;
        this.deviceToChangeState = null;
        this.estadoAction = null;
        this.estadoObservaciones = '';
      }
    });
  }

  confirmarEliminacion(): void {
    if (this.deviceToDelete) {
      this.procesarEliminacion(this.deviceToDelete);
      this.showConfirmDialog = false;
      this.deviceToDelete = null;
    }
  }

  transferirDispositivo(device: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    const modalRef = this.modalService.open(TransferirEquipoModalComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static'
    });
    modalRef.componentInstance.item = {
      ...device,
      tipo: 'DISPOSITIVO',
      name: device.name || device.mac
    };

    modalRef.result.then((transferData: any) => {
      if (transferData) {
        this.procesarTransferencia(device, transferData);
      }
    }).catch(() => {
      // Usuario canceló el modal
    });
  }

  private procesarTransferencia(device: any, transferData: any): void {
    this.transferiendoDeviceMac = device.mac;

    // Preparar datos para el backend
    const requestData: any = {
      almacenId: transferData.almacenId,
      tipoAlmacen: transferData.tipoAlmacen,
      observaciones: transferData.observaciones || '',
      usuario: this.authService.getUsuarioParaAuditoria()
    };

    if (transferData.tipoAlmacen === 'regular' || transferData.tipoAlmacen === 'laboratorio') {
      requestData.estanteria = transferData.estanteria || '';
      requestData.estante = transferData.estante || '';
      requestData.seccion = transferData.seccion != null ? transferData.seccion : '';
    }

    this.estadoDispositivoService.transferirDispositivo(device.mac, requestData).subscribe({
      next: (response) => {
        if (response.success) {
          this.cargarDispositivos();
          this.notificationService.showSuccessMessage(
            `Dispositivo transferido exitosamente.`
          );
        } else {
          throw new Error(response.message || 'Error al transferir el dispositivo');
        }
      },
      error: (error) => {
        console.error('Error al transferir dispositivo:', error);
        this.notificationService.showError(
          'Error al transferir dispositivo',
          `No se pudo transferir el dispositivo: ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        this.transferiendoDeviceMac = null;
      }
    });
  }

  private procesarEliminacion(device: any): void {
    this.deletingDeviceMac = device.mac;

    this.estadoDispositivoService.eliminarDispositivo(device.mac).subscribe({
      next: (response) => {
        if (response.success) {
          // Recargar dispositivos
          this.cargarDispositivos();
          
          this.notificationService.showSuccessMessage(
            `Dispositivo "${device.name}" eliminado exitosamente de la base de datos OCS.`
          );
        } else {
          throw new Error(response.message || 'Error al eliminar el dispositivo');
        }
      },
      error: (error) => {
        console.error('Error al eliminar dispositivo:', error);
        this.notificationService.showError(
          'Error al eliminar dispositivo',
          `No se pudo eliminar el dispositivo "${device.name}": ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        this.deletingDeviceMac = null;
      }
    });
  }

  // Métodos de permisos (memoizados: el template los invoca varias veces por
  // fila y por ciclo de change detection; el resultado no cambia en runtime).
  canManageDevices(): boolean {
    if (this._canManageDevicesCache === undefined) {
      this._canManageDevicesCache = this.permissionsService.canManageAssets();
    }
    return this._canManageDevicesCache;
  }

  canManageDeviceStates(): boolean {
    if (this._canManageDeviceStatesCache === undefined) {
      this._canManageDeviceStatesCache =
        this.permissionsService.isGM() || this.permissionsService.isAdmin();
    }
    return this._canManageDeviceStatesCache;
  }

  /** Columnas actuales de la tabla (nombre, IP, MAC, tipo, descripción [, acciones]). */
  get columnasTablaDispositivos(): number {
    return this.canManageDevices() ? 6 : 5;
  }

  // Métodos para los modales
  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.deviceToDelete = null;
  }

  cancelarCambioEstado(): void {
    this.showEstadoDialog = false;
    this.deviceToChangeState = null;
    this.estadoAction = null;
    this.estadoObservaciones = '';
  }

  getEstadoActionText(): string {
    return this.estadoAction === 'baja' ? 'dar de baja' : 'enviar a almacén';
  }

  // Métodos de filtrado
  private soloHexMac(normalizado: string): string {
    return (normalizado || '').replace(/[^a-fA-F0-9]/g, '').toLowerCase();
  }

  private aplicarFiltroBusqueda(term: string): void {
    const trimmed = (term || '').trim();
    if (!trimmed) {
      this.applyFilter();
      return;
    }
    const t = trimmed.toLowerCase();
    const termHex = this.soloHexMac(trimmed);
    const dispositivosPorTipo = this.obtenerDispositivosPorTipoActual();
    this.filteredDevices = dispositivosPorTipo.filter(device => {
      const ip = (device.ip || '').toLowerCase();
      if (ip.includes(t)) return true;
      const macLower = (device.mac || '').toLowerCase();
      if (macLower.includes(t)) return true;
      if (termHex.length >= 2) {
        const macHex = this.soloHexMac(device.mac || '');
        if (macHex.includes(termHex)) return true;
      }
      return false;
    });
    this.actualizarPaginacion();
    if (this.sortColumn) {
      this.applySorting();
    }
  }

  private obtenerDispositivosPorTipoActual(): any[] {
    if (this.activeFilter === 'all') {
      return [...this.devices];
    } else {
      return this.devices.filter(device => {
        if (!device.type) return false;
        return device.type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
               this.activeFilter.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      });
    }
  }

  private actualizarPaginacion(): void {
    this.page = 1;
    this.updatePagedDevices();
  }

  // Método para limpiar todos los filtros de búsqueda
  limpiarFiltros(): void {
    this.macSearchControl.setValue('');
    this.applyFilter();
  }

  /** Aplicado al cambiar tipo de dispositivo: respeta texto de MAC/IP en el campo de búsqueda */
  private aplicarFiltrosDeBusqueda(dispositivos: NetworkInfoDTO[]): NetworkInfoDTO[] {
    const raw = this.macSearchControl.value;
    const trimmed = (raw || '').trim();
    if (!trimmed) return [...dispositivos];

    const t = trimmed.toLowerCase();
    const termHex = this.soloHexMac(trimmed);
    return dispositivos.filter(device => {
      const ip = (device.ip || '').toLowerCase();
      if (ip.includes(t)) return true;
      const macLower = (device.mac || '').toLowerCase();
      if (macLower.includes(t)) return true;
      if (termHex.length >= 2) {
        const macHex = this.soloHexMac(device.mac || '');
        if (macHex.includes(termHex)) return true;
      }
      return false;
    });
  }

  // Método para exportar la lista filtrada a PDF
  exportarPDF(): void {
    if (this.filteredDevices.length === 0) {
      this.notificationService.showError(
        'No hay datos para exportar',
        'No hay dispositivos filtrados para exportar a PDF.'
      );
      return;
    }

    const doc = new jsPDF('landscape'); // Orientación horizontal para más espacio
    
    // Título del documento
    doc.setFontSize(18);
    doc.text('Lista de Dispositivos de Red', 14, 20);
    
    // Información del filtro aplicado
    doc.setFontSize(10);
    let filtroTexto = 'Todos los dispositivos';
    if (this.activeFilter !== 'all') {
      filtroTexto = `Filtro: ${this.activeFilter}`;
    }
    if (this.macSearchControl.value?.toString().trim()) {
      filtroTexto += ' | Búsqueda activa (MAC/IP)';
    }
    doc.text(filtroTexto, 14, 28);
    
    // Fecha de generación
    const fecha = new Date().toLocaleString('es-ES');
    doc.text(`Generado el: ${fecha}`, 14, 34);
    doc.text(`Total de dispositivos: ${this.filteredDevices.length}`, 14, 40);
    
    // Preparar datos para la tabla
    const tableData = this.filteredDevices.map(device => [
      device.name || 'N/A',
      device.ip || 'N/A',
      device.mac || 'N/A',
      device.type || 'N/A',
      device.description || 'N/A'
    ]);
    
    // Crear la tabla
    autoTable(doc, {
      head: [['Nombre de Red', 'IP', 'MAC', 'Tipo', 'Descripción']],
      body: tableData,
      startY: 46,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 46, left: 14, right: 14 },
      tableWidth: 'auto'
    });
    
    // Guardar el PDF
    const nombreArchivo = `dispositivos_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(nombreArchivo);
    
    this.notificationService.showSuccessMessage(
      `PDF exportado exitosamente: ${nombreArchivo}`
    );
  }

} 