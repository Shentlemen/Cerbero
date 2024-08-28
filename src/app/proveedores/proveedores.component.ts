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
      this.proveedoresForm.reset();   // Resetea el formulario
      this.proveedoresForm.enable();  // Vuelve a habilitar el formulario
    }, 200);
  }

  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const proveedor = this.proveedoresList[index];
    if (proveedor) {
      this.proveedoresForm.patchValue(proveedor);
      this.proveedoresForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
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
    const proveedor = this.proveedoresList[this.currentViewIndex];
    if (proveedor) {
      this.proveedoresForm.patchValue(proveedor);
      this.proveedoresForm.disable();  // Deshabilita el formulario para solo ver
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }

  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.proveedoresList[this.currentEditIndex] = this.proveedoresForm.value;
      this.modalService.dismissAll();
      this.resetFormulario();
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
