import { Component, OnInit } from '@angular/core';
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
import { TransferirEquipoModalComponent } from '../components/transferir-equipo-modal/transferir-equipo-modal.component';
import { forkJoin } from 'rxjs';
import { FormControl } from '@angular/forms';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
export class DevicesComponent implements OnInit {
  devices: NetworkInfoDTO[] = [];
  filteredDevices: NetworkInfoDTO[] = [];
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

  // Control para el filtro de nombre
  nombreEquipoControl = new FormControl('');

  // Control para el filtro de búsqueda por MAC
  macSearchControl = new FormControl('');

  constructor(
    private networkInfoService: NetworkInfoService,
    private router: Router,
    private route: ActivatedRoute,
    private configService: ConfigService,
    private http: HttpClient,
    private notificationService: NotificationService,
    private permissionsService: PermissionsService,
    private estadoDispositivoService: EstadoDispositivoService,
    private modalService: NgbModal
  ) {
    // Suscribirse a cambios en el filtro de nombre
    this.nombreEquipoControl.valueChanges.subscribe(value => {
      this.aplicarFiltroNombre(value || '');
    });

    // Suscribirse a cambios en el filtro de MAC
    this.macSearchControl.valueChanges.subscribe(value => {
      this.aplicarFiltroMac(value || '');
    });
  }

  ngOnInit(): void {
    this.cargarDispositivos();
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
          
          this.applyFilter();
          this.checkQueryParams();
        } else {
          this.errorMessage = response.dispositivos.message || 'Error al cargar los dispositivos';
          this.devices = [];
          this.filteredDevices = [];
          this.collectionSize = 0;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al obtener los dispositivos:', error);
        this.errorMessage = 'Error al cargar los dispositivos. Por favor, intente nuevamente.';
        this.devices = [];
        this.filteredDevices = [];
        this.collectionSize = 0;
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
    
    this.collectionSize = this.filteredDevices.length;
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

  // Obtener configuración de color para un tipo de dispositivo
  getDeviceTypeConfig(type: string): DeviceType {
    if (!type) {
      return {
        name: 'Desconocido',
        color: '#6c757d',
        backgroundColor: '#f8f9fa',
        borderColor: '#dee2e6',
        icon: 'fa-question-circle'
      };
    }
    
    const deviceType = this.deviceTypes.find(dt => 
      dt.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
      type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    
    // Si no encuentra el tipo, usar un color por defecto
    return deviceType || {
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
  
  // Getter para obtener los dispositivos paginados
  get pagedDevices(): NetworkInfoDTO[] {
    const start = (this.page - 1) * this.pageSize;
    const end = this.page * this.pageSize;
    return this.filteredDevices.slice(start, end);
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
      usuario: 'Usuario' // TODO: Obtener del contexto de autenticación
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

    const modalRef = this.modalService.open(TransferirEquipoModalComponent, { size: 'lg' });
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
      usuario: 'Usuario' // TODO: Obtener del contexto de autenticación
    };

    if (transferData.tipoAlmacen === 'regular') {
      requestData.estanteria = transferData.estanteria;
      requestData.estante = transferData.estante;
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

  // Métodos de permisos
  canManageDevices(): boolean {
    return this.permissionsService.canManageAssets(); // Usar el mismo permiso por ahora
  }

  canManageDeviceStates(): boolean {
    return this.permissionsService.isGM() || this.permissionsService.isAdmin();
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
  private aplicarFiltroNombre(nombre: string): void {
    if (!nombre.trim()) {
      // Si no hay filtro de nombre, aplicar solo el filtro de tipo
      this.applyFilter();
    } else {
      // Aplicar filtro de nombre sobre los dispositivos filtrados por tipo
      const dispositivosPorTipo = this.obtenerDispositivosPorTipoActual();
      this.filteredDevices = dispositivosPorTipo.filter(device => 
        device.name?.toLowerCase().includes(nombre.toLowerCase())
      );
      this.actualizarPaginacion();
    }
  }

  private aplicarFiltroMac(mac: string): void {
    if (!mac.trim()) {
      // Si no hay filtro de MAC, aplicar solo el filtro de tipo
      this.applyFilter();
    } else {
      // Aplicar filtro de MAC sobre los dispositivos filtrados por tipo
      const dispositivosPorTipo = this.obtenerDispositivosPorTipoActual();
      this.filteredDevices = dispositivosPorTipo.filter(device => 
        device.mac?.toLowerCase().includes(mac.toLowerCase())
      );
      this.actualizarPaginacion();
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
    this.collectionSize = this.filteredDevices.length;
    this.page = 1;
  }

  // Método para limpiar todos los filtros de búsqueda
  limpiarFiltros(): void {
    this.nombreEquipoControl.setValue('');
    this.macSearchControl.setValue('');
    this.applyFilter();
  }

  // Método para aplicar filtros de búsqueda por nombre y MAC
  private aplicarFiltrosDeBusqueda(dispositivos: NetworkInfoDTO[]): NetworkInfoDTO[] {
    let dispositivosFiltrados = [...dispositivos];
    
    // Aplicar filtro de nombre si existe
    const nombreFiltro = this.nombreEquipoControl.value;
    if (nombreFiltro && nombreFiltro.trim()) {
      dispositivosFiltrados = dispositivosFiltrados.filter(device => 
        device.name?.toLowerCase().includes(nombreFiltro.toLowerCase())
      );
    }
    
    // Aplicar filtro de MAC si existe
    const macFiltro = this.macSearchControl.value;
    if (macFiltro && macFiltro.trim()) {
      dispositivosFiltrados = dispositivosFiltrados.filter(device => 
        device.mac?.toLowerCase().includes(macFiltro.toLowerCase())
      );
    }
    
    return dispositivosFiltrados;
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
    if (this.nombreEquipoControl.value || this.macSearchControl.value) {
      filtroTexto += ' | Búsqueda activa';
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
      device.type || 'N/A',
      device.description || 'N/A'
    ]);
    
    // Crear la tabla
    autoTable(doc, {
      head: [['Nombre de Red', 'IP', 'Tipo', 'Descripción']],
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