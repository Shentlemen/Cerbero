import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HwService } from '../hw.service';  // Importa el servicio
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';


@Component({
  selector: 'app-hardware',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './hardware.component.html',
  styleUrls: ['./hardware.component.css']
})
export class HardwareComponent implements OnInit {

  hardwareList: any[] = [];
  hardwareForm: FormGroup;
  currentEditIndex: number | null = null;
  currentViewIndex: number | null = null;
  isEditing: boolean = false;

  constructor(private hwService: HwService, private fb: FormBuilder, private modalService: NgbModal) {
    // Inicializa el formulario con controles
    this.hardwareForm = this.fb.group({
      nroEquipo: [''],
      tipoEquipo: [''],
      marca: [''],
      modelo: [''],
      nroSerie: [''],
      disco: [''],
      memoria: [''],
      tarjetaVideo: [''],
      nroSerieTeclado: [''],
      nroSerieMouse: [''],
      propietario: ['']
    });
  }

  ngOnInit(): void {
    // Cargar la lista de hardware utilizando el servicio
    this.hardwareList = this.hwService.getHardware();
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.hardwareForm.enable();  // Vuelve a habilitar el formulario
    this.hardwareForm.reset();   // Resetea el formulario
  }
  
  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const hardware = this.hardwareList[index];
    this.hardwareForm.patchValue(hardware);
    this.hardwareForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  
  

  abrirModalVer(modal: any, index: number): void {
    this.currentViewIndex = index;
    const hardware = this.hardwareList[this.currentViewIndex];
    this.hardwareForm.patchValue(hardware);
    this.hardwareForm.disable();  // Deshabilita el formulario para solo ver
    this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' });
  }
  
  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.hardwareList[this.currentEditIndex] = this.hardwareForm.value;
      this.modalService.dismissAll();
      this.currentEditIndex = null;
      this.hardwareForm.reset();
      this.hardwareForm.enable();  // Rehabilita el formulario después de cerrar
    }
  }
  exportarAPdf(): void {
    const doc = new jsPDF();
    const hardware = this.hardwareList[this.currentViewIndex!];
  
    doc.text('Hardware Details', 10, 10);
    doc.text(`Tipo de Equipo: ${hardware.tipoEquipo}`, 10, 20);
    doc.text(`Marca: ${hardware.marca}`, 10, 30);
    doc.text(`Modelo: ${hardware.modelo}`, 10, 40);
    doc.text(`Número de Serie: ${hardware.nroSerie}`, 10, 50);
    doc.text(`Disco: ${hardware.disco}`, 10, 60);
    doc.text(`Memoria: ${hardware.memoria}`, 10, 70);
    doc.text(`Tarjeta de Video: ${hardware.tarjetaVideo}`, 10, 80);
    doc.text(`Número de Serie del Teclado: ${hardware.nroSerieTeclado}`, 10, 90);
    doc.text(`Número de Serie del Mouse: ${hardware.nroSerieMouse}`, 10, 100);
    doc.text(`Propietario: ${hardware.propietario}`, 10, 110);
  
    doc.save('hardware-details.pdf');
  }
  

  eliminarHardware(id: number): void {
    // Elimina el hardware de la lista basado en el número de equipo
    this.hardwareList = this.hardwareList.filter(h => h.nroEquipo !== id);
  }
}
