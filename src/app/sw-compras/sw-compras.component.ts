import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SwComprasService } from '../sw-compras.service';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-sw-compras',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './sw-compras.component.html',
  styleUrls: ['./sw-compras.component.css']
})
export class SwComprasComponent implements OnInit {

  swComprasList: any[] = [];
  swComprasFiltrado: any[] = [];
  swComprasForm: FormGroup;
  filterForm: FormGroup;
  currentEditIndex: number | null = null;
  currentViewIndex: number | null = null;
  isEditing: boolean = false;

  constructor(private swComprasService: SwComprasService, private fb: FormBuilder, private modalService: NgbModal) {
    this.swComprasForm = this.fb.group({
      nroSoftware: [''],
      nroCompra: [''],
      item: [''],
      pedido: [''],
      descripcion: ['']
    });

    this.filterForm = this.fb.group({
      nroSoftware: [''],
      nroCompra: [''],
      item: [''],
      pedido: [''],
      descripcion: ['']
    });
  }

  ngOnInit(): void {
    this.swComprasList = this.swComprasService.getSwCompras();
    this.swComprasFiltrado = this.swComprasList; // Inicialmente, sin filtros
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;

    this.swComprasFiltrado = this.swComprasList.filter(swCompra => {
      return Object.keys(filtros).every(key => {
        const filtroValor = filtros[key];
        const swCompraValor = swCompra[key];

        if (typeof swCompraValor === 'number' && filtroValor !== '') {
          return swCompraValor === +filtroValor;  // Comparación exacta para números
        } else {
          return swCompraValor.toString().toLowerCase().includes(filtroValor.toString().toLowerCase().trim());
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
      this.swComprasForm.reset();   // Resetea el formulario
      this.swComprasForm.enable();  // Vuelve a habilitar el formulario
    }, 200);
  }

  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const swCompra = this.swComprasList[index];
    if (swCompra) {
      this.swComprasForm.patchValue(swCompra);
      this.swComprasForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }

  abrirModalVer(modal: any, index: number): void {
    if (this.isEditing) {
      return;  // No abrir el modal de "Ver" si estás en modo edición
    }
    this.currentViewIndex = index;
    const swCompra = this.swComprasList[this.currentViewIndex];
    if (swCompra) {
      this.swComprasForm.patchValue(swCompra);
      this.swComprasForm.disable();  // Deshabilita el formulario para solo ver
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }

  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.swComprasList[this.currentEditIndex] = this.swComprasForm.value;
      this.modalService.dismissAll();
      this.resetFormulario();
    }
  }

  exportarAPdf(): void {
    const doc = new jsPDF();
    const swCompra = this.swComprasList[this.currentViewIndex!];

    doc.text('Compra de Software Details', 10, 10);
    doc.text(`Número de Software: ${swCompra.nroSoftware}`, 10, 20);
    doc.text(`Número de Compra: ${swCompra.nroCompra}`, 10, 30);
    doc.text(`Item: ${swCompra.item}`, 10, 40);
    doc.text(`Pedido: ${swCompra.pedido}`, 10, 50);
    doc.text(`Descripción: ${swCompra.descripcion}`, 10, 60);

    doc.save('sw-compra-details.pdf');
  }

  eliminarSwCompra(id: number): void {
    this.swComprasList = this.swComprasList.filter(swCompra => swCompra.nroCompra !== id);
  }
}
