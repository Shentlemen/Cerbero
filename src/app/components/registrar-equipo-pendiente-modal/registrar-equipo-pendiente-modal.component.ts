import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

export type ModoRegistroPendiente = 'uno' | 'varios';

export interface RegistroPendienteUnoResult {
  modo: 'uno';
  name: string;
  observaciones?: string;
}

export interface RegistroPendienteVariosResult {
  modo: 'varios';
  names: string[];
  observaciones?: string;
}

export type RegistroPendienteResult = RegistroPendienteUnoResult | RegistroPendienteVariosResult;

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

      <div class="btn-group mb-3" role="group" aria-label="Modo de registro">
        <button
          type="button"
          class="btn"
          [class.btn-dark]="modo === 'uno'"
          [class.btn-outline-secondary]="modo !== 'uno'"
          (click)="setModo('uno')">
          Uno
        </button>
        <button
          type="button"
          class="btn"
          [class.btn-dark]="modo === 'varios'"
          [class.btn-outline-secondary]="modo !== 'varios'"
          (click)="setModo('varios')">
          Varios
        </button>
      </div>

      <p class="text-muted small mb-3" *ngIf="modo === 'uno'">
        Anotá el nombre de una PC que todavía no pasó por OCS. Queda en el almacén laboratorio
        y, cuando OCS la detecte con el mismo nombre, se completan los datos.
      </p>
      <p class="text-muted small mb-3" *ngIf="modo === 'varios'">
        Pegá varios nombres de equipos separados por espacio, coma o salto de línea.
        Cada uno se registra como pendiente de OCS.
      </p>

      <form *ngIf="modo === 'uno'" [formGroup]="form" (ngSubmit)="confirmarUno()">
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

      <ng-container *ngIf="modo === 'varios'">
        <div class="mb-3">
          <label class="form-label">Observaciones (opcional, para todos)</label>
          <textarea
            class="form-control"
            [(ngModel)]="observacionesMasa"
            rows="2"
            maxlength="500"
            placeholder="Opcional"></textarea>
        </div>

        <div class="transferir-masa-grid">
          <div class="transferir-masa-pane">
            <div class="transferir-masa-pane-header">
              <strong>Detectados</strong>
              <span class="text-muted small">{{ tokensDetectados.length }}</span>
              <button
                type="button"
                class="btn btn-sm transferir-masa-select-all"
                (click)="seleccionarTodoDetectado()"
                [disabled]="tokensDetectados.length === 0">
                {{ todosDetectadosSeleccionados ? 'Quitar visibles' : 'Seleccionar todo' }}
              </button>
            </div>
            <textarea
              class="form-control form-control-sm mb-1"
              [(ngModel)]="pegado"
              rows="3"
              placeholder="14506 14530 14801 — o pegá varios separados por espacio, coma o salto de línea"
              autocomplete="off"></textarea>
            <p class="text-muted small mb-2 transferir-masa-search-hint">
              Pegá el lote de una. Luego usá <strong>Seleccionar todo</strong> para armar el registro.
            </p>
            <div class="transferir-masa-list" *ngIf="tokensDetectados.length > 0; else vacioDetectados">
              <label
                class="transferir-masa-row"
                *ngFor="let token of tokensDetectados; trackBy: trackByToken"
                [class.is-selected]="isSelected(token)">
                <input
                  type="checkbox"
                  class="form-check-input"
                  [checked]="isSelected(token)"
                  (change)="onCheckboxChange(token, $event)">
                <span class="transferir-masa-name" [attr.title]="token">{{ token }}</span>
              </label>
            </div>
            <ng-template #vacioDetectados>
              <p class="text-muted small mb-0 py-3 text-center">Pegá nombres arriba para detectar el lote.</p>
            </ng-template>
          </div>

          <div class="transferir-masa-pane">
            <div class="transferir-masa-pane-header">
              <strong>A registrar</strong>
              <span class="text-muted small">{{ selectedKeys.length }}</span>
            </div>
            <div class="transferir-masa-list" *ngIf="selectedKeys.length > 0; else vacioSel">
              <div
                class="transferir-masa-row is-picked"
                *ngFor="let name of selectedKeys; trackBy: trackByToken">
                <span class="transferir-masa-name" [attr.title]="name">{{ name }}</span>
                <button
                  type="button"
                  class="btn btn-sm btn-link transferir-masa-remove"
                  (click)="quitarSeleccionado(name)"
                  title="Quitar de la lista">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
            <ng-template #vacioSel>
              <p class="text-muted small mb-0 py-3 text-center">Marcá los equipos de la izquierda para armar el lote.</p>
            </ng-template>
          </div>
        </div>

        <div class="d-flex justify-content-end gap-2 mt-4">
          <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()">
            <i class="fas fa-times me-1"></i>
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-transferir"
            [disabled]="selectedKeys.length === 0"
            (click)="confirmarVarios()">
            <i class="fas fa-plus me-1"></i>
            Registrar{{ selectedKeys.length ? ' (' + selectedKeys.length + ')' : '' }}
          </button>
        </div>
      </ng-container>
    </div>
  `,
  styleUrls: ['../transferir-masa-modal/transferir-masa-modal.component.css']
})
export class RegistrarEquipoPendienteModalComponent {
  modo: ModoRegistroPendiente = 'uno';
  form: FormGroup;
  pegado = '';
  selectedKeys: string[] = [];
  observacionesMasa = '';

  constructor(
    public activeModal: NgbActiveModal,
    private formBuilder: FormBuilder
  ) {
    this.form = this.formBuilder.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      observaciones: ['', Validators.maxLength(500)]
    });
  }

  setModo(modo: ModoRegistroPendiente): void {
    this.modo = modo;
  }

  get tokensDetectados(): string[] {
    const vistos = new Set<string>();
    const tokens: string[] = [];
    for (const bruto of (this.pegado || '').split(/[\s,;]+/)) {
      const token = bruto.trim();
      if (!token || token.length > 255) {
        continue;
      }
      const clave = token.toLowerCase();
      if (vistos.has(clave)) {
        continue;
      }
      vistos.add(clave);
      tokens.push(token);
    }
    return tokens;
  }

  get todosDetectadosSeleccionados(): boolean {
    const tokens = this.tokensDetectados;
    return tokens.length > 0 && tokens.every((t) => this.isSelected(t));
  }

  isSelected(token: string): boolean {
    const clave = token.toLowerCase();
    return this.selectedKeys.some((k) => k.toLowerCase() === clave);
  }

  onCheckboxChange(token: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.agregarSeleccionado(token);
    } else {
      this.quitarSeleccionado(token);
    }
  }

  seleccionarTodoDetectado(): void {
    const tokens = this.tokensDetectados;
    if (!tokens.length) {
      return;
    }
    if (this.todosDetectadosSeleccionados) {
      const quitar = new Set(tokens.map((t) => t.toLowerCase()));
      this.selectedKeys = this.selectedKeys.filter((k) => !quitar.has(k.toLowerCase()));
      return;
    }
    for (const token of tokens) {
      this.agregarSeleccionado(token);
    }
  }

  agregarSeleccionado(token: string): void {
    const limpio = (token || '').trim();
    if (!limpio || limpio.length > 255 || this.isSelected(limpio)) {
      return;
    }
    this.selectedKeys = [...this.selectedKeys, limpio];
  }

  quitarSeleccionado(token: string): void {
    const clave = token.toLowerCase();
    this.selectedKeys = this.selectedKeys.filter((k) => k.toLowerCase() !== clave);
  }

  confirmarUno(): void {
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
    const result: RegistroPendienteUnoResult = {
      modo: 'uno',
      name,
      observaciones: String(this.form.value.observaciones || '').trim()
    };
    this.activeModal.close(result);
  }

  confirmarVarios(): void {
    if (!this.selectedKeys.length) {
      return;
    }
    const result: RegistroPendienteVariosResult = {
      modo: 'varios',
      names: [...this.selectedKeys],
      observaciones: String(this.observacionesMasa || '').trim()
    };
    this.activeModal.close(result);
  }

  trackByToken(_: number, token: string): string {
    return token.toLowerCase();
  }
}
