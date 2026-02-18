import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { StockAlmacenService } from '../../services/stock-almacen.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-modificar-cantidad-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './modificar-cantidad-modal.component.html',
  styleUrls: ['./modificar-cantidad-modal.component.css']
})
export class ModificarCantidadModalComponent {
  private _item: any;
  cantidadForm: FormGroup;
  mostrarConfirmacionEliminacion = false;

  set item(value: any) {
    this._item = value;
    if (value) {
      this.cantidadForm.patchValue({ cantidad: value.cantidad ?? 1 });
    }
  }
  get item(): any {
    return this._item;
  }

  constructor(
    public activeModal: NgbActiveModal,
    private stockAlmacenService: StockAlmacenService,
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
    this.cantidadForm = this.fb.group({
      cantidad: [0, [Validators.required, Validators.min(0)]]
    });
  }

  aumentarCantidad(): void {
    const cantidadActual = this.cantidadForm.get('cantidad')?.value ?? 0;
    this.cantidadForm.patchValue({ cantidad: cantidadActual + 1 });
    this.mostrarConfirmacionEliminacion = false;
  }

  reducirCantidad(): void {
    const cantidadActual = this.cantidadForm.get('cantidad')?.value ?? 0;
    const nuevaCantidad = Math.max(0, cantidadActual - 1);
    this.cantidadForm.patchValue({ cantidad: nuevaCantidad });
    this.mostrarConfirmacionEliminacion = nuevaCantidad === 0;
  }

  guardarCantidad(): void {
    if (!this.item || !this.cantidadForm.valid) return;

    const nuevaCantidad = this.cantidadForm.get('cantidad')?.value ?? 0;

    if (nuevaCantidad === 0) {
      this.stockAlmacenService.deleteStock(this.item.id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Item Eliminado', 'El item ha sido eliminado del stock.');
          this.activeModal.close({ success: true });
        },
        error: (err) => {
          this.notificationService.showError('Error', err?.error?.message || 'No se pudo eliminar el item.');
        }
      });
    } else {
      this.stockAlmacenService.updateStockQuantity(this.item.id, nuevaCantidad).subscribe({
        next: () => {
          this.notificationService.showSuccess('Stock Actualizado', `La cantidad se ha actualizado a ${nuevaCantidad} unidades.`);
          this.activeModal.close({ success: true });
        },
        error: (err) => {
          this.notificationService.showError('Error', err?.error?.message || 'No se pudo actualizar la cantidad.');
        }
      });
    }
  }

  cancelarCambios(): void {
    this.activeModal.dismiss();
  }
}
