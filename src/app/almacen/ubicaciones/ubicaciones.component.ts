import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ActivoAlmacenService, ActivoAlmacen, ActivoAlmacenCreate } from '../../services/activo-almacen.service';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { ActivosService, ActivoDTO } from '../../services/activos.service';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';

@Component({
  selector: 'app-ubicaciones',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    NotificationContainerComponent
  ],
  templateUrl: './ubicaciones.component.html',
  styleUrls: ['./ubicaciones.component.css']
})
export class UbicacionesComponent implements OnInit {
  ubicaciones: ActivoAlmacen[] = [];
  ubicacionesFiltradas: ActivoAlmacen[] = [];
  almacenes: Almacen[] = [];
  activos: ActivoDTO[] = [];
  loading: boolean = false;
  error: string | null = null;
  ubicacionForm: FormGroup;
  modoEdicion: boolean = false;
  ubicacionSeleccionada: ActivoAlmacen | null = null;
  ubicacionAEliminar: ActivoAlmacen | null = null;

  // Paginación
  page = 1;
  pageSize = 10;
  collectionSize = 0;

  // Ordenamiento
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Filtrado
  searchTerm: string = '';
  searchResultsCount: number = 0;

  constructor(
    private activoAlmacenService: ActivoAlmacenService,
    private almacenService: AlmacenService,
    private activosService: ActivosService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService
  ) {
    this.ubicacionForm = this.fb.group({
      activoId: ['', Validators.required],
      almacenId: ['', Validators.required],
      estanteria: ['', [Validators.required, Validators.maxLength(50)]],
      estante: ['', [Validators.required, Validators.maxLength(50)]]
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    // Cargar ubicaciones, almacenes y activos en paralelo
    Promise.all([
      this.activoAlmacenService.getAllUbicaciones().toPromise(),
      this.almacenService.getAllAlmacenes().toPromise(),
      this.activosService.getActivos().toPromise()
    ]).then(([ubicaciones, almacenes, activos]) => {
      if (ubicaciones) {
        this.ubicaciones = ubicaciones;
        this.ubicacionesFiltradas = [...this.ubicaciones];
        this.actualizarPaginacion();
      }

      if (almacenes) {
        this.almacenes = almacenes;
      }

      if (activos) {
        this.activos = activos;
      }

      this.loading = false;
    }).catch(error => {
      console.error('Error al cargar datos:', error);
      this.error = 'Error al cargar datos. Por favor, intente nuevamente.';
      this.loading = false;
    });
  }

  abrirModalUbicacion(modal: any, ubicacion?: ActivoAlmacen): void {
    this.modoEdicion = !!ubicacion;
    this.ubicacionSeleccionada = ubicacion || null;

    if (this.modoEdicion && ubicacion) {
      this.ubicacionForm.patchValue({
        activoId: ubicacion.activoId,
        almacenId: ubicacion.almacen.id,
        estanteria: ubicacion.estanteria,
        estante: ubicacion.estante
      });
    } else {
      this.ubicacionForm.reset();
    }

    this.modalService.open(modal, { size: 'lg' });
  }

  guardarUbicacion(): void {
    if (this.ubicacionForm.valid) {
      // Verificar permisos antes de proceder
      if (!this.canManageUbicaciones()) {
        this.notificationService.showError(
          'Permisos Insuficientes',
          'No tienes permisos para gestionar ubicaciones. Solo los administradores y Game Masters pueden realizar esta acción.'
        );
        return;
      }

      const formData = this.ubicacionForm.value;
      const nuevaUbicacion: ActivoAlmacenCreate = {
        activoId: formData.activoId,
        almacenId: formData.almacenId,
        estanteria: formData.estanteria,
        estante: formData.estante
      };

      console.log('Intentando guardar ubicación:', nuevaUbicacion);
      console.log('Usuario actual:', this.permissionsService.getCurrentUser());
      console.log('Puede gestionar ubicaciones:', this.canManageUbicaciones());
      console.log('Token actual:', localStorage.getItem('token'));

      if (this.modoEdicion && this.ubicacionSeleccionada) {
        // Actualizar ubicación existente
        this.activoAlmacenService.updateUbicacion(this.ubicacionSeleccionada.id, nuevaUbicacion).subscribe({
          next: () => {
            this.modalService.dismissAll();
            this.cargarDatos();
          },
          error: (error) => {
            console.error('Error al actualizar ubicación:', error);
          }
        });
      } else {
        // Crear nueva ubicación
        this.activoAlmacenService.createUbicacion(nuevaUbicacion).subscribe({
          next: () => {
            this.modalService.dismissAll();
            this.cargarDatos();
          },
          error: (error) => {
            console.error('Error al crear ubicación:', error);
          }
        });
      }
    }
  }

  confirmarEliminacion(modal: any, ubicacion: ActivoAlmacen): void {
    this.ubicacionAEliminar = ubicacion;
    this.modalService.open(modal);
  }

  eliminarUbicacion(): void {
    if (this.ubicacionAEliminar) {
      this.activoAlmacenService.deleteUbicacion(this.ubicacionAEliminar.id).subscribe({
        next: () => {
          this.modalService.dismissAll();
          this.cargarDatos();
        },
        error: (error) => {
          console.error('Error al eliminar ubicación:', error);
        }
      });
    }
  }

  filtrarUbicaciones(): void {
    if (!this.searchTerm.trim()) {
      this.ubicacionesFiltradas = [...this.ubicaciones];
    } else {
      const termino = this.searchTerm.toLowerCase();
      this.ubicacionesFiltradas = this.ubicaciones.filter(ubicacion => {
        // Buscar por activo (prioridad alta)
        const activo = this.activos.find(a => a.idActivo === ubicacion.activoId);
        const activoName = activo?.name || '';
        
        // Si el término coincide con el nombre del activo, dar prioridad
        if (activoName.toLowerCase().includes(termino)) {
          return true;
        }
        
        // Buscar por almacén
        const almacenNumero = ubicacion.almacen.numero || '';
        const almacenNombre = ubicacion.almacen.nombre || '';
        
        return almacenNumero.toLowerCase().includes(termino) ||
               almacenNombre.toLowerCase().includes(termino);
      });
    }
    this.actualizarPaginacion();
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.ubicacionesFiltradas.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (column) {
        case 'activo':
          const activoA = this.activos.find(act => act.idActivo === a.activoId);
          const activoB = this.activos.find(act => act.idActivo === b.activoId);
          valueA = activoA?.name || '';
          valueB = activoB?.name || '';
          break;
        case 'almacen':
          valueA = a.almacen.numero;
          valueB = b.almacen.numero;
          break;
        case 'estanteria':
          valueA = a.estanteria;
          valueB = b.estanteria;
          break;
        case 'estante':
          valueA = a.estante;
          valueB = b.estante;
          break;
        default:
          return 0;
      }

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

  getActivoName(activoId: number): string {
    const activo = this.activos.find(a => a.idActivo === activoId);
    return activo?.name || 'Activo no encontrado';
  }

  /**
   * Resalta el término de búsqueda en el texto del activo
   */
  highlightActivoName(activoId: number): string {
    const activoName = this.getActivoName(activoId);
    
    if (!this.searchTerm.trim()) {
      return activoName;
    }
    
    const termino = this.searchTerm.toLowerCase();
    const index = activoName.toLowerCase().indexOf(termino);
    
    if (index >= 0) {
      const before = activoName.substring(0, index);
      const match = activoName.substring(index, index + this.searchTerm.length);
      const after = activoName.substring(index + this.searchTerm.length);
      
      return `${before}<mark class="bg-warning">${match}</mark>${after}`;
    }
    
    return activoName;
  }

  /**
   * Verifica si el activo coincide con el término de búsqueda
   */
  isActivoMatch(activoId: number): boolean {
    if (!this.searchTerm.trim()) {
      return false;
    }
    
    const activoName = this.getActivoName(activoId);
    return activoName.toLowerCase().includes(this.searchTerm.toLowerCase());
  }

  /**
   * Verifica si el almacén coincide con el término de búsqueda
   */
  isAlmacenMatch(almacen: any): boolean {
    if (!this.searchTerm.trim()) {
      return false;
    }
    
    const almacenNumero = almacen.numero || '';
    const almacenNombre = almacen.nombre || '';
    const termino = this.searchTerm.toLowerCase();
    
    return almacenNumero.toLowerCase().includes(termino) ||
           almacenNombre.toLowerCase().includes(termino);
  }

  /**
   * Limpia la búsqueda
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.filtrarUbicaciones();
  }

  /**
   * Obtiene el número de activos que coinciden con la búsqueda
   */
  getActivoMatchesCount(): number {
    if (!this.searchTerm.trim()) {
      return 0;
    }
    
    return this.ubicacionesFiltradas.filter(ubicacion => 
      this.isActivoMatch(ubicacion.activoId)
    ).length;
  }

  /**
   * Obtiene el número de almacenes que coinciden con la búsqueda
   */
  getAlmacenMatchesCount(): number {
    if (!this.searchTerm.trim()) {
      return 0;
    }
    
    return this.ubicacionesFiltradas.filter(ubicacion => 
      this.isAlmacenMatch(ubicacion.almacen)
    ).length;
  }

  private actualizarPaginacion(): void {
    this.collectionSize = this.ubicacionesFiltradas.length;
    this.searchResultsCount = this.ubicacionesFiltradas.length;
    this.page = 1;
  }

  get pagedUbicaciones(): ActivoAlmacen[] {
    const start = (this.page - 1) * this.pageSize;
    const end = this.page * this.pageSize;
    return this.ubicacionesFiltradas.slice(start, end);
  }

  canManageUbicaciones(): boolean {
    return this.permissionsService.canManageAssets();
  }
} 