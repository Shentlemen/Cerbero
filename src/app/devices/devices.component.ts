import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { Router } from '@angular/router';

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './devices.component.html',
  styleUrls: ['./devices.component.css']
})
export class DevicesComponent implements OnInit {
  devices: NetworkInfoDTO[] = [];

  constructor(
    private networkInfoService: NetworkInfoService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.networkInfoService.getNetworkInfo().subscribe({
      next: (data) => {
        this.devices = data;
      },
      error: (error) => {
        console.error('Error al obtener los dispositivos:', error);
      }
    });
  }

  verDetallesDevice(device: NetworkInfoDTO) {
    console.log('Device:', device);
    console.log('MAC:', device?.mac);
    
    if (device && device.mac) {
      console.log('Navegando a:', `/menu/device-details/${device.mac}`);
      this.router.navigate(['/menu/device-details', device.mac]);
    } else {
      console.error('Error: MAC address no disponible', device);
    }
  }
} 