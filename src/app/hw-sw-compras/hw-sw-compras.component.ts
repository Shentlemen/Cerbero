import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HwSwComprasService } from '../hw-sw-compras.service';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';


@Component({
  selector: 'app-hw-sw-compras',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './hw-sw-compras.component.html',
  styleUrls: ['./hw-sw-compras.component.css']
})
export class HwSwComprasComponent implements OnInit {

  hwSwComprasList: any[] = [];
  hwSwComprasForm: FormGroup;
  currentEditIndex: number | null = null;
  currentViewIndex: number | null = null;
  isEditing: boolean = false;

  constructor(private hwSwComprasService: HwSwComprasService, private fb: FormBuilder, private modalService: NgbModal) {
    this.hwSwComprasForm = this.fb.group({
      nroEquipo: [''],
      nroSoftware: [''],
      nroCompra: [''],
      item: [''],
      pedido: ['']
    });
  }

  ngOnInit(): void {
    this.hwSwComprasList = this.hwSwComprasService.getHwSwCompras();
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.hwSwComprasForm.enable();  // Vuelve a habilitar el formulario
    this.hwSwComprasForm.reset();   // Resetea el formulario
  }
  
  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const hwSwCompra = this.hwSwComprasList[index];
    this.hwSwComprasForm.patchValue(hwSwCompra);
    this.hwSwComprasForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  

  abrirModalVer(modal: any, index: number): void {
    this.currentViewIndex = index;
    const hwSwCompra = this.hwSwComprasList[this.currentViewIndex];
    this.hwSwComprasForm.patchValue(hwSwCompra);
    this.hwSwComprasForm.disable();  // Deshabilita el formulario para solo ver
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  
  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.hwSwComprasList[this.currentEditIndex] = this.hwSwComprasForm.value;
      this.modalService.dismissAll();
      this.currentEditIndex = null;
      this.hwSwComprasForm.reset();
      this.hwSwComprasForm.enable();  // Rehabilita el formulario después de cerrar
    }
  }
  exportarAPdf(): void {
    const doc = new jsPDF();
    const hwSwCompra = this.hwSwComprasList[this.currentViewIndex!];
  
    doc.text('Compra de Hardware y Software Details', 10, 10);
    doc.text(`Número de Equipo: ${hwSwCompra.nroEquipo}`, 10, 20);
    doc.text(`Número de Software: ${hwSwCompra.nroSoftware}`, 10, 30);
    doc.text(`Número de Compra: ${hwSwCompra.nroCompra}`, 10, 40);
    doc.text(`Item: ${hwSwCompra.item}`, 10, 50);
    doc.text(`Pedido: ${hwSwCompra.pedido}`, 10, 60);
  
    doc.save('hw-sw-compra-details.pdf');
  }
  

  eliminarHwSwCompras(id: number): void {
    this.hwSwComprasList = this.hwSwComprasList.filter(hwSwCompra => hwSwCompra.nroCompra !== id);
  }
}
