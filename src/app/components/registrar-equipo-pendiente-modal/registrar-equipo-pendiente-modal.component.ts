import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-registrar-equipo-pendiente-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="modal-body transferir-modal-body transferir-masa-body">
      <div class="transferir-box-header">
        <h4 class="modal-title d-flex align-items-center gap-2 mb-0">
          <i class="fas fa-desktop text-dark"></i>
          Registrar equipo pendiente
        </h4>
        <button type="button" class="btn-close" (click)="activeModal.dismiss()"></button>
      </div>

      <p class="text-muted small mb-3">
        Anotá el nombre de una PC que todavía no pasó por OCS. Queda en el almacén laboratorio
        y, cuando OCS la detecte con el mismo nombre, se completan los datos.
      </p>

      <form [formGroup]="form" (ngSubmit)="confirmar()">
        <div class="mb-3">
          <label class="form-label">Nombre del equipo *</label>
          <input
            type="text"
            class="form-control"
            formControlName="name"
            maxlength="255"
            placeholder="14506"
            autocomplete="off">
          <div class="text-danger small mt-1" *ngIf="form.get('name')?.touched && form.get('name')?.invalid">
            El nombre es obligatorio.
          </div>
        </div>
        <div class="mb-4">
          <label class="form-label">Observaciones</label>
          <textarea
            class="form-control"
            formControlName="observaciones"
            rows="2"
            maxlength="500"
            placeholder="Opcional"></textarea>
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
export class RegistrarEquipoPendienteModalComponent {
  form: FormGroup;

  constructor(
    public activeModal: NgbActiveModal,
    private formBuilder: FormBuilder
  ) {
    this.form = this.formBuilder.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      observaciones: ['', Validators.maxLength(500)]
    });
  }

  confirmar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const name = String(this.form.value.name || '').trim();
    if (!name) {
      this.form.get('name')?.setValue('');
      this.form.get('name')?.markAsTouched();
      return;
    }
    this.activeModal.close({
      name,
      observaciones: String(this.form.value.observaciones || '').trim()
    });
  }
}
