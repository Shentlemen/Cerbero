import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AlmacenService, Almacen } from '../../services/almacen.service';

@Component({
  selector: 'app-transferir-equipo-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="modal-header bg-light">
      <h4 class="modal-title d-flex align-items-center gap-2">
        <i class="fas fa-exchange-alt text-primary"></i>
        Transferir Equipo
      </h4>
      <button type="button" class="btn-close" (click)="activeModal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <div class="equipo-info mb-3 p-3 bg-light rounded">
        <h6 class="mb-1"><strong>{{ item?.name || item?.item?.nombreItem || 'Equipo' }}</strong></h6>
        <small class="text-muted">{{ getTipoEquipo() }}</small>
      </div>

      <form [formGroup]="transferForm" (ngSubmit)="confirmarTransferencia()">
        <div class="mb-3">
          <label class="form-label">Almacén Destino *</label>
          <select 
            class="form-select" 
            formControlName="almacenId"
            (change)="onAlmacenChange()">
            <option value="">Seleccione un almacén...</option>
            <optgroup label="Almacenes Especiales">
              <option [value]="'cementerio'" *ngIf="almacenCementerio">
                Cementerio ({{ almacenCementerio.numero }} - {{ almacenCementerio.nombre }})
              </option>
              <option [value]="'laboratorio'" *ngIf="almacenLaboratorio">
                Almacén Lab ({{ almacenLaboratorio.numero }} - {{ almacenLaboratorio.nombre }})
              </option>
            </optgroup>
            <optgroup label="Almacenes Regulares" *ngIf="almacenesRegulares.length > 0">
              <option *ngFor="let almacen of almacenesRegulares" [value]="almacen.id">
                {{ almacen.numero }} - {{ almacen.nombre }}
              </option>
            </optgroup>
          </select>
          <div *ngIf="transferForm.get('almacenId')?.invalid && transferForm.get('almacenId')?.touched" 
               class="text-danger mt-1 small">
            <i class="fas fa-exclamation-circle me-1"></i>
            Debe seleccionar un almacén destino
          </div>
        </div>

        <!-- Campos para almacén regular -->
        <div *ngIf="esAlmacenRegular()" class="row g-3 mb-3">
          <div class="col-md-6">
            <label class="form-label">Estantería *</label>
            <input 
              type="text" 
              class="form-control" 
              formControlName="estanteria"
              placeholder="Ej: A, B, Estantería 1...">
            <div *ngIf="transferForm.get('estanteria')?.invalid && transferForm.get('estanteria')?.touched" 
                 class="text-danger mt-1 small">
              <i class="fas fa-exclamation-circle me-1"></i>
              La estantería es requerida
            </div>
          </div>
          <div class="col-md-6">
            <label class="form-label">Estante *</label>
            <input 
              type="text" 
              class="form-control" 
              formControlName="estante"
              placeholder="Ej: 1, 2, Superior...">
            <div *ngIf="transferForm.get('estante')?.invalid && transferForm.get('estante')?.touched" 
                 class="text-danger mt-1 small">
              <i class="fas fa-exclamation-circle me-1"></i>
              El estante es requerido
            </div>
          </div>
        </div>

        <!-- Campo de observaciones (solo para cementerio y laboratorio) -->
        <div *ngIf="esAlmacenEspecial()" class="mb-3">
          <label class="form-label">Observaciones</label>
          <textarea 
            class="form-control" 
            formControlName="observaciones"
            rows="3"
            placeholder="Ingrese observaciones sobre la transferencia..."
            maxlength="500"></textarea>
          <small class="text-muted">
            {{ transferForm.get('observaciones')?.value?.length || 0 }}/500 caracteres
          </small>
        </div>

        <div class="d-flex justify-content-end gap-2 mt-4">
          <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()">
            <i class="fas fa-times me-1"></i>
            Cancelar
          </button>
          <button 
            type="submit" 
            class="btn btn-primary" 
            [disabled]="!transferForm.valid || procesando">
            <i class="fas" [ngClass]="procesando ? 'fa-spinner fa-spin' : 'fa-exchange-alt'"></i>
            {{ procesando ? 'Transferiendo...' : 'Transferir' }}
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
    .form-control, .form-select {
      border-radius: 8px;
      border: 1px solid #ced4da;
      padding: 0.75rem;
    }
    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      transition: all 0.3s ease;
    }
    .btn-primary {
      background: #0d6efd;
      border: none;
    }
    .btn-primary:disabled {
      background: #E2E8F0;
      color: #94A3B8;
    }
    .btn-primary:not(:disabled):hover {
      background: #0b5ed7;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(13, 110, 253, 0.25);
    }
    .btn-secondary {
      background: #6c757d;
      border: none;
    }
    .btn-secondary:hover {
      background: #5a6268;
    }
    .equipo-info {
      border-left: 4px solid #0d6efd;
    }
  `]
})
export class TransferirEquipoModalComponent implements OnInit {
  item: any;
  almacenes: Almacen[] = [];
  almacenCementerio: Almacen | null = null;
  almacenLaboratorio: Almacen | null = null;
  almacenesRegulares: Almacen[] = [];
  transferForm: FormGroup;
  procesando: boolean = false;

  constructor(
    public activeModal: NgbActiveModal,
    private formBuilder: FormBuilder,
    private almacenService: AlmacenService
  ) {
    this.transferForm = this.formBuilder.group({
      almacenId: ['', Validators.required],
      estanteria: [''],
      estante: [''],
      observaciones: ['']
    });
  }

  ngOnInit() {
    this.cargarAlmacenes();
  }

  cargarAlmacenes() {
    this.almacenService.getAllAlmacenes().subscribe({
      next: (almacenes: Almacen[]) => {
        this.almacenes = almacenes;
        
        // Identificar almacenes especiales
        this.almacenCementerio = almacenes.find(a => 
          a.numero?.toLowerCase().trim() === 'alm01' || 
          a.numero?.toLowerCase().trim() === 'alm 01' ||
          a.nombre?.toLowerCase().includes('subsuelo')
        ) || null;

        this.almacenLaboratorio = almacenes.find(a => 
          a.numero?.toLowerCase().trim() === 'alm05' || 
          a.numero?.toLowerCase().trim() === 'alm 05' ||
          a.nombre?.toLowerCase().includes('pañol 3')
        ) || null;

        // Filtrar almacenes regulares (excluyendo cementerio y laboratorio)
        const idsEspeciales = [
          this.almacenCementerio?.id,
          this.almacenLaboratorio?.id
        ].filter(id => id !== undefined && id !== null);

        this.almacenesRegulares = almacenes.filter(a => 
          !idsEspeciales.includes(a.id)
        );
      },
      error: (error) => {
        console.error('Error al cargar almacenes:', error);
      }
    });
  }

  onAlmacenChange() {
    const almacenId = this.transferForm.get('almacenId')?.value;
    
    if (this.esAlmacenRegular()) {
      // Validar estantería y estante para almacenes regulares
      this.transferForm.get('estanteria')?.setValidators([Validators.required]);
      this.transferForm.get('estante')?.setValidators([Validators.required]);
      this.transferForm.get('observaciones')?.clearValidators();
    } else {
      // Para almacenes especiales, no se requiere estantería ni estante
      this.transferForm.get('estanteria')?.clearValidators();
      this.transferForm.get('estante')?.clearValidators();
      this.transferForm.get('observaciones')?.clearValidators();
    }
    
    this.transferForm.get('estanteria')?.updateValueAndValidity();
    this.transferForm.get('estante')?.updateValueAndValidity();
    this.transferForm.get('observaciones')?.updateValueAndValidity();
  }

  esAlmacenRegular(): boolean {
    const almacenId = this.transferForm.get('almacenId')?.value;
    if (!almacenId || almacenId === 'cementerio' || almacenId === 'laboratorio') {
      return false;
    }
    return !isNaN(Number(almacenId));
  }

  esAlmacenEspecial(): boolean {
    const almacenId = this.transferForm.get('almacenId')?.value;
    return almacenId === 'cementerio' || almacenId === 'laboratorio';
  }

  getTipoEquipo(): string {
    if (this.item?.tipo) {
      return this.item.tipo === 'EQUIPO' ? 'Equipo' : 'Dispositivo';
    }
    if (this.item?.tipoEquipo) {
      return this.item.tipoEquipo === 'EQUIPO' ? 'Equipo' : 'Dispositivo';
    }
    return 'Equipo';
  }

  confirmarTransferencia() {
    if (this.transferForm.valid) {
      const formData = this.transferForm.value;
      
      // Preparar datos de transferencia
      const transferData: any = {
        almacenId: formData.almacenId,
        observaciones: formData.observaciones || ''
      };

      if (this.esAlmacenRegular()) {
        transferData.estanteria = formData.estanteria;
        transferData.estante = formData.estante;
      }

      // Determinar si es cementerio o laboratorio
      if (formData.almacenId === 'cementerio' && this.almacenCementerio) {
        transferData.almacenId = this.almacenCementerio.id;
        transferData.tipoAlmacen = 'cementerio';
      } else if (formData.almacenId === 'laboratorio' && this.almacenLaboratorio) {
        transferData.almacenId = this.almacenLaboratorio.id;
        transferData.tipoAlmacen = 'laboratorio';
      } else {
        transferData.tipoAlmacen = 'regular';
      }

      this.activeModal.close(transferData);
    }
  }
}

