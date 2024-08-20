import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HwComprasService } from '../hw-compras.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hw-compras',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './hw-compras.component.html',
  styleUrls: ['./hw-compras.component.css']
})
export class HwComprasComponent implements OnInit {

  hwComprasList: any[] = [];
  hwComprasForm: FormGroup;
  isEditing: boolean = false;
  currentEditIndex: number | null = null;

  constructor(private hwComprasService: HwComprasService, private fb: FormBuilder) {
    this.hwComprasForm = this.fb.group({
      nroEquipo: [''],
      nroCompra: [''],
      item: [''],
      pedido: [''],
      descripcion: ['']
    });
  }

  ngOnInit(): void {
    this.hwComprasList = this.hwComprasService.getHwCompras();
  }

  agregarHwCompra(): void {
    if (this.isEditing && this.currentEditIndex !== null) {
      this.hwComprasList[this.currentEditIndex] = this.hwComprasForm.value;
      this.isEditing = false;
      this.currentEditIndex = null;
    } else {
      this.hwComprasList.push(this.hwComprasForm.value);
    }
    this.hwComprasForm.reset();
  }

  eliminarHwCompra(id: number): void {
    this.hwComprasList = this.hwComprasList.filter(hwCompra => hwCompra.nroCompra !== id);
  }

  editarHwCompra(index: number): void {
    const hwCompra = this.hwComprasList[index];
    this.hwComprasForm.patchValue(hwCompra);
    this.isEditing = true;
    this.currentEditIndex = index;
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.currentEditIndex = null;
    this.hwComprasForm.reset();
  }
}
