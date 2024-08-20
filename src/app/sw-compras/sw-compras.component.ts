import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SwComprasService } from '../sw-compras.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sw-compras',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './sw-compras.component.html',
  styleUrls: ['./sw-compras.component.css']
})
export class SwComprasComponent implements OnInit {

  swComprasList: any[] = [];
  swComprasForm: FormGroup;
  isEditing: boolean = false;
  currentEditIndex: number | null = null;

  constructor(private swComprasService: SwComprasService, private fb: FormBuilder) {
    this.swComprasForm = this.fb.group({
      nroSoftware: [''],
      nroCompra: [''],
      item: [''],
      pedido: [''],
      descripcion: ['']
    });
  }

  ngOnInit(): void {
    this.swComprasList = this.swComprasService.getSwCompras();
  }

  agregarSwCompra(): void {
    if (this.isEditing && this.currentEditIndex !== null) {
      this.swComprasList[this.currentEditIndex] = this.swComprasForm.value;
      this.isEditing = false;
      this.currentEditIndex = null;
    } else {
      this.swComprasList.push(this.swComprasForm.value);
    }
    this.swComprasForm.reset();
  }

  eliminarSwCompra(id: number): void {
    this.swComprasList = this.swComprasList.filter(swCompra => swCompra.nroCompra !== id);
  }

  editarSwCompra(index: number): void {
    const swCompra = this.swComprasList[index];
    this.swComprasForm.patchValue(swCompra);
    this.isEditing = true;
    this.currentEditIndex = index;
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.currentEditIndex = null;
    this.swComprasForm.reset();
  }
}
