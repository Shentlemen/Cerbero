import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UbicacionEquipoOse } from '../models/ubicacion-equipo.model';
import { UbicacionEquipoService } from '../services/ubicacion-equipo.service';
import jsPDF from 'jspdf';
import { Router } from '@angular/router';

@Component({
  selector: 'app-ubicacion-details',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './ubicacion-details.component.html',
  styleUrls: ['./ubicacion-details.component.css']
})
export class UbicacionDetailsComponent implements OnInit {
  @Input() hardwareId!: number;
  ubicacion: UbicacionEquipoOse | null = null;
  isEditing = false;
  ubicacionForm: FormGroup;

  constructor(
    private ubicacionService: UbicacionEquipoService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.ubicacionForm = this.createForm();
  }

  ngOnInit() {
    this.loadUbicacion();
  }

  createForm(): FormGroup {
    return this.fb.group({
      nombreGerencia: ['', Validators.required],
      nombreOficina: ['', Validators.required],
      piso: ['', Validators.required],
      numeroPuerta: ['', Validators.required],
      interno: [''],
      departamento: ['', Validators.required],
      ciudad: ['', Validators.required],
      direccion: ['', Validators.required]
    });
  }

  loadUbicacion() {
    this.ubicacionService.getUbicacionByHardwareId(this.hardwareId).subscribe({
      next: (ubicacion) => {
        this.ubicacion = ubicacion;
        if (this.isEditing) {
          this.ubicacionForm.patchValue(ubicacion);
        }
      },
      error: (error) => {
        if (error.status === 404) {
          this.ubicacion = null;
          this.isEditing = true;
        } else {
          console.error('Error al cargar ubicación:', error);
        }
      }
    });
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (this.isEditing && this.ubicacion) {
      this.ubicacionForm.patchValue(this.ubicacion);
    }
  }

  onSubmit() {
    if (this.ubicacionForm.valid) {
      const ubicacionData: UbicacionEquipoOse = {
        hardwareId: this.hardwareId,
        ...this.ubicacionForm.value
      };

      const request = this.ubicacion
        ? this.ubicacionService.updateUbicacion(this.hardwareId, ubicacionData)
        : this.ubicacionService.createUbicacion(ubicacionData);

      request.subscribe({
        next: (response) => {
          this.ubicacion = response;
          this.isEditing = false;
          // Aquí podrías mostrar un mensaje de éxito
        },
        error: (error) => {
          console.error('Error al guardar ubicación:', error);
          // Aquí podrías mostrar un mensaje de error
        }
      });
    }
  }

  deleteUbicacion() {
    if (confirm('¿Está seguro de que desea eliminar esta ubicación?')) {
      this.ubicacionService.deleteUbicacion(this.hardwareId).subscribe({
        next: () => {
          this.ubicacion = null;
          // Aquí podrías mostrar un mensaje de éxito
        },
        error: (error) => {
          console.error('Error al eliminar ubicación:', error);
          // Aquí podrías mostrar un mensaje de error
        }
      });
    }
  }

  exportarAPdf(): void {
    if (!this.ubicacion) return;

    const doc = new jsPDF();
    const margin = 20;
    let yPos = margin;

    // Configurar título
    doc.setFontSize(16);
    doc.text('Detalles de Ubicación', margin, yPos);
    yPos += 10;

    // Configurar contenido
    doc.setFontSize(12);
    const detalles = [
      ['Gerencia:', this.ubicacion.nombreGerencia],
      ['Oficina:', this.ubicacion.nombreOficina],
      ['Piso:', this.ubicacion.piso],
      ['Puerta:', this.ubicacion.numeroPuerta],
      ['Interno:', this.ubicacion.interno],
      ['Departamento:', this.ubicacion.departamento],
      ['Ciudad:', this.ubicacion.ciudad],
      ['Dirección:', this.ubicacion.direccion]
    ];

    detalles.forEach(([label, value]) => {
      yPos += 10;
      doc.text(`${label} ${value}`, margin, yPos);
    });

    // Guardar el PDF
    doc.save(`ubicacion_${this.hardwareId}.pdf`);
  }

  volver() {
    this.router.navigate(['/ubicaciones']);
  }
}
