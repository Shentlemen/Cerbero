import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TiposCompraService, TipoDeCompraDTO } from '../../services/tipos-compra.service';
import { TourRegistryService } from '../../services/tour-registry.service';

type TipoCompraSortColumn = 'descripcion' | 'abreviado';

@Component({
  selector: 'app-tipos-compra',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './tipos-compra.component.html',
  styleUrls: ['./tipos-compra.component.css']
})
export class TiposCompraComponent implements OnInit, OnDestroy {
  tiposCompraList: TipoDeCompraDTO[] = [];
  tiposCompraFiltrados: TipoDeCompraDTO[] = [];
  tipoCompraForm: FormGroup;
  searchTerm = '';
  sortColumn: TipoCompraSortColumn = 'descripcion';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 25;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  tipoCompraSeleccionado: TipoDeCompraDTO | null = null;
  showConfirmDialog = false;
  tipoCompraToDelete: number | null = null;
  private tourCleanup?: () => void;

  constructor(
    private tiposCompraService: TiposCompraService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private tourRegistry: TourRegistryService
  ) {
    this.tipoCompraForm = this.fb.group({
      descripcion: ['', Validators.required],
      abreviado: ['', [Validators.maxLength(10)]]
    });
  }

  ngOnInit(): void {
    this.loadTiposCompra();
    this.tourCleanup = this.tourRegistry.register('tipos-compra', [{
      id: 'tipos-compra-overview',
      title: 'Tour de tipos de compra',
      icon: 'fa-route',
      steps: [
        { selector: '#tour-tipos-compra-title', title: 'Tipos de compra', description: 'Clasificación para filtros y etiquetas en órdenes de compra (descripción y abreviatura opcional).', side: 'bottom' },
        { selector: '#tour-tipos-compra-nuevo', title: 'Nuevo tipo', description: 'Alta desde modal; luego aparecerá en chips de compras.', side: 'left' },
        { selector: '#tour-tipos-compra-search', title: 'Búsqueda', description: 'Filtrá en tiempo real por descripción o abreviatura.', side: 'bottom' },
        { selector: '#tour-tipos-compra-table', title: 'Listado', description: 'Ordená por columna, navegá con paginación, editá o eliminá tipos.', side: 'top' }
      ]
    }]);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
  }

  loadTiposCompra(): void {
    this.loading = true;
    this.error = null;

    this.tiposCompraService.getTiposCompra().subscribe({
      next: (tiposCompra) => {
        this.tiposCompraList = tiposCompra;
        this.aplicarFiltrosYOrden();
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
    return this.tiposCompraFiltrados.slice(startItem, startItem + this.pageSize);
  }

  get rangoDesde(): number {
    if (this.collectionSize === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get rangoHasta(): number {
    return Math.min(this.page * this.pageSize, this.collectionSize);
  }

  onSearchTermChange(): void {
    this.page = 1;
    this.aplicarFiltrosYOrden();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchTermChange();
  }

  sortData(column: TipoCompraSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.page = 1;
    this.ordenarLista(this.tiposCompraFiltrados);
  }

  getSortIcon(column: TipoCompraSortColumn): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  isSortActive(column: TipoCompraSortColumn): boolean {
    return this.sortColumn === column;
  }

  private aplicarFiltrosYOrden(): void {
    const term = this.searchTerm.trim().toLowerCase();
    this.tiposCompraFiltrados = term
      ? this.tiposCompraList.filter((t) => this.matchesSearch(t, term))
      : [...this.tiposCompraList];
    this.ordenarLista(this.tiposCompraFiltrados);
    this.collectionSize = this.tiposCompraFiltrados.length;
    const maxPage = Math.max(1, Math.ceil(this.collectionSize / this.pageSize) || 1);
    if (this.page > maxPage) {
      this.page = maxPage;
    }
  }

  private matchesSearch(t: TipoDeCompraDTO, term: string): boolean {
    const haystack = [t.descripcion, t.abreviado]
      .map((v) => (v ?? '').toString().trim().toLowerCase())
      .join(' ');
    return haystack.includes(term);
  }

  private ordenarLista(lista: TipoDeCompraDTO[]): void {
    const col = this.sortColumn;
    const mult = this.sortDirection === 'asc' ? 1 : -1;
    lista.sort((a, b) => {
      const valA = this.getSortValue(a, col);
      const valB = this.getSortValue(b, col);
      return valA.localeCompare(valB, 'es', { sensitivity: 'base' }) * mult;
    });
  }

  private getSortValue(t: TipoDeCompraDTO, col: TipoCompraSortColumn): string {
    if (col === 'descripcion') {
      return (t.descripcion ?? '').trim().toLowerCase();
    }
    return (t.abreviado ?? '').trim().toLowerCase();
  }

  abrirModal(modal: any, tipoCompra?: TipoDeCompraDTO): void {
    if (tipoCompra) {
      this.modoEdicion = true;
      this.tipoCompraSeleccionado = tipoCompra;
      this.tipoCompraForm.patchValue({
        descripcion: tipoCompra.descripcion,
        abreviado: tipoCompra.abreviado || ''
      });
    } else {
      this.modoEdicion = false;
      this.tipoCompraSeleccionado = null;
      this.tipoCompraForm.reset();
    }
    this.modalService.open(modal, {
      size: 'lg',
      backdrop: true
    });
  }

  guardarTipoCompra(): void {
    if (this.tipoCompraForm.valid) {
      const descripcion = this.tipoCompraForm.get('descripcion')?.value;
      const abreviado = this.tipoCompraForm.get('abreviado')?.value;

      if (!descripcion || descripcion.trim() === '') {
        this.error = 'La descripción es obligatoria';
        return;
      }

      const tipoCompraData = {
        descripcion: descripcion.trim(),
        abreviado: abreviado ? abreviado.trim() : null
      };

      if (this.modoEdicion && this.tipoCompraSeleccionado) {
        if (!this.tipoCompraSeleccionado.idTipoCompra || isNaN(this.tipoCompraSeleccionado.idTipoCompra)) {
          this.error = 'ID de tipo de compra no válido';
          return;
        }

        const tipoCompraActualizado: TipoDeCompraDTO = {
          descripcion: tipoCompraData.descripcion,
          abreviado: tipoCompraData.abreviado,
          idTipoCompra: this.tipoCompraSeleccionado.idTipoCompra
        };

        this.tiposCompraService.actualizarTipoCompra(this.tipoCompraSeleccionado.idTipoCompra, tipoCompraActualizado).subscribe({
          next: () => {
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
          next: () => {
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
