import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TiposActivoService, TipoDeActivoDTO } from '../../services/tipos-activo.service';
import { UsuariosService, UsuarioDTO } from '../../services/usuarios.service';
import { TourRegistryService } from '../../services/tour-registry.service';

type TipoActivoSortColumn = 'idActivo' | 'descripcion' | 'usuario';

@Component({
  selector: 'app-tipos-activo',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './tipos-activo.component.html',
  styleUrls: ['./tipos-activo.component.css']
})
export class TiposActivoComponent implements OnInit, OnDestroy {
  @ViewChild('tipoActivoModal') tipoActivoModal: any;

  tiposActivoList: TipoDeActivoDTO[] = [];
  tiposActivoFiltrados: TipoDeActivoDTO[] = [];
  usuariosList: UsuarioDTO[] = [];
  tipoActivoForm: FormGroup;
  searchTerm = '';
  sortColumn: TipoActivoSortColumn = 'descripcion';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 25;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  tipoActivoSeleccionado: TipoDeActivoDTO | null = null;
  showConfirmDialog = false;
  tipoActivoToDelete: number | null = null;
  private tourCleanup?: () => void;

  constructor(
    private tiposActivoService: TiposActivoService,
    private usuariosService: UsuariosService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private tourRegistry: TourRegistryService
  ) {
    this.tipoActivoForm = this.fb.group({
      descripcion: ['', [Validators.required]],
      idUsuario: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.cargarUsuarios();
    this.cargarTiposActivo();
    this.tourCleanup = this.tourRegistry.register('tipos-activo', [{
      id: 'tipos-activo-overview',
      title: 'Tour de tipos de activo',
      icon: 'fa-route',
      steps: [
        { selector: '#tour-tipos-activo-title', title: 'Tipos de activo', description: 'Catálogo usado al dar de alta equipos en inventario Cerbero; cada tipo puede tener usuario responsable por defecto.', side: 'bottom' },
        { selector: '#tour-tipos-activo-nuevo', title: 'Nuevo tipo', description: 'Creá descripción y vinculá el usuario responsable automático en altas.', side: 'left' },
        { selector: '#tour-tipos-activo-search', title: 'Búsqueda', description: 'Filtrá en tiempo real por ID, descripción o usuario responsable.', side: 'bottom' },
        { selector: '#tour-tipos-activo-table', title: 'Listado', description: 'Ordená por columna, navegá con paginación, editá o eliminá tipos.', side: 'top' }
      ]
    }]);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
  }

  cargarUsuarios(): void {
    this.usuariosService.getUsuarios().subscribe({
      next: (usuarios) => {
        this.usuariosList = usuarios;
      },
      error: (error) => {
        console.error('Error al cargar usuarios:', error);
        this.error = 'Error al cargar los usuarios. Por favor, intente nuevamente.';
      }
    });
  }

  getNombreUsuario(idUsuario: number): string {
    const usuario = this.usuariosList.find(u => u.idUsuario === idUsuario);
    return usuario ? `${usuario.nombre} ${usuario.apellido}` : 'No asignado';
  }

  cargarTiposActivo(): void {
    this.loading = true;
    this.error = null;
    this.tiposActivoService.getTiposActivo().subscribe({
      next: (data) => {
        this.tiposActivoList = data;
        this.aplicarFiltrosYOrden();
        this.loading = false;
      },
      error: () => {
        this.error = 'Error al cargar los tipos de activo';
        this.loading = false;
      }
    });
  }

  get pagedTiposActivo(): TipoDeActivoDTO[] {
    const start = (this.page - 1) * this.pageSize;
    return this.tiposActivoFiltrados.slice(start, start + this.pageSize);
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

  sortData(column: TipoActivoSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.page = 1;
    this.ordenarLista(this.tiposActivoFiltrados);
  }

  getSortIcon(column: TipoActivoSortColumn): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  isSortActive(column: TipoActivoSortColumn): boolean {
    return this.sortColumn === column;
  }

  private aplicarFiltrosYOrden(): void {
    const term = this.searchTerm.trim().toLowerCase();
    this.tiposActivoFiltrados = term
      ? this.tiposActivoList.filter((t) => this.matchesSearch(t, term))
      : [...this.tiposActivoList];
    this.ordenarLista(this.tiposActivoFiltrados);
    this.collectionSize = this.tiposActivoFiltrados.length;
    const maxPage = Math.max(1, Math.ceil(this.collectionSize / this.pageSize) || 1);
    if (this.page > maxPage) {
      this.page = maxPage;
    }
  }

  private matchesSearch(t: TipoDeActivoDTO, term: string): boolean {
    const haystack = [
      t.idActivo?.toString(),
      t.descripcion,
      t.nombre,
      this.getNombreUsuario(t.idUsuario)
    ]
      .map((v) => (v ?? '').toString().trim().toLowerCase())
      .join(' ');
    return haystack.includes(term);
  }

  private ordenarLista(lista: TipoDeActivoDTO[]): void {
    const col = this.sortColumn;
    const dir = this.sortDirection;
    const mult = dir === 'asc' ? 1 : -1;
    lista.sort((a, b) => {
      let cmp: number;
      if (col === 'idActivo') {
        cmp = (a.idActivo ?? 0) - (b.idActivo ?? 0);
      } else {
        const valA = this.getSortValueTexto(a, col);
        const valB = this.getSortValueTexto(b, col);
        cmp = valA.localeCompare(valB, 'es', { sensitivity: 'base' });
      }
      return cmp * mult;
    });
  }

  private getSortValueTexto(t: TipoDeActivoDTO, col: Exclude<TipoActivoSortColumn, 'idActivo'>): string {
    switch (col) {
      case 'descripcion':
        return (t.descripcion ?? '').trim();
      case 'usuario':
        return this.getNombreUsuario(t.idUsuario).toLowerCase();
      default:
        return '';
    }
  }

  openNewTipoActivoModal(): void {
    this.modoEdicion = false;
    this.tipoActivoSeleccionado = null;
    this.tipoActivoForm.reset();
    this.modalService.open(this.tipoActivoModal, {
      backdrop: false
    });
  }

  editTipoActivo(tipo: TipoDeActivoDTO): void {
    this.modoEdicion = true;
    this.tipoActivoSeleccionado = tipo;
    this.tipoActivoForm.patchValue({
      descripcion: tipo.descripcion,
      idUsuario: tipo.idUsuario
    });
    this.modalService.open(this.tipoActivoModal, {
      backdrop: false
    });
  }

  saveTipoActivo(): void {
    if (this.tipoActivoForm.valid) {
      const tipoActivo = this.tipoActivoForm.value;
      if (this.modoEdicion && this.tipoActivoSeleccionado) {
        if (!this.tipoActivoSeleccionado.idActivo || isNaN(this.tipoActivoSeleccionado.idActivo)) {
          this.error = 'ID de tipo de activo no válido';
          return;
        }

        tipoActivo.idActivo = this.tipoActivoSeleccionado.idActivo;
        this.tiposActivoService.actualizarTipoActivo(this.tipoActivoSeleccionado.idActivo, tipoActivo).subscribe({
          next: () => {
            this.modalService.dismissAll();
            this.cargarTiposActivo();
            this.error = null;
          },
          error: (error) => {
            console.error('Error al actualizar el tipo de activo:', error);
            this.error = error.message || 'Error al actualizar el tipo de activo. Por favor, intente nuevamente.';
          }
        });
      } else {
        this.tiposActivoService.crearTipoActivo(tipoActivo).subscribe({
          next: () => {
            this.modalService.dismissAll();
            this.cargarTiposActivo();
            this.error = null;
          },
          error: (error) => {
            console.error('Error al crear el tipo de activo:', error);
            this.error = error.message || 'Error al crear el tipo de activo. Por favor, intente nuevamente.';
          }
        });
      }
    } else {
      Object.keys(this.tipoActivoForm.controls).forEach(key => {
        const control = this.tipoActivoForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  deleteTipoActivo(id: number): void {
    this.tipoActivoToDelete = id;
    this.showConfirmDialog = true;
  }

  confirmarEliminacion(): void {
    if (this.tipoActivoToDelete) {
      this.tiposActivoService.eliminarTipoActivo(this.tipoActivoToDelete).subscribe({
        next: () => {
          this.cargarTiposActivo();
          this.showConfirmDialog = false;
          this.tipoActivoToDelete = null;
          this.error = null;
        },
        error: (error) => {
          console.error('Error al eliminar el tipo de activo:', error);
          this.error = error.message || 'Error al eliminar el tipo de activo. Por favor, intente nuevamente.';
          this.showConfirmDialog = false;
          this.tipoActivoToDelete = null;
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.tipoActivoToDelete = null;
  }
}
