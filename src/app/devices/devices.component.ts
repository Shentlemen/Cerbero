import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { Router, ActivatedRoute } from '@angular/router';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { ConfigService } from '../services/config.service';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { PermissionsService } from '../services/permissions.service';

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
  imports: [CommonModule, NgbPaginationModule, NotificationContainerComponent],
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
    { name: 'Reloj Biométrico', color: '#4a148c', backgroundColor: '#f3e5f5', borderColor: '#ce93d8', icon: 'fa-fingerprint' }
  ];

  constructor(
    private networkInfoService: NetworkInfoService,
    private router: Router,
    private route: ActivatedRoute,
    private configService: ConfigService,
    private http: HttpClient,
    private notificationService: NotificationService,
    private permissionsService: PermissionsService
  ) {}

  ngOnInit(): void {
    this.cargarDispositivos();
  }

  cargarDispositivos(): void {
    this.loading = true;
    this.errorMessage = null;
    
    this.networkInfoService.getNetworkInfo().subscribe({
      next: (response: ApiResponse<NetworkInfoDTO[]>) => {
        if (response.success) {
          this.devices = response.data;
          this.applyFilter();
          // console.log('Dispositivos cargados:', this.devices);
          // Verificar parámetros de consulta después de cargar los datos
          this.checkQueryParams();
        } else {
          this.errorMessage = response.message || 'Error al cargar los dispositivos';
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
    
    if (filter === 'all') {
      this.filteredDevices = [...this.devices];
    } else {
      this.filteredDevices = this.devices.filter(device => {
        if (!device.type) return false;
        return device.type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
               filter.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      });
    }
    
    this.collectionSize = this.filteredDevices.length;
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
      default:
        return normalizedValue;
    }
  }
} 