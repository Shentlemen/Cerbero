import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { UbicacionesService } from '../../services/ubicaciones.service';
import { UbicacionDTO } from '../../interfaces/ubicacion.interface';

@Component({
  selector: 'app-asset-location-picker-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-header">
      <h4 class="modal-title">
        <i class="fas fa-map-marker-alt me-2"></i>
        Seleccionar Ubicación
      </h4>
      <button type="button" class="btn-close" (click)="modal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <div *ngIf="loading" class="text-center p-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
        <p class="mt-2">Cargando ubicaciones disponibles...</p>
      </div>

      <div *ngIf="error" class="alert alert-danger">
        {{ error }}
      </div>

      <div *ngIf="!loading && !error">
        <div class="mb-3">
          <label for="ubicacionSelect" class="form-label">Seleccione una ubicación:</label>
          <select class="form-select" id="ubicacionSelect" [(ngModel)]="ubicacionSeleccionada">
            <option [ngValue]="null">Seleccione una ubicación...</option>
            <option *ngFor="let ubicacion of ubicaciones" [ngValue]="ubicacion">
              {{ubicacion.nombreGerencia}} - {{ubicacion.nombreOficina}}
            </option>
          </select>
        </div>

        <div *ngIf="ubicacionSeleccionada" class="card mt-3">
          <div class="card-body">
            <h5 class="card-title">Detalles de la ubicación seleccionada</h5>
            <div class="detail-row">
              <div class="detail-label">
                <i class="fas fa-building"></i>
                Gerencia
              </div>
              <div class="detail-value">{{ubicacionSeleccionada.nombreGerencia}}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">
                <i class="fas fa-door-open"></i>
                Oficina
              </div>
              <div class="detail-value">{{ubicacionSeleccionada.nombreOficina}}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">
                <i class="fas fa-city"></i>
                Ciudad
              </div>
              <div class="detail-value">{{ubicacionSeleccionada.ciudad}}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">
                <i class="fas fa-map"></i>
                Departamento
              </div>
              <div class="detail-value">{{ubicacionSeleccionada.departamento}}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">
                <i class="fas fa-street-view"></i>
                Dirección
              </div>
              <div class="detail-value">{{ubicacionSeleccionada.direccion}}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">
                <i class="fas fa-building"></i>
                Piso
              </div>
              <div class="detail-value">{{ubicacionSeleccionada.piso}}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">
                <i class="fas fa-door-closed"></i>
                Puerta
              </div>
              <div class="detail-value">{{ubicacionSeleccionada.numeroPuerta}}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">
                <i class="fas fa-phone"></i>
                Interno
              </div>
              <div class="detail-value">{{ubicacionSeleccionada.interno}}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" (click)="modal.dismiss()">
        <i class="fas fa-times me-2"></i>
        Cancelar
      </button>
      <button type="button" class="btn btn-primary" (click)="guardar()" [disabled]="!ubicacionSeleccionada">
        <i class="fas fa-check me-2"></i>
        Guardar
      </button>
    </div>
  `,
  styles: [`
    .modal-header {
      background-color: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
      padding: 1rem;
    }
    .modal-title {
      color: #2c3e50;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .form-select {
      border-radius: 8px;
      border: 1px solid #ced4da;
      padding: 0.75rem;
      font-size: 1rem;
    }
    .card {
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border: none;
    }
    .card-body {
      padding: 1.5rem;
    }
    .card-title {
      color: #2c3e50;
      font-size: 1.2rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #f0f0f0;
    }
    .detail-row {
      display: flex;
      margin-bottom: 1rem;
      align-items: center;
    }
    .detail-label {
      flex: 0 0 150px;
      color: #6c757d;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .detail-value {
      flex: 1;
      color: #2c3e50;
      font-weight: 500;
    }
    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.3s ease;
      font-weight: 500;
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
    .alert {
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    .spinner-border {
      width: 3rem;
      height: 3rem;
    }
  `]
})
export class AssetLocationPickerModalComponent implements OnInit {
  @Input() ubicaciones: UbicacionDTO[] = [];
  ubicacionSeleccionada: UbicacionDTO | null = null;
  loading: boolean = false;
  error: string | null = null;

  constructor(
    public modal: NgbActiveModal,
    private ubicacionesService: UbicacionesService
  ) {}

  ngOnInit(): void {
    this.loading = false;
  }

  guardar(): void {
    if (this.ubicacionSeleccionada) {
      this.modal.close(this.ubicacionSeleccionada);
    }
  }
} 