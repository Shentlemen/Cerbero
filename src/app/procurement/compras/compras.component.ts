import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ComprasService, CompraDTO } from '../../services/compras.service';
import { TiposCompraService, TipoDeCompraDTO } from '../../services/tipos-compra.service';
import { forkJoin } from 'rxjs';

interface CompraConTipo extends CompraDTO {
  tipoCompraDescripcion?: string;
}

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './compras.component.html',
  styleUrls: ['./compras.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ComprasComponent implements OnInit {
  comprasList: CompraConTipo[] = [];
  comprasFiltradas: CompraConTipo[] = [];
  tiposCompraList: TipoDeCompraDTO[] = [];
  filterForm: FormGroup;
  compraForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 11;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  showConfirmDialog = false;
  compraToDelete: number | null = null;

  constructor(
    private comprasService: ComprasService,
    private tiposCompraService: TiposCompraService,
    private fb: FormBuilder,
    private modalService: NgbModal
  ) {
    this.filterForm = this.fb.group({
      descripcion: [''],
      moneda: [''],
      fechaInicio: [''],
      fechaFinal: ['']
    });

    this.compraForm = this.fb.group({
      idCompra: [null],
      idTipoCompra: ['', Validators.required],
      moneda: ['', Validators.required],
      descripcion: ['', Validators.required],
      fechaInicio: ['', Validators.required],
      fechaFinal: ['', Validators.required],
      monto: ['', [Validators.required, Validators.min(0)]]
    });

    // Suscribirse a cambios en el formulario de filtro
    this.filterForm.valueChanges.subscribe(() => {
      this.aplicarFiltros();
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    // Cargar tipos de compra y compras en paralelo
    forkJoin({
      tiposCompra: this.tiposCompraService.getTiposCompra(),
      compras: this.comprasService.getCompras()
    }).subscribe({
      next: (data) => {
        this.tiposCompraList = data.tiposCompra;
        
        // Ahora procesar las compras con los tipos ya cargados
        this.comprasList = data.compras.map(compra => ({
          ...compra,
          tipoCompraDescripcion: this.getTipoCompraDescripcion(compra.idTipoCompra)
        }));
        
        this.comprasFiltradas = [...this.comprasList];
        this.collectionSize = this.comprasFiltradas.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar los datos:', error);
        this.error = 'Error al cargar los datos. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  loadTiposCompra(): void {
    this.tiposCompraService.getTiposCompra().subscribe({
      next: (tiposCompra) => {
        this.tiposCompraList = tiposCompra;
      },
      error: (error) => {
        console.error('Error al cargar los tipos de compra:', error);
        this.error = 'Error al cargar los tipos de compra. Por favor, intente nuevamente.';
      }
    });
  }

  loadCompras(): void {
    this.loading = true;
    this.error = null;
    
    this.comprasService.getCompras().subscribe({
      next: (compras) => {
        this.comprasList = compras.map(compra => ({
          ...compra,
          tipoCompraDescripcion: this.getTipoCompraDescripcion(compra.idTipoCompra)
        }));
        this.comprasFiltradas = [...this.comprasList];
        this.collectionSize = this.comprasFiltradas.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar las compras:', error);
        this.error = 'Error al cargar las compras. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  getTipoCompraDescripcion(idTipoCompra: number): string {
    const tipoCompra = this.tiposCompraList.find(tipo => tipo.idTipoCompra === idTipoCompra);
    return tipoCompra ? tipoCompra.descripcion : 'Tipo no encontrado';
  }

  get pagedCompras(): CompraConTipo[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.comprasFiltradas.slice(startItem, endItem);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.comprasFiltradas.sort((a, b) => {
      let valueA = a[column as keyof CompraConTipo];
      let valueB = b[column as keyof CompraConTipo];

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

  abrirModal(modal: any, compra?: CompraConTipo): void {
    if (compra) {
      this.modoEdicion = true;
      this.compraForm.patchValue({
        idCompra: compra.idCompra,
        idTipoCompra: compra.idTipoCompra,
        moneda: compra.moneda,
        descripcion: compra.descripcion,
        fechaInicio: compra.fechaInicio,
        fechaFinal: compra.fechaFinal,
        monto: compra.monto
      });
    } else {
      this.modoEdicion = false;
      this.compraForm.reset();
    }
    this.modalService.open(modal, { size: 'lg' });
  }

  guardarCompra(): void {
    if (this.compraForm.valid) {
      const compraData = this.compraForm.value;
      
      if (this.modoEdicion) {
        if (!compraData.idCompra) {
          this.error = 'Error: ID de compra no válido';
          return;
        }

        this.comprasService.actualizarCompra(compraData.idCompra, compraData).subscribe({
          next: () => {
            this.loadData();
            this.modalService.dismissAll();
          },
          error: (error) => {
            console.error('Error al actualizar la compra:', error);
            this.error = 'Error al actualizar la compra. Por favor, intente nuevamente.';
          }
        });
      } else {
        const { idCompra, ...nuevaCompra } = compraData;
        
        this.comprasService.crearCompra(nuevaCompra).subscribe({
          next: () => {
            this.loadData();
            this.modalService.dismissAll();
          },
          error: (error) => {
            console.error('Error al crear la compra:', error);
            this.error = 'Error al crear la compra. Por favor, intente nuevamente.';
          }
        });
      }
    }
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
    
    this.comprasFiltradas = this.comprasList.filter(compra => {
      let cumpleFiltros = true;

      if (filtros.descripcion && compra.descripcion) {
        cumpleFiltros = cumpleFiltros && 
          compra.descripcion.toLowerCase().includes(filtros.descripcion.toLowerCase());
      }

      if (filtros.moneda && compra.moneda) {
        cumpleFiltros = cumpleFiltros && 
          compra.moneda.toLowerCase().includes(filtros.moneda.toLowerCase());
      }

      if (filtros.fechaInicio && compra.fechaInicio) {
        cumpleFiltros = cumpleFiltros && 
          compra.fechaInicio >= filtros.fechaInicio;
      }

      if (filtros.fechaFinal && compra.fechaFinal) {
        cumpleFiltros = cumpleFiltros && 
          compra.fechaFinal <= filtros.fechaFinal;
      }

      return cumpleFiltros;
    });

    this.collectionSize = this.comprasFiltradas.length;
    this.page = 1;
  }

  eliminarCompra(id: number): void {
    this.compraToDelete = id;
    this.showConfirmDialog = true;
  }

  confirmarEliminacion(): void {
    if (this.compraToDelete) {
      this.comprasService.eliminarCompra(this.compraToDelete).subscribe({
        next: () => {
          this.loadData();
          this.showConfirmDialog = false;
          this.compraToDelete = null;
        },
        error: (error) => {
          console.error('Error al eliminar la compra:', error);
          this.error = 'Error al eliminar la compra. Por favor, intente nuevamente.';
          this.showConfirmDialog = false;
          this.compraToDelete = null;
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.compraToDelete = null;
  }

  formatearMoneda(monto: number, moneda: string): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: moneda
    }).format(monto);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-ES');
  }
} 