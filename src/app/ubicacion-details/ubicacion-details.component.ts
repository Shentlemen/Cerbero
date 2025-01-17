import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UbicacionEquipoOse } from '../models/ubicacion-equipo.model';
import { UbicacionEquipoService } from '../services/ubicacion-equipo.service';
import jsPDF from 'jspdf';
import { Router } from '@angular/router';
import { SubnetService, SubnetDTO } from '../services/subnet.service';

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
  subnets: SubnetDTO[] = [];

  constructor(
    private ubicacionService: UbicacionEquipoService,
    private subnetService: SubnetService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.ubicacionForm = this.createForm();
  }

  ngOnInit() {
    this.loadUbicacion();
    this.loadSubnets();
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
      direccion: ['', Validators.required],
      subnet: ['', Validators.required]
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

  loadSubnets() {
    this.subnetService.getSubnets().subscribe({
      next: (subnets) => {
        this.subnets = subnets;
      },
      error: (error) => {
        console.error('Error al cargar subnets:', error);
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
      const formValues = this.ubicacionForm.value;
      
      const subnetValue = formValues.subnet ? parseInt(formValues.subnet, 10) : null;
      console.log('Valor de subnet antes de validación:', {
        original: formValues.subnet,
        parsed: subnetValue,
        type: typeof formValues.subnet
      });

      const ubicacionData: UbicacionEquipoOse = {
        hardwareId: Number(this.hardwareId),
        nombreGerencia: formValues.nombreGerencia.trim(),
        nombreOficina: formValues.nombreOficina.trim(),
        piso: formValues.piso.trim(),
        numeroPuerta: formValues.numeroPuerta.trim(),
        interno: formValues.interno?.trim() || null,
        departamento: formValues.departamento.trim(),
        ciudad: formValues.ciudad.trim(),
        direccion: formValues.direccion.trim(),
        subnet: formValues.subnet
      };

      console.log('Datos a enviar:', ubicacionData);

      this.ubicacionService.updateUbicacion(this.hardwareId, ubicacionData).subscribe({
        next: (response) => {
          this.ubicacion = response;
          this.isEditing = false;
        },
        error: (error) => {
          console.error('Error al guardar ubicación:', error);
        }
      });
    } else {
      // Marcar todos los campos como touched para mostrar errores
      Object.keys(this.ubicacionForm.controls).forEach(key => {
        const control = this.ubicacionForm.get(key);
        control?.markAsTouched();
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
      ['Dirección:', this.ubicacion.direccion],
      ['Subnet:', this.ubicacion.subnet.toString()]
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
