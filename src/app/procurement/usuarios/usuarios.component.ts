import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { UsuariosService, UsuarioDTO } from '../../services/usuarios.service';
import { TourRegistryService } from '../../services/tour-registry.service';

type UsuarioSortColumn = 'cedula' | 'nombre' | 'apellido' | 'cargo' | 'unidad';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit, OnDestroy {
  usuariosList: UsuarioDTO[] = [];
  usuariosFiltrados: UsuarioDTO[] = [];
  usuarioForm: FormGroup;
  searchTerm = '';
  sortColumn: UsuarioSortColumn = 'apellido';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 25;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  usuarioSeleccionado: UsuarioDTO | null = null;
  showConfirmDialog = false;
  usuarioToDelete: number | null = null;
  private tourCleanup?: () => void;

  constructor(
    private usuariosService: UsuariosService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private tourRegistry: TourRegistryService
  ) {
    this.usuarioForm = this.fb.group({
      cedula: ['', [Validators.required, Validators.pattern('^[0-9]{8,10}$')]],
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      cargo: ['', Validators.required],
      unidad: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.cargarUsuarios();
    this.tourCleanup = this.tourRegistry.register('usuarios', [{
      id: 'personas-org-overview',
      title: 'Tour de personas',
      icon: 'fa-route',
      steps: [
        { selector: '#tour-proc-personas-title', title: 'Personas de organización', description: 'Directorio de personas reales (cédula, unidad, cargo) usado para responsables en activos y compras — distinto de usuarios de login Cerbero.', side: 'bottom' },
        { selector: '#tour-proc-personas-nuevo', title: 'Alta', description: 'Registrá una persona para vincularla después en tipos de activo o formularios.', side: 'left' },
        { selector: '#tour-proc-personas-search', title: 'Búsqueda', description: 'Filtrá en tiempo real por cédula, nombre, apellido, cargo o unidad.', side: 'bottom' },
        { selector: '#tour-proc-personas-table', title: 'Listado', description: 'Ordená por columna, navegá con paginación, editá o eliminá registros.', side: 'top' }
      ]
    }]);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
  }

  cargarUsuarios(): void {
    this.loading = true;
    this.error = null;

    this.usuariosService.getUsuarios().subscribe({
      next: (usuarios) => {
        this.usuariosList = usuarios;
        this.aplicarFiltrosYOrden();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar los usuarios:', error);
        this.error = 'Error al cargar los usuarios. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  get pagedUsuarios(): UsuarioDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    return this.usuariosFiltrados.slice(startItem, startItem + this.pageSize);
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

  sortData(column: UsuarioSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.page = 1;
    this.ordenarLista(this.usuariosFiltrados);
  }

  getSortIcon(column: UsuarioSortColumn): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  isSortActive(column: UsuarioSortColumn): boolean {
    return this.sortColumn === column;
  }

  private aplicarFiltrosYOrden(): void {
    const term = this.searchTerm.trim().toLowerCase();
    this.usuariosFiltrados = term
      ? this.usuariosList.filter((u) => this.matchesSearch(u, term))
      : [...this.usuariosList];
    this.ordenarLista(this.usuariosFiltrados);
    this.collectionSize = this.usuariosFiltrados.length;
    const maxPage = Math.max(1, Math.ceil(this.collectionSize / this.pageSize) || 1);
    if (this.page > maxPage) {
      this.page = maxPage;
    }
  }

  private matchesSearch(u: UsuarioDTO, term: string): boolean {
    const haystack = [
      u.cedula,
      u.nombre,
      u.apellido,
      `${u.nombre} ${u.apellido}`,
      u.cargo,
      u.unidad
    ]
      .map((v) => (v ?? '').toString().trim().toLowerCase())
      .join(' ');
    return haystack.includes(term);
  }

  private ordenarLista(lista: UsuarioDTO[]): void {
    const col = this.sortColumn;
    const mult = this.sortDirection === 'asc' ? 1 : -1;
    lista.sort((a, b) => {
      const valA = this.getSortValue(a, col);
      const valB = this.getSortValue(b, col);
      return valA.localeCompare(valB, 'es', { sensitivity: 'base' }) * mult;
    });
  }

  private getSortValue(u: UsuarioDTO, col: UsuarioSortColumn): string {
    const value = u[col];
    return (value ?? '').toString().trim().toLowerCase();
  }

  abrirModal(modal: any, usuario?: UsuarioDTO): void {
    if (usuario) {
      this.modoEdicion = true;
      this.usuarioSeleccionado = usuario;
      this.usuarioForm.patchValue(usuario);
    } else {
      this.modoEdicion = false;
      this.usuarioSeleccionado = null;
      this.usuarioForm.reset();
    }
    this.modalService.open(modal, {
      size: 'lg',
      backdrop: true
    });
  }

  guardarUsuario(): void {
    if (this.usuarioForm.valid) {
      const usuarioData = this.usuarioForm.value;

      if (this.modoEdicion && this.usuarioSeleccionado) {
        if (!this.usuarioSeleccionado.idUsuario || isNaN(this.usuarioSeleccionado.idUsuario)) {
          this.error = 'ID de usuario no válido';
          return;
        }

        const usuarioActualizado: UsuarioDTO = {
          ...usuarioData,
          idUsuario: this.usuarioSeleccionado.idUsuario
        };

        this.usuariosService.actualizarUsuario(this.usuarioSeleccionado.idUsuario, usuarioActualizado).subscribe({
          next: () => {
            this.cargarUsuarios();
            this.modalService.dismissAll();
            this.error = null;
          },
          error: (error) => {
            console.error('Error al actualizar el usuario:', error);
            this.error = error.message || 'Error al actualizar el usuario. Por favor, intente nuevamente.';
          }
        });
      } else {
        this.usuariosService.crearUsuario(usuarioData).subscribe({
          next: () => {
            this.cargarUsuarios();
            this.modalService.dismissAll();
            this.error = null;
          },
          error: (error) => {
            console.error('Error al crear el usuario:', error);
            this.error = error.message || 'Error al crear el usuario. Por favor, intente nuevamente.';
          }
        });
      }
    } else {
      Object.keys(this.usuarioForm.controls).forEach(key => {
        const control = this.usuarioForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  eliminarUsuario(id: number): void {
    this.usuarioToDelete = id;
    this.showConfirmDialog = true;
  }

  confirmarEliminacion(): void {
    if (this.usuarioToDelete) {
      this.usuariosService.eliminarUsuario(this.usuarioToDelete).subscribe({
        next: () => {
          this.cargarUsuarios();
          this.showConfirmDialog = false;
          this.usuarioToDelete = null;
          this.error = null;
        },
        error: (error) => {
          console.error('Error al eliminar el usuario:', error);
          this.error = error.message || 'Error al eliminar el usuario. Por favor, intente nuevamente.';
          this.showConfirmDialog = false;
          this.usuarioToDelete = null;
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.usuarioToDelete = null;
  }
}
