import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { Router } from '@angular/router';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
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
  errorMessage: string | null = null;
  loading: boolean = true;
  
  // Variables para paginación
  page: number = 1;
  pageSize: number = 10;
  collectionSize: number = 0;

  constructor(
    private networkInfoService: NetworkInfoService,
    private router: Router
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
          this.collectionSize = this.devices.length;
          console.log('Dispositivos cargados:', this.devices);
        } else {
          this.errorMessage = response.message || 'Error al cargar los dispositivos';
          this.devices = [];
          this.collectionSize = 0;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al obtener los dispositivos:', error);
        this.errorMessage = 'Error al cargar los dispositivos. Por favor, intente nuevamente.';
        this.devices = [];
        this.collectionSize = 0;
        this.loading = false;
      }
    });
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
    return this.devices.slice(start, end);
  }
} 