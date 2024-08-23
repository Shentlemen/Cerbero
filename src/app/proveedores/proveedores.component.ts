import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ProveedoresService } from '../proveedores.service';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';


@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './proveedores.component.html',
  styleUrls: ['./proveedores.component.css']
})
export class ProveedoresComponent implements OnInit {

  proveedoresList: any[] = [];
  proveedoresForm: FormGroup;
  currentEditIndex: number | null = null;
  currentViewIndex: number | null = null;
  isEditing: boolean = false;

  constructor(private proveedoresService: ProveedoresService, private fb: FormBuilder, private modalService: NgbModal) {
    this.proveedoresForm = this.fb.group({
      nroProveedor: [''],
      descripcion: [''],
      direccion: [''],
      telefonos: ['']
    });
  }

  ngOnInit(): void {
    this.proveedoresList = this.proveedoresService.getProveedores();
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.proveedoresForm.enable();  // Vuelve a habilitar el formulario
    this.proveedoresForm.reset();   // Resetea el formulario
  }
  
  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const proveedor = this.proveedoresList[index];
    this.proveedoresForm.patchValue(proveedor);
    this.proveedoresForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  

  abrirModalVer(modal: any, index: number): void {
    this.currentViewIndex = index;
    const proveedor = this.proveedoresList[this.currentViewIndex];
    this.proveedoresForm.patchValue(proveedor);
    this.proveedoresForm.disable();  // Deshabilita el formulario para solo ver
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  
  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.proveedoresList[this.currentEditIndex] = this.proveedoresForm.value;
      this.modalService.dismissAll();
      this.currentEditIndex = null;
      this.proveedoresForm.reset();
      this.proveedoresForm.enable();  // Rehabilita el formulario después de cerrar
    }
  }
  exportarAPdf(): void {
    const doc = new jsPDF();
    const proveedor = this.proveedoresList[this.currentViewIndex!];
  
    doc.text('Proveedor Details', 10, 10);
    doc.text(`Número de Proveedor: ${proveedor.nroProveedor}`, 10, 20);
    doc.text(`Descripción: ${proveedor.descripcion}`, 10, 30);
    doc.text(`Dirección: ${proveedor.direccion}`, 10, 40);
    doc.text(`Teléfonos: ${proveedor.telefonos}`, 10, 50);
  
    doc.save('proveedor-details.pdf');
  }
  

  eliminarProveedor(id: number): void {
    this.proveedoresList = this.proveedoresList.filter(proveedor => proveedor.nroProveedor !== id);
  }
}
