import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HwSwComprasService } from '../hw-sw-compras.service';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-hw-sw-compras',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './hw-sw-compras.component.html',
  styleUrls: ['./hw-sw-compras.component.css']
})
export class HwSwComprasComponent implements OnInit {

  hwSwComprasList: any[] = [];
  hwSwComprasFiltrado: any[] = [];
  hwSwComprasForm: FormGroup;
  filterForm: FormGroup;
  currentEditIndex: number | null = null;
  currentViewIndex: number | null = null;
  isEditing: boolean = false;

  constructor(private hwSwComprasService: HwSwComprasService, private fb: FormBuilder, private modalService: NgbModal) {
    this.hwSwComprasForm = this.fb.group({
      nroEquipo: [''],
      nroSoftware: [''],
      nroCompra: [''],
      item: [''],
      pedido: ['']
    });

    this.filterForm = this.fb.group({
      nroEquipo: [''],
      nroSoftware: [''],
      nroCompra: ['']
    });
  }

  ngOnInit(): void {
    this.hwSwComprasList = this.hwSwComprasService.getHwSwCompras();
    this.hwSwComprasFiltrado = this.hwSwComprasList; // Inicialmente, sin filtros
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;

    this.hwSwComprasFiltrado = this.hwSwComprasList.filter(hwSwCompra => {
      return Object.keys(filtros).every(key => {
        const filtroValor = filtros[key];
        const hwSwCompraValor = hwSwCompra[key];

        // Comprobamos si el valor es un número y comparamos adecuadamente
        if (typeof hwSwCompraValor === 'number' && filtroValor !== '') {
          return hwSwCompraValor === +filtroValor;  // Comparación exacta para números
        } else {
          // Convertimos a string para asegurar la comparación correcta en otros casos
          return hwSwCompraValor.toString().toLowerCase().includes(filtroValor.toString().toLowerCase().trim());
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
      this.hwSwComprasForm.reset();   // Resetea el formulario
      this.hwSwComprasForm.enable();  // Vuelve a habilitar el formulario
    }, 200);
  }

  abrirModalEditar(modal: any, index: number): void {
    this.isEditing = true;  // Cambia a modo edición
    this.currentEditIndex = index;
    const hwSwCompra = this.hwSwComprasList[index];
    if (hwSwCompra) {
      this.hwSwComprasForm.patchValue(hwSwCompra);
      this.hwSwComprasForm.enable();  // Asegúrate de que el formulario esté habilitado para edición
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }

  abrirModalVer(modal: any, hwSwCompra: any): void {
    if (this.isEditing) {
      return;  // No abrir el modal de "Ver" si estás en modo edición
    }
    this.currentViewIndex = this.hwSwComprasList.findIndex(h => h.nroCompra === hwSwCompra.nroCompra);
    if (this.currentViewIndex !== -1) {
      this.hwSwComprasForm.patchValue(hwSwCompra);
      this.hwSwComprasForm.disable();  // Deshabilita el formulario para solo ver
      this.modalService.open(modal, { ariaLabelledBy: 'editModalLabel' }).result.then(
        () => this.resetFormulario(),
        () => this.resetFormulario()
      );
    }
  }

  guardarCambios(): void {
    if (this.currentEditIndex !== null) {
      this.hwSwComprasList[this.currentEditIndex] = this.hwSwComprasForm.value;
      this.modalService.dismissAll();
      this.resetFormulario();
    }
  }

  exportarAPdf(): void {
    const doc = new jsPDF();
    const hwSwCompra = this.hwSwComprasList[this.currentViewIndex!];

    doc.text('Compra de Hardware y Software Details', 10, 10);
    doc.text(`Número de Equipo: ${hwSwCompra.nroEquipo}`, 10, 20);
    doc.text(`Número de Software: ${hwSwCompra.nroSoftware}`, 10, 30);
    doc.text(`Número de Compra: ${hwSwCompra.nroCompra}`, 10, 40);
    doc.text(`Item: ${hwSwCompra.item}`, 10, 50);
    doc.text(`Pedido: ${hwSwCompra.pedido}`, 10, 60);

    doc.save('hw-sw-compra-details.pdf');
  }

  eliminarHwSwCompras(id: number): void {
    this.hwSwComprasList = this.hwSwComprasList.filter(hwSwCompra => hwSwCompra.nroCompra !== id);
  }
}
