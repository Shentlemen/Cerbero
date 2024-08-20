import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HwService } from '../hw.service';  // Importa el servicio
import { CommonModule } from '@angular/common';

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
  isEditing: boolean = false;
  currentEditIndex: number | null = null;

  constructor(private hwService: HwService, private fb: FormBuilder) {
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

  agregarHardware(): void {
    if (this.isEditing && this.currentEditIndex !== null) {
      // Actualiza el hardware existente en la lista
      this.hardwareList[this.currentEditIndex] = this.hardwareForm.value;
      this.isEditing = false;
      this.currentEditIndex = null;
    } else {
      // Agrega un nuevo hardware a la lista
      this.hardwareList.push(this.hardwareForm.value);
    }
    this.hardwareForm.reset();  // Resetea el formulario después de agregar o editar
  }

  eliminarHardware(id: number): void {
    // Elimina el hardware de la lista basado en el número de equipo
    this.hardwareList = this.hardwareList.filter(h => h.nroEquipo !== id);
  }

  editarHardware(index: number): void {
    // Carga los datos del hardware en el formulario para editar
    const hardware = this.hardwareList[index];
    this.hardwareForm.patchValue(hardware);
    this.isEditing = true;
    this.currentEditIndex = index;
  }

  cancelarEdicion(): void {
    // Cancela la edición y resetea el estado del formulario
    this.isEditing = false;
    this.currentEditIndex = null;
    this.hardwareForm.reset();
  }
}
