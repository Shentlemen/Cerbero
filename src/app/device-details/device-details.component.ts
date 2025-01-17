import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { UbicacionDispositivoComponent } from '../ubicacion-dispositivo/ubicacion-dispositivo.component';
import { UbicacionDispositivoService } from '../services/ubicacion-dispositivo.service';

@Component({
  selector: 'app-device-details',
  standalone: true,
  imports: [CommonModule, NgbNavModule, UbicacionDispositivoComponent],
  templateUrl: './device-details.component.html',
  styleUrls: ['./device-details.component.css']
})
export class DeviceDetailsComponent implements OnInit {
  device?: NetworkInfoDTO;
  ubicacion?: any;
  activeTab = 1;

  constructor(
    private route: ActivatedRoute,
    private networkInfoService: NetworkInfoService,
    private ubicacionService: UbicacionDispositivoService
  ) {}

  ngOnInit(): void {
    const mac = this.route.snapshot.paramMap.get('mac');
    if (mac) {
      this.networkInfoService.getNetworkInfoByMac(mac).subscribe({
        next: (device) => {
          this.device = device;
          if (this.device?.mac) {
            this.ubicacionService.getUbicacionByMacAddr(this.device.mac).subscribe({
              next: (ubicacion) => {
                this.ubicacion = ubicacion;
              },
              error: (error) => {
                if (error.status === 404) {
                  this.ubicacion = null;
                } else {
                  console.error('Error al obtener la ubicación:', error);
                }
              }
            });
          }
        },
        error: (error) => {
          console.error('Error al obtener el dispositivo:', error);
        }
      });
    }
  }
} 