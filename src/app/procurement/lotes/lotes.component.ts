import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { LotesService, LoteDTO } from '../../services/lotes.service';
import { ProveedoresService, ProveedorDTO } from '../../services/proveedores.service';
import { ServiciosGarantiaService, ServicioGarantiaDTO } from '../../services/servicios-garantia.service';
import { ComprasService, CompraDTO } from '../../services/compras.service';

@Component({
  selector: 'app-lotes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './lotes.component.html',
  styleUrls: ['./lotes.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class LotesComponent implements OnInit {
  lotesList: LoteDTO[] = [];
  lotesFiltrados: LoteDTO[] = [];
  proveedoresList: ProveedorDTO[] = [];
  serviciosGarantiaList: ServicioGarantiaDTO[] = [];
  comprasList: CompraDTO[] = [];
  filterForm: FormGroup;
  loteForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 11;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  loteSeleccionado: LoteDTO | null = null;
  showConfirmDialog = false;
  loteToDelete: number | null = null;

  constructor(
    private lotesService: LotesService,
    private proveedoresService: ProveedoresService,
    private serviciosGarantiaService: ServiciosGarantiaService,
    private comprasService: ComprasService,
    private fb: FormBuilder,
    private modalService: NgbModal
  ) {
    this.filterForm = this.fb.group({
      descripcion: [''],
      idCompra: [''],
      idProveedor: ['']
    });

    this.loteForm = this.fb.group({
      idCompra: ['', [Validators.required, Validators.min(1)]],
      nombreItem: ['', [Validators.required]],
      descripcion: ['', Validators.required],
      cantidad: ['', [Validators.required, Validators.min(1)]],
      mesesGarantia: ['', [Validators.required, Validators.min(0)]],
      idProveedores: ['', [Validators.required, Validators.min(1)]],
      idServicioGarantia: ['', [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.loadLotes();
    this.loadProveedores();
    this.loadServiciosGarantia();
    this.loadCompras();
  }

  loadCompras(): void {
    this.comprasService.getCompras().subscribe({
      next: (compras) => {
        this.comprasList = compras;
      },
      error: (error) => {
        console.error('Error al cargar las compras:', error);
        this.error = 'Error al cargar las compras. Por favor, intente nuevamente.';
      }
    });
  }

  loadServiciosGarantia(): void {
    this.serviciosGarantiaService.getServiciosGarantia().subscribe({
      next: (servicios) => {
        this.serviciosGarantiaList = servicios;
      },
      error: (error) => {
        console.error('Error al cargar los servicios de garantía:', error);
        this.error = 'Error al cargar los servicios de garantía. Por favor, intente nuevamente.';
      }
    });
  }

  loadLotes(): void {
    this.loading = true;
    this.error = null;
    
    this.lotesService.getLotes().subscribe({
      next: (lotes) => {
        this.lotesList = lotes;
        this.lotesFiltrados = [...this.lotesList];
        this.collectionSize = this.lotesFiltrados.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar los lotes:', error);
        this.error = 'Error al cargar los lotes. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  loadProveedores(): void {
    this.proveedoresService.getProveedores().subscribe({
      next: (proveedores) => {
        this.proveedoresList = proveedores;
      },
      error: (error) => {
        console.error('Error al cargar los proveedores:', error);
        this.error = 'Error al cargar los proveedores. Por favor, intente nuevamente.';
      }
    });
  }

  get pagedLotes(): LoteDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.lotesFiltrados.slice(startItem, endItem);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.lotesFiltrados.sort((a, b) => {
      let valueA = a[column as keyof LoteDTO];
      let valueB = b[column as keyof LoteDTO];

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

  abrirModal(modal: any, lote?: LoteDTO): void {
    if (lote) {
      this.modoEdicion = true;
      this.loteSeleccionado = lote;
      this.loteForm.patchValue({
        ...lote,
        idProveedores: lote.idProveedor
      });
    } else {
      this.modoEdicion = false;
      this.loteSeleccionado = null;
      this.loteForm.reset();
    }
    this.modalService.open(modal, { size: 'lg' });
  }

  guardarLote(): void {
    if (this.loteForm.valid) {
      const formData = this.loteForm.value;
      const loteData = {
        nombreItem: formData.nombreItem,
        idCompra: Number(formData.idCompra),
        descripcion: formData.descripcion,
        cantidad: Number(formData.cantidad),
        mesesGarantia: Number(formData.mesesGarantia),
        idProveedor: Number(formData.idProveedores),
        idServicioGarantia: Number(formData.idServicioGarantia)
      };
      
      console.log('Datos del formulario:', formData);
      console.log('Datos a enviar al backend:', loteData);
      
      if (this.modoEdicion && this.loteSeleccionado) {
        const loteActualizado: LoteDTO = {
          ...loteData,
          idItem: this.loteSeleccionado.idItem
        };
        
        this.lotesService.actualizarLote(this.loteSeleccionado.idItem, loteActualizado).subscribe({
          next: (mensaje) => {
            console.log('Lote actualizado exitosamente');
            this.loadLotes();
            this.modalService.dismissAll();
            this.error = null;
          },
          error: (error) => {
            console.error('Error al actualizar el lote:', error);
            this.error = error.message || 'Error al actualizar el lote. Por favor, intente nuevamente.';
          }
        });
      } else {
        this.lotesService.crearLote(loteData).subscribe({
          next: (mensaje) => {
            console.log('Lote creado exitosamente');
            this.loadLotes();
            this.modalService.dismissAll();
            this.error = null;
          },
          error: (error) => {
            console.error('Error al crear el lote:', error);
            this.error = error.message || 'Error al crear el lote. Por favor, intente nuevamente.';
          }
        });
      }
    }
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
    
    this.lotesFiltrados = this.lotesList.filter(lote => {
      let cumpleFiltros = true;

      if (filtros.descripcion && lote.descripcion) {
        cumpleFiltros = cumpleFiltros && 
          lote.descripcion.toLowerCase().includes(filtros.descripcion.toLowerCase());
      }

      if (filtros.idCompra) {
        cumpleFiltros = cumpleFiltros && 
          lote.idCompra === Number(filtros.idCompra);
      }

      if (filtros.idProveedor) {
        cumpleFiltros = cumpleFiltros && 
          lote.idProveedor === Number(filtros.idProveedor);
      }

      return cumpleFiltros;
    });

    this.collectionSize = this.lotesFiltrados.length;
    this.page = 1;
  }

  eliminarLote(id: number): void {
    this.loteToDelete = id;
    this.showConfirmDialog = true;
  }

  confirmarEliminacion(): void {
    if (this.loteToDelete) {
      this.lotesService.eliminarLote(this.loteToDelete).subscribe({
        next: (mensaje) => {
          console.log(mensaje);
          this.loadLotes();
          this.showConfirmDialog = false;
          this.loteToDelete = null;
        },
        error: (error) => {
          console.error('Error al eliminar el lote:', error);
          this.error = 'Error al eliminar el lote. Por favor, intente nuevamente.';
          this.showConfirmDialog = false;
          this.loteToDelete = null;
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.loteToDelete = null;
  }
} 