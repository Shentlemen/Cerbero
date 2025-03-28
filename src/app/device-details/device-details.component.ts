import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { NgbNavModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Location } from '@angular/common';
import { UbicacionesService, Ubicacion, TipoUbicacion } from '../services/ubicaciones.service';
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
  ubicacionActual?: Ubicacion;
  ubicacionesDisponibles: Ubicacion[] = [];
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
      this.networkInfoService.getNetworkInfoByMac(mac).subscribe({
        next: (device) => {
          this.device = device;
          if (this.device?.mac) {
            this.cargarUbicacion();
          }
        },
        error: (error) => {
          console.error('Error al obtener el dispositivo:', error);
          this.error = 'Error al cargar el dispositivo';
        }
      });
    }
  }

  cargarUbicacion() {
    if (this.device?.mac) {
      this.loading = true;
      this.ubicacionesService.getUbicacionByMacaddr(this.device.mac).subscribe({
        next: (ubicacion: Ubicacion) => {
          this.ubicacionActual = ubicacion;
          this.loading = false;
        },
        error: (error: any) => {
          if (error.status === 404) {
            this.ubicacionActual = undefined;
            this.error = null;
          } else {
            console.error('Error cargando ubicación:', error);
            this.error = 'Error al cargar la ubicación';
          }
          this.loading = false;
        }
      });
    }
  }

  seleccionarUbicacion() {
    this.loading = true;
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
          (ubicacionSeleccionada: Ubicacion) => {
            if (ubicacionSeleccionada && this.device?.mac) {
              // Validaciones
              if (!ubicacionSeleccionada.idUbicacion) {
                console.error('La ubicación seleccionada no tiene ID');
                this.error = 'Error: La ubicación seleccionada no es válida';
                return;
              }

              if (typeof ubicacionSeleccionada.idUbicacion !== 'number') {
                console.error('El ID de ubicación debe ser un número');
                this.error = 'Error: ID de ubicación inválido';
                return;
              }

              // Preparar datos
              const tipoUbicacion: TipoUbicacion = {
                idUbicacion: Number(ubicacionSeleccionada.idUbicacion),
                tipo: 'DISPOSITIVO',
                macaddr: this.device.mac
              };

              // Logs de depuración
              console.log('Ubicación seleccionada:', ubicacionSeleccionada);
              console.log('Datos a enviar:', tipoUbicacion);

              if (this.ubicacionActual) {
                console.log('Actualizando ubicación existente:');
                console.log('ID ubicación actual:', this.ubicacionActual.idUbicacion);
                console.log('Nueva ubicación seleccionada:', ubicacionSeleccionada);

                // Actualizar ubicación existente
                this.ubicacionesService.actualizarTipoUbicacion(
                  ubicacionSeleccionada.idUbicacion!,
                  tipoUbicacion
                ).subscribe({
                  next: (response) => {
                    console.log('Respuesta de actualización:', response);
                    this.cargarUbicacion();
                  },
                  error: (error) => {
                    console.error('Error actualizando ubicación:', error);
                    console.error('Detalles del error:', {
                      status: error.status,
                      message: error.message,
                      error: error.error
                    });
                    this.error = 'Error al actualizar la ubicación';
                  }
                });
              } else {
                // Crear nueva asignación
                this.ubicacionesService.crearTipoUbicacion(tipoUbicacion).subscribe({
                  next: () => {
                    this.cargarUbicacion();
                  },
                  error: (error) => {
                    console.error('Error creando ubicación:', error);
                    this.error = 'Error al asignar la ubicación';
                  }
                });
              }
            }
          },
          () => {
            console.log('Modal cerrado sin selección');
          }
        );
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando ubicaciones:', error);
        this.error = 'Error al cargar las ubicaciones disponibles';
        this.loading = false;
      }
    });
  }

  volver(): void {
    this.location.back();
  }
} 