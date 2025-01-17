import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UbicacionDispositivoService } from '../services/ubicacion-dispositivo.service';

@Component({
  selector: 'app-ubicacion-dispositivo',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './ubicacion-dispositivo.component.html',
  styleUrls: ['./ubicacion-dispositivo.component.css']
})
export class UbicacionDispositivoComponent implements OnInit {
  @Input() mac!: string;
  @Input() ubicacion: any;
  isEditing = false;
  ubicacionForm: FormGroup;

  constructor(
    private ubicacionService: UbicacionDispositivoService,
    private fb: FormBuilder
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
    this.ubicacionService.getUbicacionByMacAddr(this.mac).subscribe({
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
      const ubicacionData = {
        macaddr: this.mac,
        ...this.ubicacionForm.value
      };

      this.ubicacionService.saveUbicacion(ubicacionData).subscribe({
        next: (response) => {
          this.ubicacion = response;
          this.isEditing = false;
        },
        error: (error) => {
          console.error('Error al guardar ubicación:', error);
        }
      });
    }
  }
} 