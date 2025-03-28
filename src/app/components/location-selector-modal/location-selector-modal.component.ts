import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { UbicacionesService, Ubicacion } from '../../services/ubicaciones.service';
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
  `]
})
export class LocationSelectorModalComponent implements OnInit {
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
    this.cargarSubnets();
  }

  cargarSubnets() {
    this.subnetService.getSubnets().subscribe({
      next: (subnets) => {
        this.subnets = subnets;
      },
      error: (error) => {
        console.error('Error al cargar subnets:', error);
      }
    });
  }

  guardarUbicacion() {
    if (this.ubicacionForm.valid) {
      const nuevaUbicacion: Ubicacion = {
        nombreGerencia: this.ubicacionForm.get('nombreGerencia')?.value?.trim(),
        nombreOficina: this.ubicacionForm.get('nombreOficina')?.value?.trim(),
        ciudad: this.ubicacionForm.get('ciudad')?.value?.trim(),
        departamento: this.ubicacionForm.get('departamento')?.value?.trim(),
        direccion: this.ubicacionForm.get('direccion')?.value?.trim(),
        piso: this.ubicacionForm.get('piso')?.value?.trim(),
        numeroPuerta: this.ubicacionForm.get('numeroPuerta')?.value?.trim(),
        interno: this.ubicacionForm.get('interno')?.value?.trim(),
        idSubnet: this.ubicacionForm.get('idSubnet')?.value
      };

      this.ubicacionesService.crearUbicacionSimple(nuevaUbicacion).subscribe({
        next: (ubicacion) => {
          console.log('Ubicación creada:', ubicacion);
          this.activeModal.close(ubicacion);
        },
        error: (error) => {
          console.error('Error al crear ubicación:', error);
          alert('Error al crear la ubicación. Por favor, intente nuevamente.');
        }
      });
    }
  }
} 