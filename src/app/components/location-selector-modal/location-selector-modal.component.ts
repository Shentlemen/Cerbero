import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { UbicacionesService } from '../../services/ubicaciones.service';
import { UbicacionDTO } from '../../interfaces/ubicacion.interface';
import { SubnetService, SubnetDTO } from '../../services/subnet.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-location-selector-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './location-selector-modal.component.html',
  styleUrls: ['./location-selector-modal.component.css']
})
export class LocationSelectorModalComponent implements OnInit {
  @Input() ubicacion?: UbicacionDTO;
  @Input() isAssignmentMode: boolean = false;
  @Output() ubicacionSeleccionada = new EventEmitter<UbicacionDTO>();
  ubicacionForm: FormGroup;
  subnets: SubnetDTO[] = [];
  subnetsFiltradas: SubnetDTO[] = [];
  subnetFiltro: string = '';
  mostrarDropdown: boolean = false;
  subnetSeleccionada: SubnetDTO | null = null;

  constructor(
    public activeModal: NgbActiveModal,
    private formBuilder: FormBuilder,
    private ubicacionesService: UbicacionesService,
    private subnetService: SubnetService,
    private notificationService: NotificationService
  ) {
    this.ubicacionForm = this.formBuilder.group({
      nombreGerencia: [''],
      nombreOficina: [''],
      ciudad: ['', Validators.required],
      departamento: ['', Validators.required],
      direccion: [''],
      piso: [''],
      numeroPuerta: [''],
      interno: [''],
      idSubnet: [null as number | null]
    });
  }

  ngOnInit() {
    this.cargarSubnets();
    if (this.ubicacion) {
      this.ubicacionForm.patchValue({
        nombreGerencia: this.ubicacion.nombreGerencia,
        nombreOficina: this.ubicacion.nombreOficina,
        ciudad: this.ubicacion.ciudad,
        departamento: this.ubicacion.departamento,
        direccion: this.ubicacion.direccion,
        piso: this.ubicacion.piso,
        numeroPuerta: this.ubicacion.numeroPuerta,
        interno: this.ubicacion.interno,
        idSubnet: this.ubicacion.idSubnet
      });

      if (this.ubicacion.idSubnet) {
        this.subnetService.getSubnets().subscribe({
          next: (subnets) => {
            const subnetEncontrada = subnets.find((s) => s.pk === this.ubicacion?.idSubnet);
            if (subnetEncontrada) {
              this.subnetSeleccionada = subnetEncontrada;
              this.subnetFiltro = `${subnetEncontrada.name} - ${subnetEncontrada.id}`;
            }
          }
        });
      }
    }
  }

  cargarSubnets() {
    this.subnetService.getSubnets().subscribe({
      next: (subnets) => {
        this.subnets = subnets;
        this.subnetsFiltradas = [...subnets];
      },
      error: () => {
        this.notificationService.showError(
          'Error al cargar subnets',
          'No se pudieron cargar las subnets. Por favor, intente nuevamente.'
        );
      }
    });
  }

  filtrarSubnets(event: Event) {
    const target = event.target as HTMLInputElement;
    const filtro = target.value.toLowerCase();
    this.subnetFiltro = target.value;

    if (filtro.trim() === '') {
      this.subnetsFiltradas = [...this.subnets];
      this.mostrarDropdown = true;
    } else {
      this.subnetsFiltradas = this.subnets.filter(
        (subnet) =>
          subnet.name.toLowerCase().includes(filtro) ||
          subnet.id.toLowerCase().includes(filtro) ||
          subnet.pk.toString().includes(filtro)
      );
      this.mostrarDropdown = true;
    }
  }

  mostrarTodasSubnets() {
    this.subnetsFiltradas = [...this.subnets];
    this.mostrarDropdown = true;
  }

  seleccionarSubnet(subnet: SubnetDTO) {
    this.subnetSeleccionada = subnet;
    this.subnetFiltro = `${subnet.name} - ${subnet.id}`;
    this.ubicacionForm.patchValue({ idSubnet: subnet.pk });
    this.mostrarDropdown = false;
  }

  cerrarDropdown() {
    setTimeout(() => {
      this.mostrarDropdown = false;
    }, 200);
  }

  guardarUbicacion() {
    if (this.ubicacionForm.valid) {
      if (this.isAssignmentMode) {
        const ubicacionData = {
          id: this.ubicacion?.id || 0,
          hardwareId: this.ubicacion?.hardwareId || 0,
          tipo: 'EQUIPO' as const
        };

        if (this.ubicacion?.id) {
          this.ubicacionesService
            .actualizarUbicacionEquipo(this.ubicacion.hardwareId || 0, ubicacionData)
            .subscribe({
              next: (ubicacion: UbicacionDTO) => {
                this.notificationService.showSuccessMessage('Ubicación asignada exitosamente');
                this.activeModal.close(ubicacion);
              },
              error: () => {
                this.notificationService.showError(
                  'Error al asignar ubicación',
                  'No se pudo asignar la ubicación. Por favor, intente nuevamente.'
                );
              }
            });
        } else {
          this.ubicacionesService.crearUbicacionEquipo(ubicacionData).subscribe({
            next: (ubicacion: UbicacionDTO) => {
              this.notificationService.showSuccessMessage('Ubicación asignada exitosamente');
              this.activeModal.close(ubicacion);
            },
            error: () => {
              this.notificationService.showError(
                'Error al asignar ubicación',
                'No se pudo asignar la ubicación. Por favor, intente nuevamente.'
              );
            }
          });
        }
      } else {
        const ubicacionData = this.ubicacionForm.value;

        if (this.ubicacion?.id) {
          this.ubicacionesService.actualizarUbicacionData(this.ubicacion.id, ubicacionData).subscribe({
            next: (ubicacion: UbicacionDTO) => {
              this.notificationService.showSuccessMessage('Ubicación actualizada exitosamente');
              this.activeModal.close(ubicacion);
            },
            error: () => {
              this.notificationService.showError(
                'Error al actualizar ubicación',
                'No se pudo actualizar la ubicación. Por favor, intente nuevamente.'
              );
            }
          });
        } else {
          this.ubicacionesService.crearUbicacionData(ubicacionData).subscribe({
            next: (ubicacion: UbicacionDTO) => {
              this.notificationService.showSuccessMessage('Ubicación creada exitosamente');
              this.activeModal.close(ubicacion);
            },
            error: () => {
              this.notificationService.showError(
                'Error al crear ubicación',
                'No se pudo crear la ubicación. Por favor, intente nuevamente.'
              );
            }
          });
        }
      }
    } else {
      Object.keys(this.ubicacionForm.controls).forEach((key) => {
        this.ubicacionForm.get(key)?.markAsTouched();
      });
    }
  }
}
