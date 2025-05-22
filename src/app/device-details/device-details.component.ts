import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { NgbNavModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Location } from '@angular/common';
import { UbicacionesService } from '../services/ubicaciones.service';
import { UbicacionDTO } from '../interfaces/ubicacion.interface';
import { LocationPickerModalComponent } from '../components/location-picker-modal/location-picker-modal.component';

@Component({
  selector: 'app-device-details',
  standalone: true,
  imports: [CommonModule, NgbNavModule],
  templateUrl: './device-details.component.html',
  styleUrls: ['./device-details.component.css']
})
export class DeviceDetailsComponent implements OnInit {
  device?: NetworkInfoDTO;
  activeTab = 1;
  ubicacionActual?: UbicacionDTO;
  ubicacionesDisponibles: UbicacionDTO[] = [];
  loading: boolean = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private networkInfoService: NetworkInfoService,
    private location: Location,
    private modalService: NgbModal,
    private ubicacionesService: UbicacionesService
  ) {}

  ngOnInit(): void {
    const mac = this.route.snapshot.paramMap.get('mac');
    if (mac) {
      this.loading = true;
      this.networkInfoService.getNetworkInfoByMac(mac).subscribe({
        next: (response) => {
          if (response.success) {
            this.device = response.data;
            if (this.device?.mac) {
              this.cargarUbicacion();
            }
          } else {
            this.error = response.message || 'Error al cargar el dispositivo';
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al obtener el dispositivo:', error);
          this.error = 'Error al cargar el dispositivo. Por favor, intente nuevamente.';
          this.loading = false;
        }
      });
    }
  }

  cargarUbicacion() {
    if (this.device?.mac) {
      this.loading = true;
      this.error = null;
      this.ubicacionesService.getUbicacionDispositivo(this.device.mac).subscribe({
        next: (ubicacion) => {
          this.ubicacionActual = ubicacion;
          this.loading = false;
        },
        error: (error) => {
          if (error.status === 404 || error.message?.includes('no encontrada')) {
            this.ubicacionActual = undefined;
            this.error = null;
          } else {
            console.error('Error al cargar ubicación:', error);
            this.error = 'Error al cargar la ubicación. Por favor, intente nuevamente.';
          }
          this.loading = false;
        }
      });
    }
  }

  actualizarUbicacion() {
    if (this.ubicacionActual && this.device?.mac) {
      this.loading = true;
      this.error = null;

      if (this.ubicacionActual.id) {
        this.ubicacionesService.actualizarUbicacionDispositivo(this.device.mac, this.ubicacionActual).subscribe({
          next: (response) => {
            console.log('Ubicación actualizada:', response);
            this.cargarUbicacion();
          },
          error: (error: any) => {
            console.error('Error al actualizar ubicación:', error);
            this.error = 'Error al actualizar la ubicación. Por favor, intente nuevamente.';
            this.loading = false;
          }
        });
      } else {
        this.ubicacionesService.crearUbicacionDispositivo(this.ubicacionActual).subscribe({
          next: (response) => {
            console.log('Ubicación creada:', response);
            this.cargarUbicacion();
          },
          error: (error: any) => {
            console.error('Error al crear ubicación:', error);
            this.error = 'Error al asignar la ubicación. Por favor, intente nuevamente.';
            this.loading = false;
          }
        });
      }
    }
  }

  seleccionarUbicacion() {
    this.loading = true;
    this.error = null;
    
    this.ubicacionesService.getUbicaciones().subscribe({
      next: (ubicaciones) => {
        this.ubicacionesDisponibles = ubicaciones;
        const modalRef = this.modalService.open(LocationPickerModalComponent, { 
          size: 'lg',
          backdrop: 'static',
          keyboard: false
        });
        
        modalRef.componentInstance.ubicaciones = this.ubicacionesDisponibles;
        
        modalRef.result.then(
          (ubicacionSeleccionada: UbicacionDTO) => {
            if (ubicacionSeleccionada && this.device?.mac) {
              // Validaciones
              if (!ubicacionSeleccionada.id) {
                console.error('La ubicación seleccionada no tiene ID');
                this.error = 'Error: La ubicación seleccionada no es válida';
                return;
              }

              if (typeof ubicacionSeleccionada.id !== 'number') {
                console.error('El ID de ubicación debe ser un número');
                this.error = 'Error: ID de ubicación inválido';
                return;
              }

              // Preparar datos
              this.ubicacionActual = {
                ...ubicacionSeleccionada,
                tipo: 'DISPOSITIVO',
                macaddr: this.device.mac,
                hardwareId: null
              };

              // Logs de depuración
              console.log('Ubicación seleccionada:', this.ubicacionActual);

              this.actualizarUbicacion();
            }
          },
          () => {
            console.log('Modal cerrado sin selección');
            this.loading = false;
          }
        ).catch(error => {
          console.error('Error en el modal:', error);
          this.error = 'Error al seleccionar la ubicación';
          this.loading = false;
        });
      },
      error: (error) => {
        console.error('Error cargando ubicaciones:', error);
        this.error = 'Error al cargar las ubicaciones disponibles. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  volver(): void {
    this.location.back();
  }
} 