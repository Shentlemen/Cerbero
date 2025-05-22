import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { UsuariosService, UsuarioDTO } from '../../services/usuarios.service';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class UsuariosComponent implements OnInit {
  usuariosList: UsuarioDTO[] = [];
  usuariosFiltrados: UsuarioDTO[] = [];
  filterForm: FormGroup;
  usuarioForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 10;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  usuarioSeleccionado: UsuarioDTO | null = null;
  showConfirmDialog = false;
  usuarioToDelete: number | null = null;

  constructor(
    private usuariosService: UsuariosService,
    private fb: FormBuilder,
    private modalService: NgbModal
  ) {
    this.filterForm = this.fb.group({
      nombre: [''],
      cedula: [''],
      unidad: [''],
      cargo: ['']
    });

    this.usuarioForm = this.fb.group({
      cedula: ['', [Validators.required, Validators.pattern('^[0-9]{8,10}$')]],
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      cargo: ['', Validators.required],
      unidad: ['', Validators.required]
    });

    // Suscribirse a cambios en el formulario de filtro
    this.filterForm.valueChanges.subscribe(() => {
      this.aplicarFiltros();
    });
  }

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    this.loading = true;
    this.error = null;
    
    this.usuariosService.getUsuarios().subscribe({
      next: (usuarios) => {
        this.usuariosList = usuarios;
        this.usuariosFiltrados = [...this.usuariosList];
        this.collectionSize = this.usuariosFiltrados.length;
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
    const endItem = this.page * this.pageSize;
    return this.usuariosFiltrados.slice(startItem, endItem);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.usuariosFiltrados.sort((a, b) => {
      let valueA = a[column as keyof UsuarioDTO];
      let valueB = b[column as keyof UsuarioDTO];

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
    this.modalService.open(modal, { size: 'lg' });
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
          next: (usuarioActualizado) => {
            console.log('Usuario actualizado:', usuarioActualizado);
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
          next: (usuarioCreado) => {
            console.log('Usuario creado:', usuarioCreado);
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
      // Marcar todos los campos como touched para mostrar los errores
      Object.keys(this.usuarioForm.controls).forEach(key => {
        const control = this.usuarioForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
    
    this.usuariosFiltrados = this.usuariosList.filter(usuario => {
      let cumpleFiltros = true;

      if (filtros.nombre) {
        const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`.toLowerCase();
        cumpleFiltros = cumpleFiltros && 
          nombreCompleto.includes(filtros.nombre.toLowerCase());
      }

      if (filtros.cedula) {
        cumpleFiltros = cumpleFiltros && 
          usuario.cedula.includes(filtros.cedula);
      }

      if (filtros.unidad) {
        cumpleFiltros = cumpleFiltros && 
          usuario.unidad.toLowerCase().includes(filtros.unidad.toLowerCase());
      }

      if (filtros.cargo) {
        cumpleFiltros = cumpleFiltros && 
          usuario.cargo.toLowerCase().includes(filtros.cargo.toLowerCase());
      }

      return cumpleFiltros;
    });

    this.collectionSize = this.usuariosFiltrados.length;
    this.page = 1;
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

  buscarPorCedula(cedula: string): void {
    if (cedula.trim()) {
      this.usuariosService.getUsuarioByCedula(cedula).subscribe({
        next: (usuario) => {
          this.usuariosFiltrados = usuario ? [usuario] : [];
          this.collectionSize = this.usuariosFiltrados.length;
          this.page = 1;
          this.error = null;
        },
        error: (error) => {
          if (error.status === 404) {
            this.usuariosFiltrados = [];
            this.collectionSize = 0;
            this.error = 'No se encontró ningún usuario con esa cédula';
          } else {
            console.error('Error al buscar usuario por cédula:', error);
            this.error = error.message || 'Error al buscar el usuario. Por favor, intente nuevamente.';
          }
        }
      });
    } else {
      this.cargarUsuarios();
    }
  }
} 