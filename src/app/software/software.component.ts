import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SwService } from '../sw.service';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-software',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './software.component.html',
  styleUrls: ['./software.component.css']
})
export class SoftwareComponent implements OnInit {

  softwareList: any[] = [];
  softwareFiltrado: any[] = [];
  softwareForm: FormGroup;
  filterForm: FormGroup;
  currentEditIndex: number | null = null;
  currentViewIndex: number | null = null;
  isEditing: boolean = false;

  constructor(private swService: SwService, private fb: FormBuilder, private modalService: NgbModal) {
    this.softwareForm = this.fb.group({
      nroSoftware: [''],
      nombre: [''],
      version: [''],
      licencia: [''],
      fechaInstalacion: [''],
      nroProveedor: ['']
    });

    this.filterForm = this.fb.group({
      nombre: [''],
      version: [''],
      licencia: [''],
      fechaInstalacion: [''],
      nroProveedor: ['']
    });
  }

  ngOnInit(): void {
    this.softwareList = this.swService.getSoftware();
    this.softwareFiltrado = this.softwareList; // Inicialmente, sin filtros
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;

    this.softwareFiltrado = this.softwareList.filter(software => {
      return Object.keys(filtros).every(key => {
        const filtroValor = filtros[key];
        const softwareValor = software[key];

        if (typeof softwareValor === 'number' && filtroValor !== '') {
          return softwareValor === +filtroValor;  // Comparación exacta para números
        } else {
          return softwareValor.toString().toLowerCase().includes(filtroValor.toString().toLowerCase().trim());
        }
      });
    });
  }

  cancelarEdicion(): void {
    this.modalService.dismissAll();  // Cierra todos los modales
    setTimeout(() => {
      this.isEditing = false;
      this.currentEditIndex = null;
      this.currentViewIndex = null;  // Resetea el índice de visualización actual
      this.softwareForm.enable();  // Vuelve a habilitar el formulario
      this.softwareForm.reset();   // Resetea el formulario
    }, 200);  // Cambia el estado después de cerrar el modal
  }

  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const software = this.softwareList[index];
    if (software) {
      this.softwareForm.patchValue(software);
      this.softwareForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.cancelarEdicion(),
        () => this.cancelarEdicion()
      );
    }
  }

  abrirModalVer(modal: any, index: number): void {
    if (this.isEditing) {
      return;  // No abrir el modal de "Ver" si estás en modo edición
    }
    this.currentViewIndex = index;
    const software = this.softwareList[this.currentViewIndex];
    if (software) {
      this.softwareForm.patchValue(software);
      this.softwareForm.disable();  // Deshabilita el formulario para solo ver
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
    }
  }

  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.softwareList[this.currentEditIndex] = this.softwareForm.value;
      this.modalService.dismissAll();
      this.currentEditIndex = null;
      this.softwareForm.reset();
      this.softwareForm.enable();  // Rehabilita el formulario después de cerrar
    }
  }

  exportarAPdf(): void {
    const doc = new jsPDF();
    const software = this.softwareList[this.currentViewIndex!];

    doc.text('Software Details', 10, 10);
    doc.text(`Número de Software: ${software.nroSoftware}`, 10, 20);
    doc.text(`Nombre: ${software.nombre}`, 10, 30);
    doc.text(`Versión: ${software.version}`, 10, 40);
    doc.text(`Licencia: ${software.licencia}`, 10, 50);
    doc.text(`Fecha de Instalación: ${software.fechaInstalacion}`, 10, 60);
    doc.text(`Número de Proveedor: ${software.nroProveedor}`, 10, 70);

    doc.save('software-details.pdf');
  }

  eliminarSoftware(id: number): void {
    this.softwareList = this.softwareList.filter(sw => sw.nroSoftware !== id);
  }
}
