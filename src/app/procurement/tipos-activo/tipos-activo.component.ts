import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TiposActivoService, TipoDeActivoDTO } from '../../services/tipos-activo.service';
import { UsuariosService, UsuarioDTO } from '../../services/usuarios.service';

@Component({
  selector: 'app-tipos-activo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './tipos-activo.component.html',
  styleUrls: ['./tipos-activo.component.css']
})
export class TiposActivoComponent implements OnInit {
  @ViewChild('tipoActivoModal') tipoActivoModal: any;

  tiposActivoList: TipoDeActivoDTO[] = [];
  tiposActivoFiltrados: TipoDeActivoDTO[] = [];
  usuariosList: UsuarioDTO[] = [];
  tipoActivoForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 10;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  tipoActivoSeleccionado: TipoDeActivoDTO | null = null;
  showConfirmDialog = false;
  tipoActivoToDelete: number | null = null;

  constructor(
    private tiposActivoService: TiposActivoService,
    private usuariosService: UsuariosService,
    private modalService: NgbModal,
    private fb: FormBuilder
  ) {
    this.tipoActivoForm = this.fb.group({
      descripcion: ['', [Validators.required]],
      idUsuario: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.cargarUsuarios();
    this.cargarTiposActivo();
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
        this.tiposActivoFiltrados = [...this.tiposActivoList];
        this.collectionSize = this.tiposActivoFiltrados.length;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Error al cargar los tipos de activo';
        this.loading = false;
      }
    });
  }

  get pagedTiposActivo(): TipoDeActivoDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.tiposActivoFiltrados.slice(startItem, endItem);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.tiposActivoFiltrados.sort((a, b) => {
      let valueA = a[column as keyof TipoDeActivoDTO];
      let valueB = b[column as keyof TipoDeActivoDTO];

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

  openNewTipoActivoModal(): void {
    this.modoEdicion = false;
    this.tipoActivoSeleccionado = null;
    this.tipoActivoForm.reset();
    this.modalService.open(this.tipoActivoModal);
  }

  editTipoActivo(tipo: TipoDeActivoDTO): void {
    this.modoEdicion = true;
    this.tipoActivoSeleccionado = tipo;
    this.tipoActivoForm.patchValue({
      descripcion: tipo.descripcion,
      idUsuario: tipo.idUsuario
    });
    this.modalService.open(this.tipoActivoModal);
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
          next: (tipoActualizado) => {
            console.log('Tipo de activo actualizado:', tipoActualizado);
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
          next: (tipoCreado) => {
            console.log('Tipo de activo creado:', tipoCreado);
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