import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ComprasService } from '../compras.service';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './compras.component.html',
  styleUrls: ['./compras.component.css']
})
export class ComprasComponent implements OnInit {

  comprasList: any[] = [];
  comprasForm: FormGroup;
  currentEditIndex: number | null = null;
  currentViewIndex: number | null = null;
  isEditing: boolean = false;

  constructor(private comprasService: ComprasService, private fb: FormBuilder, private modalService: NgbModal) {
    this.comprasForm = this.fb.group({
      nroCompra: [''],
      item: [''],
      descripcion: [''],
      proveedor: [''],
      fechaInicio: [''],
      fechaFinal: ['']
    });
  }

  ngOnInit(): void {
    this.comprasList = this.comprasService.getCompras();
  }

  cancelarEdicion(): void {
    this.modalService.dismissAll();  // Cierra todos los modales
    this.resetFormulario();
  }

  cerrarModal(modal: any): void {
    modal.dismiss();  // Cierra el modal específico
    this.resetFormulario();
  }

  resetFormulario(): void {
    setTimeout(() => {
      this.isEditing = false;
      this.currentEditIndex = null;
      this.currentViewIndex = null;  // Resetea el índice de visualización actual
      this.comprasForm.reset();   // Resetea el formulario
      this.comprasForm.enable();  // Vuelve a habilitar el formulario
    }, 200);
  }

  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const compra = this.comprasList[index];
    if (compra) {
      this.comprasForm.patchValue(compra);
      this.comprasForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }

  abrirModalVer(modal: any, index: number): void {
    if (this.isEditing) {
      return;  // No abrir el modal de "Ver" si estás en modo edición
    }
    this.currentViewIndex = index;
    const compra = this.comprasList[this.currentViewIndex];
    if (compra) {
      this.comprasForm.patchValue(compra);
      this.comprasForm.disable();  // Deshabilita el formulario para solo ver
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }

  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.comprasList[this.currentEditIndex] = this.comprasForm.value;
      this.modalService.dismissAll();
      this.resetFormulario();
    }
  }

  exportarAPdf(): void {
    const doc = new jsPDF();
    const compra = this.comprasList[this.currentViewIndex!];

    doc.text('Compra Details', 10, 10);
    doc.text(`Número de Compra: ${compra.nroCompra}`, 10, 20);
    doc.text(`Item: ${compra.item}`, 10, 30);
    doc.text(`Descripción: ${compra.descripcion}`, 10, 40);
    doc.text(`Proveedor: ${compra.proveedor}`, 10, 50);
    doc.text(`Fecha de Inicio: ${compra.fechaInicio}`, 10, 60);
    doc.text(`Fecha Final: ${compra.fechaFinal}`, 10, 70);

    doc.save('compra-details.pdf');
  }

  eliminarCompra(id: number): void {
    this.comprasList = this.comprasList.filter(compra => compra.nroCompra !== id);
  }
}
