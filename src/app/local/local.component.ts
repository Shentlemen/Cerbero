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
  localForm: FormGroup;
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
  }

  ngOnInit(): void {
    this.localList = this.localService.getLocal();
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.localForm.enable();  // Vuelve a habilitar el formulario
    this.localForm.reset();   // Resetea el formulario
  }
  
  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const local = this.localList[index];
    this.localForm.patchValue(local);
    this.localForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  

  abrirModalVer(modal: any, index: number): void {
    this.currentViewIndex = index;
    const local = this.localList[this.currentViewIndex];
    this.localForm.patchValue(local);
    this.localForm.disable();  // Deshabilita el formulario para solo ver
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  
  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.localList[this.currentEditIndex] = this.localForm.value;
      this.modalService.dismissAll();
      this.currentEditIndex = null;
      this.localForm.reset();
      this.localForm.enable();  // Rehabilita el formulario después de cerrar
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
