import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './devices.component.html',
  styleUrls: ['./devices.component.css']
})
export class DevicesComponent implements OnInit {
  devices: NetworkInfoDTO[] = [];

  constructor(private networkInfoService: NetworkInfoService) {}

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
} 