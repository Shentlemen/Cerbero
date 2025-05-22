import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TiposCompraService, TipoDeCompraDTO } from '../../services/tipos-compra.service';

@Component({
  selector: 'app-tipos-compra',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './tipos-compra.component.html',
  styleUrls: ['./tipos-compra.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class TiposCompraComponent implements OnInit {
  tiposCompraList: TipoDeCompraDTO[] = [];
  tiposCompraFiltrados: TipoDeCompraDTO[] = [];
  tipoCompraForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 11;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  tipoCompraSeleccionado: TipoDeCompraDTO | null = null;
  showConfirmDialog = false;
  tipoCompraToDelete: number | null = null;

  constructor(
    private tiposCompraService: TiposCompraService,
    private fb: FormBuilder,
    private modalService: NgbModal
  ) {
    this.tipoCompraForm = this.fb.group({
      descripcion: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadTiposCompra();
  }

  loadTiposCompra(): void {
    this.loading = true;
    this.error = null;
    
    this.tiposCompraService.getTiposCompra().subscribe({
      next: (tiposCompra) => {
        this.tiposCompraList = tiposCompra;
        this.tiposCompraFiltrados = [...this.tiposCompraList];
        this.collectionSize = this.tiposCompraFiltrados.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar los tipos de compra:', error);
        this.error = 'Error al cargar los tipos de compra. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  get pagedTiposCompra(): TipoDeCompraDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.tiposCompraFiltrados.slice(startItem, endItem);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.tiposCompraFiltrados.sort((a, b) => {
      let valueA = a[column as keyof TipoDeCompraDTO];
      let valueB = b[column as keyof TipoDeCompraDTO];

      if (valueA === null || valueA === undefined) valueA = '';
      if (valueB === null || valueB === undefined) valueB = '';

      if (typeof valueA === 'string') valueA = valueA.toLowerCase();
      if (typeof valueB === 'string') valueB = valueB.toLowerCase();

      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  abrirModal(modal: any, tipoCompra?: TipoDeCompraDTO): void {
    if (tipoCompra) {
      this.modoEdicion = true;
      this.tipoCompraSeleccionado = tipoCompra;
      this.tipoCompraForm.patchValue(tipoCompra);
    } else {
      this.modoEdicion = false;
      this.tipoCompraSeleccionado = null;
      this.tipoCompraForm.reset();
    }
    this.modalService.open(modal, { size: 'lg' });
  }

  guardarTipoCompra(): void {
    if (this.tipoCompraForm.valid) {
      const descripcion = this.tipoCompraForm.get('descripcion')?.value;
      
      if (!descripcion || descripcion.trim() === '') {
        this.error = 'La descripción es obligatoria';
        return;
      }

      const tipoCompraData = { descripcion: descripcion.trim() };
      console.log('Datos a enviar:', tipoCompraData);
      
      if (this.modoEdicion && this.tipoCompraSeleccionado) {
        if (!this.tipoCompraSeleccionado.idTipoCompra || isNaN(this.tipoCompraSeleccionado.idTipoCompra)) {
          this.error = 'ID de tipo de compra no válido';
          return;
        }

        const tipoCompraActualizado: TipoDeCompraDTO = {
          ...tipoCompraData,
          idTipoCompra: this.tipoCompraSeleccionado.idTipoCompra
        };
        
        this.tiposCompraService.actualizarTipoCompra(this.tipoCompraSeleccionado.idTipoCompra, tipoCompraActualizado).subscribe({
          next: (tipoActualizado) => {
            console.log('Tipo de compra actualizado:', tipoActualizado);
            this.loadTiposCompra();
            this.modalService.dismissAll();
            this.error = null;
          },
          error: (error) => {
            console.error('Error al actualizar el tipo de compra:', error);
            this.error = error.message || 'Error al actualizar el tipo de compra. Por favor, intente nuevamente.';
          }
        });
      } else {
        this.tiposCompraService.crearTipoCompra(tipoCompraData).subscribe({
          next: (tipoCreado) => {
            console.log('Tipo de compra creado:', tipoCreado);
            this.loadTiposCompra();
            this.modalService.dismissAll();
            this.error = null;
          },
          error: (error) => {
            console.error('Error al crear el tipo de compra:', error);
            this.error = error.message || 'Error al crear el tipo de compra. Por favor, intente nuevamente.';
          }
        });
      }
    } else {
      Object.keys(this.tipoCompraForm.controls).forEach(key => {
        const control = this.tipoCompraForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  eliminarTipoCompra(id: number): void {
    this.tipoCompraToDelete = id;
    this.showConfirmDialog = true;
  }

  confirmarEliminacion(): void {
    if (this.tipoCompraToDelete) {
      this.tiposCompraService.eliminarTipoCompra(this.tipoCompraToDelete).subscribe({
        next: () => {
          this.loadTiposCompra();
          this.showConfirmDialog = false;
          this.tipoCompraToDelete = null;
          this.error = null;
        },
        error: (error) => {
          console.error('Error al eliminar el tipo de compra:', error);
          this.error = error.message || 'Error al eliminar el tipo de compra. Por favor, intente nuevamente.';
          this.showConfirmDialog = false;
          this.tipoCompraToDelete = null;
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.tipoCompraToDelete = null;
  }
} 