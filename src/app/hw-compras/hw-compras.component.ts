import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HwComprasService } from '../hw-compras.service';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';


@Component({
  selector: 'app-hw-compras',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './hw-compras.component.html',
  styleUrls: ['./hw-compras.component.css']
})
export class HwComprasComponent implements OnInit {

  hwComprasList: any[] = [];
  hwComprasForm: FormGroup;
  currentEditIndex: number | null = null;
  currentViewIndex: number | null = null;
  isEditing: boolean = false;

  constructor(private hwComprasService: HwComprasService, private fb: FormBuilder, private modalService: NgbModal) {
    this.hwComprasForm = this.fb.group({
      nroEquipo: [''],
      nroCompra: [''],
      item: [''],
      pedido: [''],
      descripcion: ['']
    });
  }

  ngOnInit(): void {
    this.hwComprasList = this.hwComprasService.getHwCompras();
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.hwComprasForm.enable();  // Vuelve a habilitar el formulario
    this.hwComprasForm.reset();   // Resetea el formulario
  }
  
  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const hwCompra = this.hwComprasList[index];
    this.hwComprasForm.patchValue(hwCompra);
    this.hwComprasForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  

  abrirModalVer(modal: any, index: number): void {
    this.currentViewIndex = index;
    const hwCompra = this.hwComprasList[this.currentViewIndex];
    this.hwComprasForm.patchValue(hwCompra);
    this.hwComprasForm.disable();  // Deshabilita el formulario para solo ver
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  
  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.hwComprasList[this.currentEditIndex] = this.hwComprasForm.value;
      this.modalService.dismissAll();
      this.currentEditIndex = null;
      this.hwComprasForm.reset();
      this.hwComprasForm.enable();  // Rehabilita el formulario después de cerrar
    }
  }
  exportarAPdf(): void {
    const doc = new jsPDF();
    const hwCompra = this.hwComprasList[this.currentViewIndex!];
  
    doc.text('Compra de Hardware Details', 10, 10);
    doc.text(`Número de Equipo: ${hwCompra.nroEquipo}`, 10, 20);
    doc.text(`Número de Compra: ${hwCompra.nroCompra}`, 10, 30);
    doc.text(`Item: ${hwCompra.item}`, 10, 40);
    doc.text(`Pedido: ${hwCompra.pedido}`, 10, 50);
    doc.text(`Descripción: ${hwCompra.descripcion}`, 10, 60);
  
    doc.save('hw-compra-details.pdf');
  }
  

  eliminarHwCompra(id: number): void {
    this.hwComprasList = this.hwComprasList.filter(hwCompra => hwCompra.nroCompra !== id);
  }
}
