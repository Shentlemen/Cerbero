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
  template: `
    <div class="modal-header bg-light">
      <h4 class="modal-title d-flex align-items-center gap-2">
        <i class="fas fa-map-marker-alt text-pastel"></i>
        Nueva Ubicación
      </h4>
      <button type="button" class="btn-close" (click)="activeModal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <form [formGroup]="ubicacionForm" (ngSubmit)="guardarUbicacion()" class="row g-3">
        <div class="col-md-6">
          <label class="form-label">Gerencia</label>
          <input type="text" class="form-control shadow-sm" formControlName="nombreGerencia">
        </div>
        <div class="col-md-6">
          <label class="form-label">Oficina</label>
          <input type="text" class="form-control shadow-sm" formControlName="nombreOficina">
        </div>
        <div class="col-md-6">
          <label class="form-label">Ciudad *</label>
          <input type="text" class="form-control shadow-sm" formControlName="ciudad">
        </div>
        <div class="col-md-6">
          <label class="form-label">Departamento *</label>
          <input type="text" class="form-control shadow-sm" formControlName="departamento">
        </div>
        <div class="col-12">
          <label class="form-label">Dirección *</label>
          <input type="text" class="form-control shadow-sm" formControlName="direccion">
        </div>
        <div class="col-md-4">
          <label class="form-label">Piso</label>
          <input type="text" class="form-control shadow-sm" formControlName="piso">
        </div>
        <div class="col-md-4">
          <label class="form-label">Número de Puerta</label>
          <input type="text" class="form-control shadow-sm" formControlName="numeroPuerta">
        </div>
        <div class="col-md-4">
          <label class="form-label">Interno</label>
          <input type="text" class="form-control shadow-sm" formControlName="interno">
        </div>
        <div class="col-12">
          <label class="form-label">Subnet *</label>
          <div class="subnet-selector-container">
            <input 
              type="text" 
              class="form-control shadow-sm" 
              placeholder="Escriba para filtrar subnets..."
              (input)="filtrarSubnets($event)"
              (focus)="mostrarTodasSubnets()"
              (blur)="cerrarDropdown()"
              [value]="subnetFiltro"
              autocomplete="off">
            <div class="subnet-dropdown" *ngIf="subnetsFiltradas.length > 0 && mostrarDropdown">
              <div 
                *ngFor="let subnet of subnetsFiltradas" 
                class="subnet-option"
                (click)="seleccionarSubnet(subnet)">
                <span class="subnet-name">{{subnet.name}}</span>
                <span class="subnet-id">- {{subnet.id}}</span>
              </div>
            </div>
          </div>
          <div *ngIf="ubicacionForm.get('idSubnet')?.errors?.['required'] && ubicacionForm.get('idSubnet')?.touched" 
               class="text-danger mt-1 small">
            <i class="fas fa-exclamation-circle me-1"></i>
            La subnet es requerida
          </div>
          <div *ngIf="subnetSeleccionada" class="subnet-seleccionada mt-2">
            <small class="text-muted">
              <i class="fas fa-check-circle text-success me-1"></i>
              Subnet seleccionada: <strong>{{subnetSeleccionada.name}} - {{subnetSeleccionada.id}}</strong>
            </small>
          </div>
        </div>
        <div class="col-12 mt-4">
          <button type="submit" 
                  class="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2" 
                  [disabled]="!ubicacionForm.valid">
            <i class="fas fa-save text-pastel"></i>
            Guardar Ubicación
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .modal-header {
      background: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
    }
    .modal-title {
      color: #2c3e50;
      font-weight: 600;
    }
    .text-pastel {
      color: #41A1AF;
    }
    .form-control {
      border-radius: 8px;
      border: 1px solid #ced4da;
      padding: 0.75rem;
    }
    .card {
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .card-title {
      color: #2c3e50;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    .btn-primary {
      background: #41A1AF;
      border: none;
    }
    .btn-primary:disabled {
      background: #E2E8F0;
      color: #94A3B8;
    }
    .btn-primary:not(:disabled):hover {
      background: #3A8F9C;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(65, 161, 175, 0.25);
    }
    .btn-secondary {
      background: #6c757d;
      border: none;
    }
    .btn-secondary:hover {
      background: #5a6268;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(108, 117, 125, 0.25);
    }
    
    /* Estilos para el selector de subnets */
    .subnet-selector-container {
      position: relative;
    }
    
    .subnet-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      margin-top: 2px;
    }
    
    .subnet-option {
      padding: 0.75rem 1rem;
      cursor: pointer;
      border-bottom: 1px solid #f8f9fa;
      transition: all 0.2s ease;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .subnet-option:last-child {
      border-bottom: none;
    }
    
    .subnet-option:hover {
      background-color: #f8f9fa;
    }
    
    .subnet-option:active {
      background-color: #e9ecef;
    }
    
    .subnet-name {
      font-weight: 500;
      color: #2c3e50;
    }
    
    .subnet-id {
      color: #6c757d;
      font-size: 0.9rem;
      font-weight: 600;
    }
    
    .subnet-seleccionada {
      padding: 0.5rem;
      background-color: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #e9ecef;
    }
    
    .subnet-seleccionada strong {
      color: #2c3e50;
    }
  `]
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
      direccion: ['', Validators.required],
      piso: [''],
      numeroPuerta: [''],
      interno: [''],
      idSubnet: [null, Validators.required]
    });
  }

  ngOnInit() {
    console.log('Iniciando LocationSelectorModalComponent');
    this.cargarSubnets();
    if (this.ubicacion) {
      console.log('Cargando datos de ubicación:', this.ubicacion);
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
      
      // Si hay una subnet seleccionada, buscar su información completa
      if (this.ubicacion.idSubnet) {
        this.subnetService.getSubnets().subscribe({
          next: (subnets) => {
            const subnetEncontrada = subnets.find(s => s.pk === this.ubicacion?.idSubnet);
            if (subnetEncontrada) {
              this.subnetSeleccionada = subnetEncontrada;
              this.subnetFiltro = `${subnetEncontrada.name} - ${subnetEncontrada.id}`;
            }
          }
        });
      }
      
      console.log('Formulario actualizado:', this.ubicacionForm.value);
    }
  }

  cargarSubnets() {
    this.subnetService.getSubnets().subscribe({
      next: (subnets) => {
        console.log('Subnets cargadas:', subnets);
        this.subnets = subnets;
        this.subnetsFiltradas = [...subnets]; // Inicializar subnets filtradas
      },
      error: (error) => {
        console.error('Error al cargar subnets:', error);
        this.notificationService.showError(
          'Error al Cargar Subnets',
          'No se pudieron cargar las subnets. Por favor, intente nuevamente.'
        );
      }
    });
  }

  filtrarSubnets(event: any) {
    const filtro = event.target.value.toLowerCase();
    this.subnetFiltro = filtro;
    
    if (filtro.trim() === '') {
      this.subnetsFiltradas = [...this.subnets];
      this.mostrarDropdown = true;
    } else {
      this.subnetsFiltradas = this.subnets.filter(subnet => 
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
          this.ubicacionesService.actualizarUbicacionEquipo(
            this.ubicacion.hardwareId || 0,
            ubicacionData
          ).subscribe({
            next: (ubicacion: UbicacionDTO) => {
              console.log('Ubicación asignada:', ubicacion);
              this.notificationService.showSuccessMessage('Ubicación asignada exitosamente');
              this.activeModal.close(ubicacion);
            },
            error: (error: any) => {
              console.error('Error al asignar ubicación:', error);
              this.notificationService.showError(
                'Error al Asignar Ubicación',
                'No se pudo asignar la ubicación. Por favor, intente nuevamente.'
              );
            }
          });
        } else {
          this.ubicacionesService.crearUbicacionEquipo(ubicacionData).subscribe({
            next: (ubicacion: UbicacionDTO) => {
              console.log('Ubicación asignada:', ubicacion);
              this.notificationService.showSuccessMessage('Ubicación asignada exitosamente');
              this.activeModal.close(ubicacion);
            },
            error: (error: any) => {
              console.error('Error al asignar ubicación:', error);
              this.notificationService.showError(
                'Error al Asignar Ubicación',
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
              console.log('Ubicación actualizada:', ubicacion);
              this.notificationService.showSuccessMessage('Ubicación actualizada exitosamente');
              this.activeModal.close(ubicacion);
            },
            error: (error: any) => {
              console.error('Error al actualizar ubicación:', error);
              this.notificationService.showError(
                'Error al Actualizar Ubicación',
                'No se pudo actualizar la ubicación. Por favor, intente nuevamente.'
              );
            }
          });
        } else {
          this.ubicacionesService.crearUbicacionData(ubicacionData).subscribe({
            next: (ubicacion: UbicacionDTO) => {
              console.log('Ubicación creada:', ubicacion);
              this.notificationService.showSuccessMessage('Ubicación creada exitosamente');
              this.activeModal.close(ubicacion);
            },
            error: (error: any) => {
              console.error('Error al crear ubicación:', error);
              this.notificationService.showError(
                'Error al Crear Ubicación',
                'No se pudo crear la ubicación. Por favor, intente nuevamente.'
              );
            }
          });
        }
      }
    }
  }
} 