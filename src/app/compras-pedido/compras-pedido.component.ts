import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ComprasPedidoService } from '../compras-pedido.service';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-compras-pedido',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './compras-pedido.component.html',
  styleUrls: ['./compras-pedido.component.css']
})
export class ComprasPedidoComponent implements OnInit {

  comprasPedidoList: any[] = [];
  comprasPedidoForm: FormGroup;
  currentEditIndex: number | null = null;
  currentViewIndex: number | null = null;
  isEditing: boolean = false;

  constructor(private comprasPedidoService: ComprasPedidoService, private fb: FormBuilder, private modalService: NgbModal) {
    this.comprasPedidoForm = this.fb.group({
      nroCompra: [''],
      item: [''],
      pedido: [''],
      proveedor: [''],
      cantidad: [''],
      fechaInicio: [''],
      fechaFinal: ['']
    });
  }

  ngOnInit(): void {
    this.comprasPedidoList = this.comprasPedidoService.getComprasPedido();
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
      this.comprasPedidoForm.reset();   // Resetea el formulario
      this.comprasPedidoForm.enable();  // Vuelve a habilitar el formulario
    }, 200);
  }

  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const compraPedido = this.comprasPedidoList[index];
    if (compraPedido) {
      this.comprasPedidoForm.patchValue(compraPedido);
      this.comprasPedidoForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
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
    const compraPedido = this.comprasPedidoList[this.currentViewIndex];
    if (compraPedido) {
      this.comprasPedidoForm.patchValue(compraPedido);
      this.comprasPedidoForm.disable();  // Deshabilita el formulario para solo ver
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }

  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.comprasPedidoList[this.currentEditIndex] = this.comprasPedidoForm.value;
      this.modalService.dismissAll();
      this.resetFormulario();
    }
  }

  exportarAPdf(): void {
    const doc = new jsPDF();
    const compraPedido = this.comprasPedidoList[this.currentViewIndex!];

    doc.text('Pedido de Compra Details', 10, 10);
    doc.text(`Número de Compra: ${compraPedido.nroCompra}`, 10, 20);
    doc.text(`Item: ${compraPedido.item}`, 10, 30);
    doc.text(`Pedido: ${compraPedido.pedido}`, 10, 40);
    doc.text(`Proveedor: ${compraPedido.proveedor}`, 10, 50);
    doc.text(`Cantidad: ${compraPedido.cantidad}`, 10, 60);
    doc.text(`Fecha de Inicio: ${compraPedido.fechaInicio}`, 10, 70);
    doc.text(`Fecha Final: ${compraPedido.fechaFinal}`, 10, 80);

    doc.save('pedido-compra-details.pdf');
  }

  eliminarCompraPedido(id: number): void {
    this.comprasPedidoList = this.comprasPedidoList.filter(compraPedido => compraPedido.nroCompra !== id);
  }
}
