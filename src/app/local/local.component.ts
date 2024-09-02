import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LocalService } from '../local.service';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-local',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './local.component.html',
  styleUrls: ['./local.component.css']
})
export class LocalComponent implements OnInit {

  localList: any[] = [];
  localFiltrado: any[] = [];
  localForm: FormGroup;
  filterForm: FormGroup;
  currentEditIndex: number | null = null;
  currentViewIndex: number | null = null;
  isEditing: boolean = false;

  constructor(private localService: LocalService, private fb: FormBuilder, private modalService: NgbModal) {
    this.localForm = this.fb.group({
      subred: [''],
      piso: [''],
      oficina: [''],
      zona: [''],
      ciudad: [''],
      local: [''],
      direccion: ['']
    });

    this.filterForm = this.fb.group({
      subred: [''],
      piso: [''],
      oficina: [''],
      zona: [''],
      ciudad: [''],
      local: [''],
      direccion: ['']
    });
  }

  ngOnInit(): void {
    this.localList = this.localService.getLocal();
    this.localFiltrado = this.localList; // Inicialmente, sin filtros
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;

    this.localFiltrado = this.localList.filter(local => {
      return Object.keys(filtros).every(key => {
        const filtroValor = filtros[key];
        const localValor = local[key];

        if (typeof localValor === 'number' && filtroValor !== '') {
          return localValor === +filtroValor;  // Comparación exacta para números
        } else {
          return localValor.toString().toLowerCase().includes(filtroValor.toString().toLowerCase().trim());
        }
      });
    });
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
      this.localForm.reset();   // Resetea el formulario
      this.localForm.enable();  // Vuelve a habilitar el formulario
    }, 200);
  }

  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const local = this.localList[index];
    if (local) {
      this.localForm.patchValue(local);
      this.localForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
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
    const local = this.localList[this.currentViewIndex];
    if (local) {
      this.localForm.patchValue(local);
      this.localForm.disable();  // Deshabilita el formulario para solo ver
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }

  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.localList[this.currentEditIndex] = this.localForm.value;
      this.modalService.dismissAll();
      this.resetFormulario();
    }
  }

  exportarAPdf(): void {
    const doc = new jsPDF();
    const local = this.localList[this.currentViewIndex!];

    doc.text('Local Details', 10, 10);
    doc.text(`Subred: ${local.subred}`, 10, 20);
    doc.text(`Piso: ${local.piso}`, 10, 30);
    doc.text(`Oficina: ${local.oficina}`, 10, 40);
    doc.text(`Zona: ${local.zona}`, 10, 50);
    doc.text(`Ciudad: ${local.ciudad}`, 10, 60);
    doc.text(`Local: ${local.local}`, 10, 70);
    doc.text(`Dirección: ${local.direccion}`, 10, 80);

    doc.save('local-details.pdf');
  }

  eliminarLocal(id: number): void {
    this.localList = this.localList.filter(local => local.subred !== id);
  }
}
