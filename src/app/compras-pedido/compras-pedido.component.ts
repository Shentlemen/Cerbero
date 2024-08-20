import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ComprasPedidoService } from '../compras-pedido.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-compras-pedido',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './compras-pedido.component.html',
  styleUrls: ['./compras-pedido.component.css']
})
export class ComprasPedidoComponent implements OnInit {

  comprasPedidoList: any[] = [];
  comprasPedidoForm: FormGroup;
  isEditing: boolean = false;
  currentEditIndex: number | null = null;

  constructor(private comprasPedidoService: ComprasPedidoService, private fb: FormBuilder) {
    this.comprasPedidoForm = this.fb.group({
      nroCompra: [''],
      item: [''],
      pedido: [''],
      proveedor: [''],
      cantidad: [''],
      fechaInicio: [''],
      fechaFinal: ['']
    });
  }

  ngOnInit(): void {
    this.comprasPedidoList = this.comprasPedidoService.getComprasPedido();
  }

  agregarCompraPedido(): void {
    if (this.isEditing && this.currentEditIndex !== null) {
      this.comprasPedidoList[this.currentEditIndex] = this.comprasPedidoForm.value;
      this.isEditing = false;
      this.currentEditIndex = null;
    } else {
      this.comprasPedidoList.push(this.comprasPedidoForm.value);
    }
    this.comprasPedidoForm.reset();
  }

  eliminarCompraPedido(id: number): void {
    this.comprasPedidoList = this.comprasPedidoList.filter(compraPedido => compraPedido.nroCompra !== id);
  }

  editarCompraPedido(index: number): void {
    const compraPedido = this.comprasPedidoList[index];
    this.comprasPedidoForm.patchValue(compraPedido);
    this.isEditing = true;
    this.currentEditIndex = index;
  }

  cancelarEdicion(): void {
    this.isEditing = false;
    this.currentEditIndex = null;
    this.comprasPedidoForm.reset();
  }
}
