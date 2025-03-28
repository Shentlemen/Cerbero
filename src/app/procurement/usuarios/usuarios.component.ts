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
        const usuarioActualizado: UsuarioDTO = {
          ...usuarioData,
          idUsuario: this.usuarioSeleccionado.idUsuario
        };
        
        this.usuariosService.actualizarUsuario(this.usuarioSeleccionado.idUsuario, usuarioActualizado).subscribe({
          next: (mensaje) => {
            console.log(mensaje);
            this.cargarUsuarios();
            this.modalService.dismissAll();
          },
          error: (error) => {
            console.error('Error al actualizar el usuario:', error);
            this.error = 'Error al actualizar el usuario. Por favor, intente nuevamente.';
          }
        });
      } else {
        this.usuariosService.crearUsuario(usuarioData).subscribe({
          next: (mensaje) => {
            console.log(mensaje);
            this.cargarUsuarios();
            this.modalService.dismissAll();
          },
          error: (error) => {
            console.error('Error al crear el usuario:', error);
            this.error = 'Error al crear el usuario. Por favor, intente nuevamente.';
          }
        });
      }
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
    if (confirm('¿Está seguro que desea eliminar este usuario?')) {
      this.usuariosService.eliminarUsuario(id).subscribe({
        next: (mensaje) => {
          console.log(mensaje);
          this.cargarUsuarios();
        },
        error: (error) => {
          console.error('Error al eliminar el usuario:', error);
          this.error = 'Error al eliminar el usuario. Por favor, intente nuevamente.';
        }
      });
    }
  }

  buscarPorCedula(cedula: string): void {
    if (cedula.trim()) {
      this.usuariosService.getUsuarioByCedula(cedula).subscribe({
        next: (usuario) => {
          this.usuariosFiltrados = usuario ? [usuario] : [];
          this.collectionSize = this.usuariosFiltrados.length;
          this.page = 1;
        },
        error: (error) => {
          if (error.status === 404) {
            this.usuariosFiltrados = [];
            this.collectionSize = 0;
          } else {
            console.error('Error al buscar usuario por cédula:', error);
          }
        }
      });
    } else {
      this.cargarUsuarios();
    }
  }
} 