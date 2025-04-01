import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Ubicacion } from '../../services/ubicaciones.service';

@Component({
  selector: 'app-location-picker-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-header bg-light">
      <h4 class="modal-title d-flex align-items-center gap-2">
        <i class="fas fa-map-marker-alt text-primary"></i>
        Seleccionar Ubicación
      </h4>
      <button type="button" class="btn-close" (click)="activeModal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <div *ngIf="loading" class="text-center p-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
        <p class="mt-2">Cargando ubicaciones...</p>
      </div>

      <div *ngIf="error" class="alert alert-danger">
        {{ error }}
      </div>

      <div *ngIf="!loading && !error">
        <div class="mb-3">
          <label for="ubicacion" class="form-label">Seleccione una ubicación:</label>
          <select class="form-select" id="ubicacion" [(ngModel)]="ubicacionSeleccionada">
            <option [ngValue]="null">Seleccione una ubicación...</option>
            <option *ngFor="let ubicacion of ubicaciones" [ngValue]="ubicacion">
              {{ubicacion.nombreGerencia}} - {{ubicacion.nombreOficina}} - {{ubicacion.ciudad}}
            </option>
          </select>
        </div>

        <div *ngIf="ubicacionSeleccionada" class="card mt-3">
          <div class="card-body">
            <h5 class="card-title">Detalles de la ubicación seleccionada</h5>
            <div class="row">
              <div class="col-md-6">
                <p><strong>Gerencia:</strong> {{ubicacionSeleccionada.nombreGerencia}}</p>
                <p><strong>Oficina:</strong> {{ubicacionSeleccionada.nombreOficina}}</p>
                <p><strong>Ciudad:</strong> {{ubicacionSeleccionada.ciudad}}</p>
                <p><strong>Departamento:</strong> {{ubicacionSeleccionada.departamento}}</p>
              </div>
              <div class="col-md-6">
                <p><strong>Dirección:</strong> {{ubicacionSeleccionada.direccion}}</p>
                <p><strong>Piso:</strong> {{ubicacionSeleccionada.piso}}</p>
                <p><strong>Puerta:</strong> {{ubicacionSeleccionada.numeroPuerta}}</p>
                <p><strong>Interno:</strong> {{ubicacionSeleccionada.interno}}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()">Cancelar</button>
      <button type="button" class="btn btn-primary" (click)="guardar()" [disabled]="!ubicacionSeleccionada">
        Guardar
      </button>
    </div>
  `,
  styles: [`
    .modal-header {
      background-color: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
    }
    .modal-title {
      color: #2c3e50;
      font-weight: 600;
    }
    .form-select {
      border-radius: 8px;
      border: 1px solid #ced4da;
      padding: 0.5rem;
    }
    .card {
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .card-title {
      color: #2c3e50;
      font-size: 1.1rem;
      font-weight: 600;
    }
    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
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
export class LocationPickerModalComponent implements OnInit {
  @Input() ubicaciones: Ubicacion[] = [];
  ubicacionSeleccionada: Ubicacion | null = null;
  loading: boolean = false;
  error: string | null = null;

  constructor(public activeModal: NgbActiveModal) {}

  ngOnInit() {
    this.loading = true;
    // Las ubicaciones ya vienen cargadas del componente padre
    this.loading = false;
  }

  guardar() {
    if (this.ubicacionSeleccionada) {
      this.activeModal.close(this.ubicacionSeleccionada);
    }
  }
} 