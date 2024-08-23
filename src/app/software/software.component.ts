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
  softwareForm: FormGroup;
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
  }

  ngOnInit(): void {
    this.softwareList = this.swService.getSoftware();
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.softwareForm.enable();  // Vuelve a habilitar el formulario
    this.softwareForm.reset();   // Resetea el formulario
  }
  
  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const software = this.softwareList[index];
    this.softwareForm.patchValue(software);
    this.softwareForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  

  abrirModalVer(modal: any, index: number): void {
    this.currentViewIndex = index;
    const software = this.softwareList[this.currentViewIndex];
    this.softwareForm.patchValue(software);
    this.softwareForm.disable();  // Deshabilita el formulario para solo ver
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
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
