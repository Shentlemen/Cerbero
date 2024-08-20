import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ComprasService } from '../compras.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './compras.component.html',
  styleUrls: ['./compras.component.css']
})
export class ComprasComponent implements OnInit {

  comprasList: any[] = [];
  comprasForm: FormGroup;
  isEditing: boolean = false;
  currentEditIndex: number | null = null;

  constructor(private comprasService: ComprasService, private fb: FormBuilder) {
    this.comprasForm = this.fb.group({
      nroCompra: [''],
      item: [''],
      descripcion: [''],
      proveedor: [''],
      fechaInicio: [''],
      fechaFinal: ['']
    });
  }

  ngOnInit(): void {
    this.comprasList = this.comprasService.getCompras();
  }

  agregarCompra(): void {
    if (this.isEditing && this.currentEditIndex !== null) {
      this.comprasList[this.currentEditIndex] = this.comprasForm.value;
      this.isEditing = false;
      this.currentEditIndex = null;
    } else {
      this.comprasList.push(this.comprasForm.value);
    }
    this.comprasForm.reset();
  }

  eliminarCompra(id: number): void {
    this.comprasList = this.comprasList.filter(compra => compra.nroCompra !== id);
  }

  editarCompra(index: number): void {
    const compra = this.comprasList[index];
    this.comprasForm.patchValue(compra);
    this.isEditing = true;
    this.currentEditIndex = index;
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.currentEditIndex = null;
    this.comprasForm.reset();
  }
}
