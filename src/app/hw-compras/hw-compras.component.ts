import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HwComprasService } from '../hw-compras.service';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-hw-compras',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './hw-compras.component.html',
  styleUrls: ['./hw-compras.component.css']
})
export class HwComprasComponent implements OnInit {

  hwComprasList: any[] = [];
  hwComprasFiltrado: any[] = [];
  hwComprasForm: FormGroup;
  filterForm: FormGroup;
  currentEditIndex: number | null = null;
  currentViewIndex: number | null = null;
  isEditing: boolean = false;

  constructor(private hwComprasService: HwComprasService, private fb: FormBuilder, private modalService: NgbModal) {
    this.hwComprasForm = this.fb.group({
      nroEquipo: [''],
      nroCompra: [''],
      item: [''],
      pedido: [''],
      descripcion: ['']
    });

    this.filterForm = this.fb.group({
      nroEquipo: [''],
      nroCompra: [''],
      item: [''],
      pedido: ['']
    });
  }

  ngOnInit(): void {
    this.hwComprasList = this.hwComprasService.getHwCompras();
    this.hwComprasFiltrado = this.hwComprasList; // Inicialmente, sin filtros
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
  
    this.hwComprasFiltrado = this.hwComprasList.filter(hwCompra => {
      return Object.keys(filtros).every(key => {
        const filtroValor = filtros[key];
        const hwCompraValor = hwCompra[key];
  
        // Comprobamos si el valor es un número y comparamos adecuadamente
        if (typeof hwCompraValor === 'number' && filtroValor !== '') {
          return hwCompraValor === +filtroValor;  // Comparación exacta para números
        } else if (filtroValor !== '') {
          // Convertimos a string para asegurar la comparación correcta en otros casos
          return hwCompraValor.toString().toLowerCase().includes(filtroValor.toString().toLowerCase().trim());
        } else {
          return true; // Si el filtro está vacío, incluimos todos los elementos
        }
      });
    });
  }

  cancelarEdicion(): void {
    this.modalService.dismissAll();  // Cierra todos los modales
    this.resetFormulario();
  }

  cerrarModal(modal: any): void {
    modal.dismiss();  // Cierra el modal específico
    this.resetFormulario();
  }

  resetFormulario(): void {
    setTimeout(() => {
      this.isEditing = false;
      this.currentEditIndex = null;
      this.currentViewIndex = null;  // Resetea el índice de visualización actual
      this.hwComprasForm.reset();   // Resetea el formulario
      this.hwComprasForm.enable();  // Vuelve a habilitar el formulario
    }, 200);
  }

  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const hwCompra = this.hwComprasList[index];
    if (hwCompra) {
      this.hwComprasForm.patchValue(hwCompra);
      this.hwComprasForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }

  abrirModalVer(modal: any, hwCompra: any): void {
    if (this.isEditing) {
      return;  // No abrir el modal de "Ver" si estás en modo edición
    }
    this.currentViewIndex = this.hwComprasList.findIndex(h => h.nroCompra === hwCompra.nroCompra);
    if (this.currentViewIndex !== -1) {
      this.hwComprasForm.patchValue(hwCompra);
      this.hwComprasForm.disable();  // Deshabilita el formulario para solo ver
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }

  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.hwComprasList[this.currentEditIndex] = this.hwComprasForm.value;
      this.modalService.dismissAll();
      this.resetFormulario();
    }
  }

  exportarAPdf(): void {
    const doc = new jsPDF();
    const hwCompra = this.hwComprasList[this.currentViewIndex!];

    doc.text('Compra de Hardware Details', 10, 10);
    doc.text(`Número de Equipo: ${hwCompra.nroEquipo}`, 10, 20);
    doc.text(`Número de Compra: ${hwCompra.nroCompra}`, 10, 30);
    doc.text(`Item: ${hwCompra.item}`, 10, 40);
    doc.text(`Pedido: ${hwCompra.pedido}`, 10, 50);
    doc.text(`Descripción: ${hwCompra.descripcion}`, 10, 60);

    doc.save('hw-compra-details.pdf');
  }

  eliminarHwCompra(id: number): void {
    this.hwComprasList = this.hwComprasList.filter(hwCompra => hwCompra.nroCompra !== id);
    this.aplicarFiltros(); // Volver a aplicar filtros después de eliminar
  }
}
