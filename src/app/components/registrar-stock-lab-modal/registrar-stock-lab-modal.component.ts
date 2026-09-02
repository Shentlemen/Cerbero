import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

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

      <p class="text-muted small mb-3">
        Para insumos del depósito (RAM, placas, discos, cables). No es un equipo: solo descripción y cantidad.
      </p>

      <form [formGroup]="form" (ngSubmit)="confirmar()">
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
    </div>
  `,
  styleUrls: ['../transferir-masa-modal/transferir-masa-modal.component.css']
})
export class RegistrarStockLabModalComponent {
  form: FormGroup;

  constructor(
    public activeModal: NgbActiveModal,
    private formBuilder: FormBuilder
  ) {
    this.form = this.formBuilder.group({
      descripcion: ['', [Validators.required, Validators.maxLength(255)]],
      cantidad: [1, [Validators.required, Validators.min(1)]]
    });
  }

  confirmar(): void {
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
    this.activeModal.close({
      descripcion,
      cantidad: Math.floor(cantidad)
    });
  }
}
