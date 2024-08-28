import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HwLocalService } from '../hw-local.service';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-hw-local',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './hw-local.component.html',
  styleUrls: ['./hw-local.component.css']
})
export class HwLocalComponent implements OnInit {

  hwLocalList: any[] = [];
  hwLocalForm: FormGroup;
  currentEditIndex: number | null = null;
  currentViewIndex: number | null = null;
  isEditing: boolean = false;

  constructor(private hwLocalService: HwLocalService, private fb: FormBuilder, private modalService: NgbModal) {
    this.hwLocalForm = this.fb.group({
      nroSoftware: [''],
      subred: [''],
      piso: [''],
      oficina: [''],
      descripcion: ['']
    });
  }

  ngOnInit(): void {
    this.hwLocalList = this.hwLocalService.getHwLocal();
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
      this.hwLocalForm.reset();   // Resetea el formulario
      this.hwLocalForm.enable();  // Vuelve a habilitar el formulario
    }, 200);
  }

  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const hwLocal = this.hwLocalList[index];
    if (hwLocal) {
      this.hwLocalForm.patchValue(hwLocal);
      this.hwLocalForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
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
    const hwLocal = this.hwLocalList[this.currentViewIndex];
    if (hwLocal) {
      this.hwLocalForm.patchValue(hwLocal);
      this.hwLocalForm.disable();  // Deshabilita el formulario para solo ver
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }

  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.hwLocalList[this.currentEditIndex] = this.hwLocalForm.value;
      this.modalService.dismissAll();
      this.resetFormulario();
    }
  }

  exportarAPdf(): void {
    const doc = new jsPDF();
    const hwLocal = this.hwLocalList[this.currentViewIndex!];

    doc.text('Ubicación de Hardware Details', 10, 10);
    doc.text(`Número de Software: ${hwLocal.nroSoftware}`, 10, 20);
    doc.text(`Subred: ${hwLocal.subred}`, 10, 30);
    doc.text(`Piso: ${hwLocal.piso}`, 10, 40);
    doc.text(`Oficina: ${hwLocal.oficina}`, 10, 50);
    doc.text(`Descripción: ${hwLocal.descripcion}`, 10, 60);

    doc.save('hw-local-details.pdf');
  }

  eliminarHwLocal(id: number): void {
    this.hwLocalList = this.hwLocalList.filter(hw => hw.nroSoftware !== id);
  }
}
