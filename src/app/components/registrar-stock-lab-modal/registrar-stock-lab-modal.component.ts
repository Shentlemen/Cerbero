import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

export type ModoRegistroStockLab = 'insumos' | 'pcs';

export interface RegistroStockInsumosResult {
  tipo: 'insumos';
  descripcion: string;
  cantidad: number;
}

export interface RegistroStockPcsResult {
  tipo: 'pcs';
  nombres: string[];
}

export type RegistroStockLabResult = RegistroStockInsumosResult | RegistroStockPcsResult;

@Component({
  selector: 'app-registrar-stock-lab-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="modal-body transferir-modal-body transferir-masa-body">
      <div class="transferir-box-header">
        <h4 class="modal-title d-flex align-items-center gap-2 mb-0">
          <i class="fas fa-boxes text-dark"></i>
          Registrar stock
        </h4>
        <button type="button" class="btn-close" (click)="activeModal.dismiss()"></button>
      </div>

      <div class="btn-group mb-3" role="tablist" aria-label="Tipo de registro">
        <button
          type="button"
          class="btn"
          [class.btn-dark]="modo === 'insumos'"
          [class.btn-outline-secondary]="modo !== 'insumos'"
          (click)="setModo('insumos')">
          Insumos
        </button>
        <button
          type="button"
          class="btn"
          [class.btn-dark]="modo === 'pcs'"
          [class.btn-outline-secondary]="modo !== 'pcs'"
          (click)="setModo('pcs')">
          PCs
        </button>
      </div>

      <p class="text-muted small mb-3" *ngIf="modo === 'insumos'">
        Para RAM, placas, discos, cables, etc. Indicá descripción y cantidad.
      </p>
      <p class="text-muted small mb-3" *ngIf="modo === 'pcs'">
        Pegá los nombres de PC separados por espacio (también coma o salto de línea).
        Cada nombre se registra como una PC (cantidad 1).
      </p>

      <form *ngIf="modo === 'insumos'" [formGroup]="form" (ngSubmit)="confirmarInsumos()">
        <div class="mb-3">
          <label class="form-label">Descripción *</label>
          <input
            type="text"
            class="form-control"
            formControlName="descripcion"
            maxlength="255"
            placeholder="Memoria RAM 8GB DDR4"
            autocomplete="off">
          <div class="text-danger small mt-1" *ngIf="form.get('descripcion')?.touched && form.get('descripcion')?.invalid">
            La descripción es obligatoria.
          </div>
        </div>
        <div class="mb-4">
          <label class="form-label">Cantidad *</label>
          <input
            type="number"
            class="form-control"
            formControlName="cantidad"
            min="1"
            step="1">
          <div class="text-danger small mt-1" *ngIf="form.get('cantidad')?.touched && form.get('cantidad')?.invalid">
            Indicá una cantidad de 1 o más.
          </div>
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()">
            Cancelar
          </button>
          <button type="submit" class="btn btn-transferir" [disabled]="form.invalid">
            <i class="fas fa-plus me-1"></i>
            Registrar
          </button>
        </div>
      </form>

      <ng-container *ngIf="modo === 'pcs'">
        <div class="mb-3">
          <label class="form-label">Nombres de PC *</label>
          <textarea
            class="form-control"
            [(ngModel)]="nombresPegados"
            rows="4"
            placeholder="pc1234 pc5678 pc9012"
            autocomplete="off"></textarea>
          <p class="text-muted small mt-1 mb-0">
            Cantidad a registrar: <strong>{{ nombresDetectados.length }}</strong>
          </p>
        </div>
        <div class="mb-3" *ngIf="nombresDetectados.length > 0">
          <div class="d-flex flex-wrap gap-1">
            <span class="badge bg-secondary" *ngFor="let nombre of nombresDetectados">{{ nombre }}</span>
          </div>
        </div>
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()">
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-transferir"
            [disabled]="nombresDetectados.length === 0"
            (click)="confirmarPcs()">
            <i class="fas fa-plus me-1"></i>
            Registrar{{ nombresDetectados.length ? ' (' + nombresDetectados.length + ')' : '' }}
          </button>
        </div>
      </ng-container>
    </div>
  `,
  styleUrls: ['../transferir-masa-modal/transferir-masa-modal.component.css']
})
export class RegistrarStockLabModalComponent {
  modo: ModoRegistroStockLab = 'insumos';
  form: FormGroup;
  nombresPegados = '';

  constructor(
    public activeModal: NgbActiveModal,
    private formBuilder: FormBuilder
  ) {
    this.form = this.formBuilder.group({
      descripcion: ['', [Validators.required, Validators.maxLength(255)]],
      cantidad: [1, [Validators.required, Validators.min(1)]]
    });
  }

  setModo(modo: ModoRegistroStockLab): void {
    this.modo = modo;
  }

  get nombresDetectados(): string[] {
    const vistos = new Set<string>();
    const nombres: string[] = [];
    for (const bruto of (this.nombresPegados || '').split(/[\s,;]+/)) {
      const nombre = bruto.trim();
      if (!nombre || nombre.length > 255) {
        continue;
      }
      const clave = nombre.toLowerCase();
      if (vistos.has(clave)) {
        continue;
      }
      vistos.add(clave);
      nombres.push(nombre);
    }
    return nombres;
  }

  confirmarInsumos(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const descripcion = String(this.form.value.descripcion || '').trim();
    const cantidad = Number(this.form.value.cantidad);
    if (!descripcion || !Number.isFinite(cantidad) || cantidad < 1) {
      this.form.markAllAsTouched();
      return;
    }
    const result: RegistroStockInsumosResult = {
      tipo: 'insumos',
      descripcion,
      cantidad: Math.floor(cantidad)
    };
    this.activeModal.close(result);
  }

  confirmarPcs(): void {
    const nombres = this.nombresDetectados;
    if (!nombres.length) {
      return;
    }
    const result: RegistroStockPcsResult = {
      tipo: 'pcs',
      nombres
    };
    this.activeModal.close(result);
  }
}
