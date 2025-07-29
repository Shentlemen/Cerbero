import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { Router, ActivatedRoute } from '@angular/router';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';

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
  imports: [CommonModule, NgbPaginationModule],
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
  pageSize: number = 10;
  collectionSize: number = 0;

  // Filtro activo
  activeFilter: string = 'all';

  // Definición de tipos de dispositivos con colores e iconos
  deviceTypes: DeviceType[] = [
    { name: 'Impresora', color: '#2e7d32', backgroundColor: '#e8f5e9', borderColor: '#c8e6c9', icon: 'fa-print' },
    { name: 'Teléfono IP', color: '#1976d2', backgroundColor: '#e3f2fd', borderColor: '#bbdefb', icon: 'fa-phone' },
    { name: 'Cámaras IP', color: '#7b1fa2', backgroundColor: '#f3e5f5', borderColor: '#e1bee7', icon: 'fa-video' },
    { name: 'Plotter', color: '#f57c00', backgroundColor: '#fff3e0', borderColor: '#ffe0b2', icon: 'fa-print' },
    { name: 'Switch', color: '#388e3c', backgroundColor: '#e8f5e9', borderColor: '#c8e6c9', icon: 'fa-network-wired' },
    { name: 'Router', color: '#d32f2f', backgroundColor: '#ffebee', borderColor: '#ffcdd2', icon: 'fa-wifi' },
    { name: 'Reloj de Marcado', color: '#6a1b9a', backgroundColor: '#f3e5f5', borderColor: '#e1bee7', icon: 'fa-clock' }
  ];

  constructor(
    private networkInfoService: NetworkInfoService,
    private router: Router,
    private route: ActivatedRoute
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
      this.filteredDevices = this.devices.filter(device => 
        device.type && device.type.toLowerCase() === filter.toLowerCase()
      );
    }
    
    this.collectionSize = this.filteredDevices.length;
  }

  // Obtener configuración de color para un tipo de dispositivo
  getDeviceTypeConfig(type: string): DeviceType {
    const deviceType = this.deviceTypes.find(dt => 
      dt.name.toLowerCase() === type.toLowerCase()
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

  // Verificar si un filtro está activo
  isFilterActive(filter: string): boolean {
    return this.activeFilter === filter;
  }

  // Obtener el conteo de dispositivos por tipo
  getDeviceCount(type: string): number {
    if (type === 'all') {
      return this.devices.length;
    }
    return this.devices.filter(device => 
      device.type && device.type.toLowerCase() === type.toLowerCase()
    ).length;
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
      default:
        return normalizedValue;
    }
  }
} 