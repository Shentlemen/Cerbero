import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HwSwComprasService } from '../hw-sw-compras.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hw-sw-compras',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './hw-sw-compras.component.html',
  styleUrls: ['./hw-sw-compras.component.css']
})
export class HwSwComprasComponent implements OnInit {

  hwSwComprasList: any[] = [];
  hwSwComprasForm: FormGroup;
  isEditing: boolean = false;
  currentEditIndex: number | null = null;

  constructor(private hwSwComprasService: HwSwComprasService, private fb: FormBuilder) {
    this.hwSwComprasForm = this.fb.group({
      nroEquipo: [''],
      nroSoftware: [''],
      nroCompra: [''],
      item: [''],
      pedido: ['']
    });
  }

  ngOnInit(): void {
    this.hwSwComprasList = this.hwSwComprasService.getHwSwCompras();
  }

  agregarHwSwCompras(): void {
    if (this.isEditing && this.currentEditIndex !== null) {
      this.hwSwComprasList[this.currentEditIndex] = this.hwSwComprasForm.value;
      this.isEditing = false;
      this.currentEditIndex = null;
    } else {
      this.hwSwComprasList.push(this.hwSwComprasForm.value);
    }
    this.hwSwComprasForm.reset();
  }

  eliminarHwSwCompras(id: number): void {
    this.hwSwComprasList = this.hwSwComprasList.filter(hwSwCompra => hwSwCompra.nroCompra !== id);
  }

  editarHwSwCompras(index: number): void {
    const hwSwCompra = this.hwSwComprasList[index];
    this.hwSwComprasForm.patchValue(hwSwCompra);
    this.isEditing = true;
    this.currentEditIndex = index;
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.currentEditIndex = null;
    this.hwSwComprasForm.reset();
  }
}
