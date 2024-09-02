import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common'; // Importar CommonModule
import { HwService } from '../hw.service';  
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-hardware',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],  // Asegurarse de que CommonModule y ReactiveFormsModule están importados
  templateUrl: './hardware.component.html',
  styleUrls: ['./hardware.component.css']
})
export class HardwareComponent implements OnInit {

  hardwareList: any[] = [];
  hardwareFiltrado: any[] = [];
  hardwareForm: FormGroup;
  filterForm: FormGroup;
  currentEditIndex: number | null = null;
  currentViewIndex: number | null = null;
  isEditing: boolean = false;

  constructor(private hwService: HwService, private fb: FormBuilder, private modalService: NgbModal) {
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

    this.filterForm = this.fb.group({
      nroEquipo: [''],
      tipoEquipo: [''],
      marca: [''],
      modelo: [''],
      nroSerie: [''],
      propietario: ['']
    });
  }

  ngOnInit(): void {
    this.hardwareList = this.hwService.getHardware();
    this.hardwareFiltrado = this.hardwareList; // Inicialmente, sin filtros
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
  
    this.hardwareFiltrado = this.hardwareList.filter(hardware => {
      return Object.keys(filtros).every(key => {
        const filtroValor = filtros[key];
        const hardwareValor = hardware[key];
  
        // Comprobamos si el valor es un número y comparamos adecuadamente
        if (typeof hardwareValor === 'number' && filtroValor !== '') {
          return hardwareValor === +filtroValor;  // Comparación exacta para números
        } else {
          // Convertimos a string para asegurar la comparación correcta en otros casos
          return hardwareValor.toString().toLowerCase().includes(filtroValor.toString().toLowerCase().trim());
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
      this.hardwareForm.reset();   // Resetea el formulario
      this.hardwareForm.enable();  // Vuelve a habilitar el formulario
    }, 200);
  }

  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const hardware = this.hardwareList[index];
    if (hardware) {
      this.hardwareForm.patchValue(hardware);
      this.hardwareForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }
  abrirModalVer(modal: any, hardware: any): void {
    if (this.isEditing) {
      return;  // No abrir el modal de "Ver" si estás en modo edición
    }
    this.currentViewIndex = this.hardwareList.findIndex(h => h.nroEquipo === hardware.nroEquipo);
    if (this.currentViewIndex !== -1) {
      this.hardwareForm.patchValue(hardware);
      this.hardwareForm.disable();  // Deshabilita el formulario para solo ver
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }
  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.hardwareList[this.currentEditIndex] = this.hardwareForm.value;
      this.modalService.dismissAll();
      this.resetFormulario();
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
