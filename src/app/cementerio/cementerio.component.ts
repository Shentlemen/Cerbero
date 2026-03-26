import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { HardwareService } from '../services/hardware.service';
import { BiosService } from '../services/bios.service';
import { EstadoEquipoService, CambioEstadoRequest, EstadoEquipo } from '../services/estado-equipo.service';
import { EstadoDispositivoService, CambioEstadoDispositivoRequest } from '../services/estado-dispositivo.service';
import { AuthService } from '../services/auth.service';
import { NetworkInfoService } from '../services/network-info.service';
import { PermissionsService } from '../services/permissions.service';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { TransferirEquipoModalComponent } from '../components/transferir-equipo-modal/transferir-equipo-modal.component';
import { FormularioBajaModalComponent, DatosBaja } from '../components/formulario-baja-modal/formulario-baja-modal.component';
import { forkJoin } from 'rxjs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-cementerio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, HttpClientModule, NgbPaginationModule, NgbModule, NotificationContainerComponent],
  templateUrl: './cementerio.component.html',
  styleUrls: ['./cementerio.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class CementerioComponent implements OnInit {

  equiposEnBaja: any[] = [];
  equiposFiltrados: any[] = [];
  dispositivosEnBaja: any[] = [];
  dispositivosFiltrados: any[] = [];
  loading: boolean = true;
  
  // Paginación
  page = 1;
  pageSize = 20;
  collectionSize = 0;

  // Filtro de búsqueda
  nombreEquipoControl = new FormControl('');
  
  // Filtro por tipo (todos, equipos, dispositivos)
  filtroTipo: 'todos' | 'equipos' | 'dispositivos' = 'todos';

  // Ordenamiento
  sortColumn: 'tipo' | 'nombre' | 'fecha' | 'usuario' | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Reactivación
  showReactivarDialog: boolean = false;
  equipoToReactivar: any = null;
  reactivatingEquipoId: number | null = null;
  reactivatingItemId: string | number | null = null;
  itemToReactivar: any = null;
  transferiendoItemId: string | number | null = null;

  // Edición de observaciones
  editingObservacionesId: string | number | null = null;
  editingObservacionesValue: string = '';
  updatingObservaciones: boolean = false;

  constructor(
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private estadoEquipoService: EstadoEquipoService,
    private estadoDispositivoService: EstadoDispositivoService,
    private authService: AuthService,
    private networkInfoService: NetworkInfoService,
    private router: Router,
    private permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private modalService: NgbModal
  ) {
    // Suscribirse a cambios en el filtro de nombre
    this.nombreEquipoControl.valueChanges.subscribe(value => {
      this.aplicarFiltroNombre(value || '');
    });
  }

  ngOnInit(): void {
    this.loadItemsEnBaja();
  }

  loadItemsEnBaja(): void {
    this.loading = true;
    
    forkJoin({
      equipos: this.estadoEquipoService.getEquiposEnBaja(),
      dispositivos: this.estadoDispositivoService.getDispositivosEnBaja(),
      hardware: this.hardwareService.getHardware(),
      bios: this.biosService.getAllBios(),
      networkInfo: this.networkInfoService.getNetworkInfo()
    }).subscribe({
      next: (response) => {
        // Procesar equipos en baja
        if (response.equipos.success) {
          const estadosEnBaja: EstadoEquipo[] = response.equipos.data;
          const biosMap = new Map(response.bios.map((b: any) => [b.hardwareId, b]));
          
          this.equiposEnBaja = estadosEnBaja.map(estado => {
            const hardware = response.hardware.find((h: any) => h.id === estado.hardwareId);
            const bios = biosMap.get(estado.hardwareId);
            
            return {
              ...hardware,
              estadoInfo: estado,
              biosType: (bios?.type || 'DESCONOCIDO').trim().toUpperCase(),
              smanufacturer: bios?.smanufacturer || 'DESCONOCIDO',
              fechaBaja: estado.fechaCambio,
              observaciones: estado.observaciones,
              usuarioCambio: estado.usuarioCambio,
              tipo: 'EQUIPO'
            };
          }).filter(equipo => equipo.id);
        }

        // Procesar dispositivos en baja
        if (response.dispositivos.success && response.networkInfo.success) {
          const estadosEnBaja = response.dispositivos.data;
          const networkInfoMap = new Map(
            response.networkInfo.data.map((device: any) => [device.mac, device])
          );
          
          this.dispositivosEnBaja = estadosEnBaja.map((estado: any) => {
            const networkInfo = networkInfoMap.get(estado.mac);
            
            return {
              ...networkInfo, // Incluir name, type, ip, description
              mac: estado.mac,
              tipo: 'DISPOSITIVO',
              fechaBaja: estado.fechaCambio,
              observaciones: estado.observaciones,
              usuarioCambio: estado.usuarioCambio
            };
          }).filter((dispositivo: any) => dispositivo.mac); // Solo incluir si tiene MAC
        }
        
        // Aplicar filtros iniciales
        this.aplicarFiltros();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar items en baja:', error);
        this.notificationService.showError(
          'Error al cargar datos',
          'No se pudieron cargar los items dados de baja: ' + (error.message || 'Error desconocido')
        );
        this.loading = false;
      }
    });
  }

  private aplicarFiltroNombre(nombre: string): void {
    this.aplicarFiltros();
  }

  /**
   * Aplica todos los filtros (tipo y nombre)
   */
  private aplicarFiltros(): void {
    let itemsFiltrados: any[] = [];

    // Primero filtrar por tipo
    if (this.filtroTipo === 'equipos') {
      itemsFiltrados = [...this.equiposEnBaja];
    } else if (this.filtroTipo === 'dispositivos') {
      itemsFiltrados = [...this.dispositivosEnBaja];
    } else {
      itemsFiltrados = [...this.equiposEnBaja, ...this.dispositivosEnBaja];
    }

    // Luego filtrar por nombre si hay búsqueda
    const nombreBusqueda = this.nombreEquipoControl.value?.trim() || '';
    if (nombreBusqueda) {
      itemsFiltrados = itemsFiltrados.filter(item => 
        (item.name || item.mac || '').toLowerCase().includes(nombreBusqueda.toLowerCase())
      );
    }

    this.equiposFiltrados = itemsFiltrados;
    this.actualizarPaginacion();
  }

  /**
   * Cambia el filtro por tipo
   */
  filtrarPorTipo(tipo: 'todos' | 'equipos' | 'dispositivos'): void {
    this.filtroTipo = tipo;
    this.page = 1; // Resetear a la primera página
    this.aplicarFiltros();
  }

  /**
   * Obtiene el total de equipos en el cementerio
   */
  getTotalEquipos(): number {
    return this.equiposEnBaja.length;
  }

  /**
   * Obtiene el total de dispositivos en el cementerio
   */
  getTotalDispositivos(): number {
    return this.dispositivosEnBaja.length;
  }

  /**
   * Obtiene el total de items (equipos + dispositivos) en el cementerio
   */
  getTotalItems(): number {
    return this.equiposEnBaja.length + this.dispositivosEnBaja.length;
  }

  private actualizarPaginacion(): void {
    this.collectionSize = this.equiposFiltrados.length;
    this.page = 1;
  }

  ordenarPor(columna: 'tipo' | 'nombre' | 'fecha' | 'usuario'): void {
    if (this.sortColumn === columna) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = columna;
      this.sortDirection = 'asc';
    }
    this.page = 1;
  }

  isSortedBy(columna: 'tipo' | 'nombre' | 'fecha' | 'usuario'): boolean {
    return this.sortColumn === columna;
  }

  getSortIcon(columna: 'tipo' | 'nombre' | 'fecha' | 'usuario'): string {
    if (this.sortColumn !== columna) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  private getListaOrdenada(): any[] {
    const lista = [...this.equiposFiltrados];
    const col = this.sortColumn;
    if (!col) return lista;
    return lista.sort((a, b) => {
      const valA = this.getValorOrdenamiento(a, col);
      const valB = this.getValorOrdenamiento(b, col);
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return this.sortDirection === 'asc' ? cmp : -cmp;
    });
  }

  private getValorOrdenamiento(item: any, columna: 'tipo' | 'nombre' | 'fecha' | 'usuario'): string | number {
    switch (columna) {
      case 'tipo':
        return (item.tipo || '').toString();
      case 'nombre':
        return (item.name || item.mac || '').toLowerCase();
      case 'fecha':
        return item.fechaBaja ? new Date(item.fechaBaja).getTime() : 0;
      case 'usuario':
        return (item.usuarioCambio || '').toLowerCase();
      default:
        return '';
    }
  }

  get pagedEquipos(): any[] {
    const listaOrdenada = this.getListaOrdenada();
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return listaOrdenada.slice(startItem, endItem);
  }

  verDetallesEquipo(equipo: any): void {
    if (equipo && equipo.id) {
      this.router.navigate(['/menu/asset-details', equipo.id]);
    } else {
      console.error('Equipo ID is undefined or null', equipo);
    }
  }

  reactivarEquipo(equipo: any): void {
    this.equipoToReactivar = equipo;
    this.showReactivarDialog = true;
  }

  confirmarReactivacion(): void {
    console.log('🔄 confirmarReactivacion llamado');
    console.log('🔄 itemToReactivar:', this.itemToReactivar);
    
    if (!this.itemToReactivar) {
      console.log('❌ No hay item para reactivar');
      return;
    }

    console.log('🔄 Tipo de item:', this.itemToReactivar.tipo);
    console.log('🔄 ID/MAC del item:', this.itemToReactivar.id || this.itemToReactivar.mac);

    if (this.itemToReactivar.tipo === 'EQUIPO') {
      console.log('🔄 Llamando a reactivarEquipoDelServicio');
      this.reactivarEquipoDelServicio(this.itemToReactivar);
    } else if (this.itemToReactivar.tipo === 'DISPOSITIVO') {
      console.log('🔄 Llamando a reactivarDispositivo');
      this.reactivarDispositivo(this.itemToReactivar);
    } else {
      console.log('❌ Tipo de item desconocido:', this.itemToReactivar.tipo);
    }
  }

  cancelarReactivacion(): void {
    this.showReactivarDialog = false;
    this.itemToReactivar = null;
    this.reactivatingItemId = null;
  }

  canManageAssets(): boolean {
    // En Cementerio, GM/Admin/Almacén/Gestión de Equipos pueden gestionar items
    return this.permissionsService.canManageEquipmentStates();
  }

  formatFecha(fecha: string): string {
    if (!fecha) return 'No disponible';
    
    try {
      const date = new Date(fecha);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  }

  getEquipoIcon(biosType: string): string {
    switch (biosType?.toUpperCase()) {
      case 'DESKTOP':
      case 'LOW PROFILE DESKTOP':
        return 'fa-desktop';
      case 'LAPTOP':
      case 'NOTEBOOK':
        return 'fa-laptop';
      case 'MINI PC':
        return 'fa-tablet-alt';
      case 'TOWER':
      case 'MINI TOWER':
        return 'fa-server';
      default:
        return 'fa-question-circle';
    }
  }

  getTypeBadgeClass(biosType: string): string {
    switch (biosType?.toUpperCase()) {
      case 'DESKTOP':
        return 'desktop';
      case 'LAPTOP':
      case 'NOTEBOOK':
        return 'laptop';
      case 'MINI PC':
        return 'mini';
      case 'TOWER':
        return 'tower';
      case 'LOW PROFILE DESKTOP':
        return 'low-profile';
      case 'MINI TOWER':
        return 'mini-tower';
      default:
        return 'desconocido';
    }
  }

  // Métodos para manejar tanto equipos como dispositivos
  verDetallesItem(item: any): void {
    if (item.tipo === 'EQUIPO' && item.id) {
      this.router.navigate(['/menu/asset-details', item.id]);
    } else if (item.tipo === 'DISPOSITIVO' && item.mac) {
      this.router.navigate(['/menu/device-details', item.mac]);
    } else {
      console.error('Item sin ID o MAC válido:', item);
    }
  }

  getItemIcon(item: any): string {
    if (item.tipo === 'EQUIPO') {
      return this.getEquipoIcon(item.biosType);
    } else if (item.tipo === 'DISPOSITIVO') {
      return this.getDeviceIcon(item.type);
    }
    return 'fa-question-circle';
  }

  getDeviceIcon(deviceType: string): string {
    // Mapeo de tipos de dispositivo a iconos
    const iconMap: { [key: string]: string } = {
      'Impresora': 'fa-print',
      'Teléfono IP': 'fa-phone',
      'Cámaras IP': 'fa-video',
      'Plotter': 'fa-print',
      'Switch': 'fa-network-wired',
      'Router': 'fa-wifi',
      'Reloj de Marcado': 'fa-clock',
      'Access Point WiFi': 'fa-wifi',
      'Scanner': 'fa-camera',
      'UPS': 'fa-battery-full',
      'Access Point': 'fa-broadcast-tower',
      'Reloj Biométrico': 'fa-fingerprint',
      'Firewall': 'fa-shield-alt',
      'PLCs/Scada': 'fa-microchip'
    };
    
    return iconMap[deviceType] || 'fa-network-wired';
  }

  getDeviceTypeConfig(deviceType: string): any {
    // Configuración de colores para tipos de dispositivo
    const configMap: { [key: string]: any } = {
      'Impresora': { backgroundColor: '#e8f5e9', color: '#2e7d32' },
      'Teléfono IP': { backgroundColor: '#e3f2fd', color: '#1976d2' },
      'Cámaras IP': { backgroundColor: '#f3e5f5', color: '#7b1fa2' },
      'Plotter': { backgroundColor: '#fff3e0', color: '#f57c00' },
      'Switch': { backgroundColor: '#c8e6c9', color: '#1b5e20' },
      'Router': { backgroundColor: '#ffebee', color: '#d32f2f' },
      'Reloj de Marcado': { backgroundColor: '#f3e5f5', color: '#6a1b9a' },
      'Access Point WiFi': { backgroundColor: '#e1f5fe', color: '#0277bd' },
      'Scanner': { backgroundColor: '#f3e5f5', color: '#8e24aa' },
      'UPS': { backgroundColor: '#fff3e0', color: '#e65100' },
      'Access Point': { backgroundColor: '#e3f2fd', color: '#1565c0' },
      'Reloj Biométrico': { backgroundColor: '#f3e5f5', color: '#4a148c' },
      'Firewall': { backgroundColor: '#fce4ec', color: '#d81b60' },
      'PLCs/Scada': { backgroundColor: '#efebe9', color: '#5d4037' }
    };
    
    return configMap[deviceType] || { backgroundColor: '#f8f9fa', color: '#6c757d' };
  }

  reactivarItem(item: any): void {
    console.log('🔄 reactivarItem llamado con:', item);
    console.log('🔄 Tipo de item:', item.tipo);
    console.log('🔄 ID/MAC del item:', item.id || item.mac);
    
    this.itemToReactivar = item;
    this.showReactivarDialog = true;
    
    console.log('🔄 itemToReactivar establecido:', this.itemToReactivar);
    console.log('🔄 showReactivarDialog establecido:', this.showReactivarDialog);
  }

  private reactivarDispositivo(dispositivo: any): void {
    console.log('🔄 Intentando reactivar dispositivo:', dispositivo);
    this.reactivatingItemId = dispositivo.mac;

    const request: CambioEstadoDispositivoRequest = {
      observaciones: '',
      usuario: this.authService.getUsuarioParaAuditoria()
    };

    console.log('📤 Enviando request de reactivación:', request);

    this.estadoDispositivoService.reactivarDispositivo(dispositivo.mac, request).subscribe({
      next: (response) => {
        console.log('✅ Respuesta exitosa del servicio:', response);
        if (response.success) {
          // Eliminar el dispositivo de las listas locales
          this.dispositivosEnBaja = this.dispositivosEnBaja.filter(d => d.mac !== dispositivo.mac);
          this.equiposFiltrados = this.equiposFiltrados.filter(d => d.mac !== dispositivo.mac);
          
          this.actualizarPaginacion();
          
          this.notificationService.showSuccessMessage(
            `Dispositivo "${dispositivo.name || dispositivo.mac}" reactivado exitosamente.`
          );
        } else {
          throw new Error(response.message || 'Error al reactivar el dispositivo');
        }
      },
      error: (error) => {
        console.error('❌ Error al reactivar dispositivo:', error);
        this.notificationService.showError(
          'Error al reactivar dispositivo',
          `No se pudo reactivar el dispositivo "${dispositivo.name || dispositivo.mac}": ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        console.log('🏁 Reactivación de dispositivo completada');
        this.reactivatingItemId = null;
        this.showReactivarDialog = false;
        this.itemToReactivar = null;
      }
    });
  }

  private reactivarEquipoDelServicio(equipo: any): void {
    this.reactivatingItemId = equipo.id;

    const request: CambioEstadoRequest = {
      observaciones: '',
      usuario: this.authService.getUsuarioParaAuditoria()
    };

    this.estadoEquipoService.reactivarEquipo(equipo.id, request).subscribe({
      next: (response) => {
        if (response.success) {
          // Eliminar el equipo de las listas locales
          this.equiposEnBaja = this.equiposEnBaja.filter(e => e.id !== equipo.id);
          this.equiposFiltrados = this.equiposFiltrados.filter(e => e.id !== equipo.id);
          
          this.actualizarPaginacion();
          
          this.notificationService.showSuccessMessage(
            `Equipo "${equipo.name}" reactivado exitosamente.`
          );
        } else {
          throw new Error(response.message || 'Error al reactivar el equipo');
        }
      },
      error: (error) => {
        console.error('Error al reactivar equipo:', error);
        this.notificationService.showError(
          'Error al reactivar equipo',
          `No se pudo reactivar el equipo "${equipo.name}": ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        this.reactivatingItemId = null;
        this.showReactivarDialog = false;
        this.itemToReactivar = null;
      }
    });
  }

  // Métodos para editar observaciones
  iniciarEdicionObservaciones(item: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!this.canManageAssets()) {
      return;
    }
    const itemId = item.tipo === 'EQUIPO' ? item.id : item.mac;
    this.editingObservacionesId = itemId;
    this.editingObservacionesValue = item.observaciones || '';
  }

  cancelarEdicionObservaciones(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.editingObservacionesId = null;
    this.editingObservacionesValue = '';
  }

  guardarObservaciones(item: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!this.editingObservacionesId || this.updatingObservaciones) {
      return;
    }

    this.updatingObservaciones = true;
    const observaciones = this.editingObservacionesValue.trim();

    if (item.tipo === 'EQUIPO') {
      this.estadoEquipoService.actualizarObservaciones(item.id, observaciones).subscribe({
        next: (response) => {
          if (response.success) {
            // Actualizar el item en la lista local
            const equipoIndex = this.equiposEnBaja.findIndex(e => e.id === item.id);
            if (equipoIndex !== -1) {
              this.equiposEnBaja[equipoIndex].observaciones = observaciones;
            }
            const filtradoIndex = this.equiposFiltrados.findIndex(e => e.id === item.id);
            if (filtradoIndex !== -1) {
              this.equiposFiltrados[filtradoIndex].observaciones = observaciones;
            }
            this.notificationService.showSuccessMessage('Observaciones actualizadas exitosamente');
          } else {
            throw new Error(response.message || 'Error al actualizar observaciones');
          }
        },
        error: (error) => {
          console.error('Error al actualizar observaciones:', error);
          this.notificationService.showError(
            'Error al actualizar observaciones',
            `No se pudieron actualizar las observaciones: ${error.message || 'Error desconocido'}`
          );
        },
        complete: () => {
          this.updatingObservaciones = false;
          this.editingObservacionesId = null;
          this.editingObservacionesValue = '';
        }
      });
    } else if (item.tipo === 'DISPOSITIVO') {
      this.estadoDispositivoService.actualizarObservaciones(item.mac, observaciones).subscribe({
        next: (response) => {
          if (response.success) {
            // Actualizar el item en la lista local
            const dispositivoIndex = this.dispositivosEnBaja.findIndex(d => d.mac === item.mac);
            if (dispositivoIndex !== -1) {
              this.dispositivosEnBaja[dispositivoIndex].observaciones = observaciones;
            }
            const filtradoIndex = this.equiposFiltrados.findIndex(d => d.mac === item.mac);
            if (filtradoIndex !== -1) {
              this.equiposFiltrados[filtradoIndex].observaciones = observaciones;
            }
            this.notificationService.showSuccessMessage('Observaciones actualizadas exitosamente');
          } else {
            throw new Error(response.message || 'Error al actualizar observaciones');
          }
        },
        error: (error) => {
          console.error('Error al actualizar observaciones:', error);
          this.notificationService.showError(
            'Error al actualizar observaciones',
            `No se pudieron actualizar las observaciones: ${error.message || 'Error desconocido'}`
          );
        },
        complete: () => {
          this.updatingObservaciones = false;
          this.editingObservacionesId = null;
          this.editingObservacionesValue = '';
        }
      });
    }
  }

  estaEditandoObservaciones(item: any): boolean {
    const itemId = item.tipo === 'EQUIPO' ? item.id : item.mac;
    return this.editingObservacionesId === itemId;
  }

  // Método para transferir equipo
  transferirEquipo(item: any): void {
    // Solo permitir transferir equipos (no dispositivos)
    if (item.tipo !== 'EQUIPO') {
      this.notificationService.showError(
        'Operación no permitida',
        'Solo se pueden transferir equipos, no dispositivos.'
      );
      return;
    }

    const modalRef = this.modalService.open(TransferirEquipoModalComponent, { size: 'lg' });
    modalRef.componentInstance.item = {
      ...item,
      tipo: 'EQUIPO',
      name: item.name
    };

    modalRef.result.then((transferData: any) => {
      if (transferData) {
        this.procesarTransferencia(item, transferData);
      }
    }).catch(() => {
      // Usuario canceló el modal
    });
  }

  imprimirFormularioBaja(item: any, event?: Event): void {
    event?.stopPropagation();

    if (item.tipo !== 'EQUIPO') {
      return;
    }

    const modalRef = this.modalService.open(FormularioBajaModalComponent, {
      size: 'xl',
      backdrop: 'static',
      centered: true
    });

    const datosBaja: DatosBaja = {
      hardwareId: item.id,
      nombreEquipo: item.name,
      descripcion: item.type || item.deviceType || item.biosType
    };

    modalRef.componentInstance.datos = datosBaja;
    modalRef.componentInstance.soloImpresion = true;

    modalRef.result.catch(() => {
      // Cierre normal del modal
    });
  }

  private procesarTransferencia(item: any, transferData: any): void {
    this.transferiendoItemId = item.id;

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

    this.estadoEquipoService.transferirEquipo(item.id, requestData).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadItemsEnBaja();
          this.notificationService.showSuccessMessage(
            `Equipo "${item.name}" transferido exitosamente.`
          );
        } else {
          throw new Error(response.message || 'Error al transferir el equipo');
        }
      },
      error: (error) => {
        console.error('Error al transferir equipo:', error);
        this.notificationService.showError(
          'Error al transferir equipo',
          `No se pudo transferir el equipo "${item.name}": ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        this.transferiendoItemId = null;
      }
    });
  }

  // Método para exportar la lista filtrada a PDF
  exportarPDF(): void {
    if (this.equiposFiltrados.length === 0) {
      this.notificationService.showError(
        'No hay datos para exportar',
        'No hay items filtrados para exportar a PDF.'
      );
      return;
    }

    const doc = new jsPDF('landscape'); // Orientación horizontal para más espacio
    
    // Título del documento
    doc.setFontSize(18);
    doc.text('Cementerio de Equipos y Dispositivos', 14, 20);
    
    // Información del filtro aplicado
    doc.setFontSize(10);
    let filtroTexto = 'Todos los items';
    if (this.nombreEquipoControl.value) {
      filtroTexto = `Búsqueda: ${this.nombreEquipoControl.value}`;
    }
    doc.text(filtroTexto, 14, 28);
    
    // Fecha de generación
    const fecha = new Date().toLocaleString('es-ES');
    doc.text(`Generado el: ${fecha}`, 14, 34);
    doc.text(`Total de items: ${this.equiposFiltrados.length}`, 14, 40);
    
    // Preparar datos para la tabla
    const tableData = this.equiposFiltrados.map(item => [
      item.tipo === 'EQUIPO' ? 'Equipo' : 'Dispositivo',
      item.name || item.mac || 'N/A',
      item.tipo === 'EQUIPO' 
        ? `${item.biosType || 'N/A'} | ${item.osName || 'N/A'}`
        : `${item.type || 'N/A'} | ${item.description || 'Sin descripción'}`,
      item.tipo === 'EQUIPO' ? (item.ipAddr || 'N/A') : (item.ip || 'N/A'),
      this.formatFecha(item.fechaBaja),
      item.usuarioCambio || 'No especificado',
      item.observaciones || 'Sin observaciones'
    ]);
    
    // Crear la tabla
    autoTable(doc, {
      head: [['Tipo', 'Nombre', 'Detalles', 'IP', 'Fecha', 'Usuario', 'Observaciones']],
      body: tableData,
      startY: 46,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [220, 53, 69], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 46, left: 14, right: 14 },
      tableWidth: 'auto'
    });
    
    // Guardar el PDF
    const nombreArchivo = `cementerio_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(nombreArchivo);
    
    this.notificationService.showSuccessMessage(
      `PDF exportado exitosamente: ${nombreArchivo}`
    );
  }
} 