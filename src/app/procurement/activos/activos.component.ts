import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivosService, ActivoDTO } from '../../services/activos.service';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { UbicacionesService, Ubicacion } from '../../services/ubicaciones.service';
import { UsuariosService, UsuarioDTO } from '../../services/usuarios.service';

@Component({
  selector: 'app-activos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule
  ],
  templateUrl: './activos.component.html',
  styleUrls: ['./activos.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ActivosComponent implements OnInit {
  activos: ActivoDTO[] = [];
  activosFiltrados: ActivoDTO[] = [];
  loading: boolean = false;
  error: string | null = null;
  activoForm: FormGroup;
  modoEdicion: boolean = false;
  activoSeleccionado: ActivoDTO | null = null;
  ubicaciones: Map<number, Ubicacion> = new Map();
  usuarios: Map<number, UsuarioDTO> = new Map();
  
  // Paginación
  page = 1;
  pageSize = 10;
  collectionSize = 0;
  
  // Ordenamiento
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Filtrado
  currentFilter: string = '';
  altaCount: number = 0;
  mediaCount: number = 0;
  bajaCount: number = 0;
  totalActivos: number = 0;

  constructor(
    private activosService: ActivosService,
    private ubicacionesService: UbicacionesService,
    private usuariosService: UsuariosService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.activoForm = this.fb.group({
      hardwareId: ['', Validators.required],
      criticidad: ['', Validators.required],
      clasificacionDeINFO: ['', Validators.required],
      estado: ['', Validators.required],
      idTipoActivo: ['', Validators.required],
      idNumeroCompra: ['', Validators.required],
      idItem: ['', Validators.required],
      idEntrega: ['', Validators.required],
      idUbicacion: ['', Validators.required],
      idUsuario: ['', Validators.required],
      idSecundario: ['', Validators.required],
      idServicioGarantia: ['', Validators.required],
      fechaFinGarantia: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.cargarUbicaciones();
    this.cargarUsuarios();
    this.cargarActivos();
  }

  cargarUsuarios() {
    this.usuariosService.getUsuarios().subscribe({
      next: (usuarios) => {
        usuarios.forEach(usuario => {
          if (usuario.idUsuario) {
            this.usuarios.set(usuario.idUsuario, usuario);
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar usuarios:', error);
      }
    });
  }

  getUsuarioInfo(idUsuario: number): string {
    const usuario = this.usuarios.get(idUsuario);
    return usuario ? `${usuario.nombre} ${usuario.apellido}` : 'No asignado';
  }

  cargarUbicaciones() {
    this.ubicacionesService.getUbicaciones().subscribe({
      next: (ubicaciones) => {
        ubicaciones.forEach(ubicacion => {
          if (ubicacion.idUbicacion) {
            this.ubicaciones.set(ubicacion.idUbicacion, ubicacion);
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar ubicaciones:', error);
      }
    });
  }

  getUbicacionInfo(idUbicacion: number): string {
    const ubicacion = this.ubicaciones.get(idUbicacion);
    return ubicacion ? `${ubicacion.nombreGerencia} - ${ubicacion.nombreOficina}` : 'No asignada';
  }

  verDetallesUbicacion(idUbicacion: number, ubicacionModal: any) {
    const ubicacion = this.ubicaciones.get(idUbicacion);
    if (ubicacion) {
      this.activoSeleccionado = this.activos.find(a => a.idUbicacion === idUbicacion) || null;
      this.modalService.open(ubicacionModal, { size: 'lg' });
    }
  }

  cargarActivos() {
    this.loading = true;
    this.error = null;
    this.activosService.getActivos().subscribe({
      next: (activos) => {
        console.log('Activos cargados:', activos);
        this.activos = activos;
        this.activosFiltrados = [...this.activos];
        this.collectionSize = this.activosFiltrados.length;
        this.updateSummary();
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Error al cargar los activos';
        this.loading = false;
      }
    });
  }

  get pagedActivos(): ActivoDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.activosFiltrados.slice(startItem, endItem);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.activosFiltrados.sort((a, b) => {
      let valueA = a[column as keyof ActivoDTO];
      let valueB = b[column as keyof ActivoDTO];

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

  filterByCriticidad(criticidad: string): void {
    console.log('Filtrando por criticidad:', criticidad);
    console.log('Activos antes del filtro:', this.activos);
    
    this.currentFilter = criticidad;
    if (criticidad === '') {
      this.activosFiltrados = [...this.activos];
    } else {
      this.activosFiltrados = this.activos.filter(activo => {
        console.log('Comparando:', activo.criticidad, 'con', criticidad);
        return activo.criticidad?.trim().toUpperCase() === criticidad.trim().toUpperCase();
      });
    }
    
    console.log('Activos después del filtro:', this.activosFiltrados);
    this.collectionSize = this.activosFiltrados.length;
    this.page = 1;
    this.updateSummary();
  }

  updateSummary(): void {
    console.log('Actualizando resumen...');
    console.log('Activos totales:', this.activos);
    
    this.totalActivos = this.activos.length;
    
    // Asegurarnos de que la comparación sea exacta y en mayúsculas
    this.altaCount = this.activos.filter(a => {
      console.log('Contando ALTA:', a.criticidad);
      return a.criticidad?.trim().toUpperCase() === 'ALTA';
    }).length;
    
    this.mediaCount = this.activos.filter(a => {
      console.log('Contando MEDIA:', a.criticidad);
      return a.criticidad?.trim().toUpperCase() === 'MEDIA';
    }).length;
    
    this.bajaCount = this.activos.filter(a => {
      console.log('Contando BAJA:', a.criticidad);
      return a.criticidad?.trim().toUpperCase() === 'BAJA';
    }).length;
    
    console.log('Resumen final:', {
      total: this.totalActivos,
      alta: this.altaCount,
      media: this.mediaCount,
      baja: this.bajaCount
    });
  }

  verDetalles(activo: ActivoDTO): void {
    this.router.navigate(['/menu/procurement/activos', activo.idActivo]);
  }

  abrirModal(content: any, activo?: ActivoDTO) {
    if (activo) {
      this.modoEdicion = true;
      this.activoSeleccionado = activo;
      this.activoForm.patchValue(activo);
    } else {
      this.modoEdicion = false;
      this.activoSeleccionado = null;
      this.activoForm.reset();
    }
    this.modalService.open(content, { size: 'lg' });
  }

  guardarActivo() {
    if (this.activoForm.valid) {
      const activo = this.activoForm.value;
      if (this.modoEdicion && this.activoSeleccionado) {
        this.activosService.actualizarActivo(this.activoSeleccionado.idActivo, activo).subscribe({
          next: () => {
            this.modalService.dismissAll();
            this.cargarActivos();
          },
          error: (error) => {
            this.error = 'Error al actualizar el activo';
          }
        });
      } else {
        this.activosService.crearActivo(activo).subscribe({
          next: () => {
            this.modalService.dismissAll();
            this.cargarActivos();
          },
          error: (error) => {
            this.error = 'Error al crear el activo';
          }
        });
      }
    }
  }

  eliminarActivo(id: number) {
    if (confirm('¿Está seguro que desea eliminar este activo?')) {
      this.activosService.eliminarActivo(id).subscribe({
        next: () => {
          this.cargarActivos();
        },
        error: (error) => {
          this.error = 'Error al eliminar el activo';
        }
      });
    }
  }
} 