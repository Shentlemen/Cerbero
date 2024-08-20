import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ProveedoresService } from '../proveedores.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './proveedores.component.html',
  styleUrls: ['./proveedores.component.css']
})
export class ProveedoresComponent implements OnInit {

  proveedoresList: any[] = [];
  proveedoresForm: FormGroup;
  isEditing: boolean = false;
  currentEditIndex: number | null = null;

  constructor(private proveedoresService: ProveedoresService, private fb: FormBuilder) {
    this.proveedoresForm = this.fb.group({
      nroProveedor: [''],
      descripcion: [''],
      direccion: [''],
      telefonos: ['']
    });
  }

  ngOnInit(): void {
    this.proveedoresList = this.proveedoresService.getProveedores();
  }

  agregarProveedor(): void {
    if (this.isEditing && this.currentEditIndex !== null) {
      this.proveedoresList[this.currentEditIndex] = this.proveedoresForm.value;
      this.isEditing = false;
      this.currentEditIndex = null;
    } else {
      this.proveedoresList.push(this.proveedoresForm.value);
    }
    this.proveedoresForm.reset();
  }

  eliminarProveedor(id: number): void {
    this.proveedoresList = this.proveedoresList.filter(proveedor => proveedor.nroProveedor !== id);
  }

  editarProveedor(index: number): void {
    const proveedor = this.proveedoresList[index];
    this.proveedoresForm.patchValue(proveedor);
    this.isEditing = true;
    this.currentEditIndex = index;
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.currentEditIndex = null;
    this.proveedoresForm.reset();
  }
}
