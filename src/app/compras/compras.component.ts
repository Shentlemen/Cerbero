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
    this.isEditing = false;
    this.comprasForm.enable();  // Vuelve a habilitar el formulario
    this.comprasForm.reset();   // Resetea el formulario
  }
  
  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const compra = this.comprasList[index];
    this.comprasForm.patchValue(compra);
    this.comprasForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  

  abrirModalVer(modal: any, index: number): void {
    this.currentViewIndex = index;
    const compra = this.comprasList[this.currentViewIndex];
    this.comprasForm.patchValue(compra);
    this.comprasForm.disable();  // Deshabilita el formulario para solo ver
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  
  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.comprasList[this.currentEditIndex] = this.comprasForm.value;
      this.modalService.dismissAll();
      this.currentEditIndex = null;
      this.comprasForm.reset();
      this.comprasForm.enable();  // Rehabilita el formulario después de cerrar
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
