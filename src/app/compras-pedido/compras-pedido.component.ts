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
    this.isEditing = false;
    this.comprasPedidoForm.enable();  // Vuelve a habilitar el formulario
    this.comprasPedidoForm.reset();   // Resetea el formulario
  }
  
  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const compraPedido = this.comprasPedidoList[index];
    this.comprasPedidoForm.patchValue(compraPedido);
    this.comprasPedidoForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  

  abrirModalVer(modal: any, index: number): void {
    this.currentViewIndex = index;
    const compraPedido = this.comprasPedidoList[this.currentViewIndex];
    this.comprasPedidoForm.patchValue(compraPedido);
    this.comprasPedidoForm.disable();  // Deshabilita el formulario para solo ver
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  
  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.comprasPedidoList[this.currentEditIndex] = this.comprasPedidoForm.value;
      this.modalService.dismissAll();
      this.currentEditIndex = null;
      this.comprasPedidoForm.reset();
      this.comprasPedidoForm.enable();  // Rehabilita el formulario después de cerrar
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
