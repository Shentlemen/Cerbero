import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { UbicacionesService } from '../../services/ubicaciones.service';
import { UbicacionDTO } from '../../interfaces/ubicacion.interface';
import { SubnetService, SubnetDTO } from '../../services/subnet.service';

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
          <select class="form-control shadow-sm" formControlName="idSubnet">
            <option [ngValue]="null">Seleccione una subnet</option>
            <option *ngFor="let subnet of subnets" [ngValue]="subnet.pk">
              {{subnet.name}}
            </option>
          </select>
          <div *ngIf="ubicacionForm.get('idSubnet')?.errors?.['required'] && ubicacionForm.get('idSubnet')?.touched" 
               class="text-danger mt-1 small">
            <i class="fas fa-exclamation-circle me-1"></i>
            La subnet es requerida
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
  `]
})
export class LocationSelectorModalComponent implements OnInit {
  @Input() ubicacion?: UbicacionDTO;
  @Output() ubicacionSeleccionada = new EventEmitter<UbicacionDTO>();
  ubicacionForm: FormGroup;
  subnets: SubnetDTO[] = [];

  constructor(
    public activeModal: NgbActiveModal,
    private formBuilder: FormBuilder,
    private ubicacionesService: UbicacionesService,
    private subnetService: SubnetService
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
      // Si estamos en modo edición, cargar los datos de la ubicación
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
      console.log('Formulario actualizado:', this.ubicacionForm.value);
    }
  }

  cargarSubnets() {
    this.subnetService.getSubnets().subscribe({
      next: (subnets) => {
        console.log('Subnets cargadas:', subnets);
        this.subnets = subnets;
      },
      error: (error) => {
        console.error('Error al cargar subnets:', error);
        alert('Error al cargar las subnets. Por favor, intente nuevamente.');
      }
    });
  }

  guardarUbicacion() {
    if (this.ubicacionForm.valid) {
      const nuevaUbicacion = {
        id: this.ubicacion?.id || 0,
        hardwareId: this.ubicacion?.hardwareId || 0,
        tipo: 'EQUIPO' as const
      };

      this.ubicacionesService.crearUbicacionEquipo(nuevaUbicacion).subscribe({
        next: (ubicacion: UbicacionDTO) => {
          console.log('Ubicación creada:', ubicacion);
          this.activeModal.close(ubicacion);
        },
        error: (error: any) => {
          console.error('Error al crear ubicación:', error);
          alert('Error al crear la ubicación. Por favor, intente nuevamente.');
        }
      });
    }
  }
} 