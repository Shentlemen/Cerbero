import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';

@Component({
  selector: 'app-almacenes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    NotificationContainerComponent
  ],
  templateUrl: 'almacenes.component.html',
  styleUrls: ['almacenes.component.css']
})
export class AlmacenesComponent implements OnInit {
  almacenes: Almacen[] = [];
  almacenesFiltrados: Almacen[] = [];
  loading: boolean = false;
  error: string | null = null;
  almacenForm: FormGroup;
  modoEdicion: boolean = false;
  almacenSeleccionado: Almacen | null = null;
  almacenAEliminar: Almacen | null = null;

  // Paginación
  page = 1;
  pageSize = 10;
  collectionSize = 0;

  // Ordenamiento
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Filtrado
  searchTerm: string = '';

  constructor(
    private almacenService: AlmacenService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService
  ) {
    this.almacenForm = this.fb.group({
      numero: ['', [Validators.required, Validators.maxLength(50)]],
      nombre: ['', [Validators.required, Validators.maxLength(255)]]
    });
  }

  ngOnInit(): void {
    this.cargarAlmacenes();
  }

  cargarAlmacenes(): void {
    this.loading = true;
    this.error = null;

    this.almacenService.getAllAlmacenes().subscribe({
      next: (almacenes) => {
        this.almacenes = almacenes;
        this.almacenesFiltrados = [...this.almacenes];
        this.actualizarPaginacion();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar almacenes:', error);
        this.error = 'Error al cargar almacenes. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  abrirModalAlmacen(modal: any, almacen?: Almacen): void {
    this.modoEdicion = !!almacen;
    this.almacenSeleccionado = almacen || null;

    if (this.modoEdicion && almacen) {
      this.almacenForm.patchValue({
        numero: almacen.numero,
        nombre: almacen.nombre
      });
    } else {
      this.almacenForm.reset();
    }

    this.modalService.open(modal, { size: 'lg' });
  }

  guardarAlmacen(): void {
    if (this.almacenForm.valid) {
      const formData = this.almacenForm.value;
      
      if (this.modoEdicion && this.almacenSeleccionado) {
        // Actualizar almacén existente
        const almacenActualizado: Almacen = {
          ...this.almacenSeleccionado,
          numero: formData.numero,
          nombre: formData.nombre
        };

        this.almacenService.updateAlmacen(this.almacenSeleccionado.id, almacenActualizado).subscribe({
          next: () => {
            this.modalService.dismissAll();
            this.cargarAlmacenes();
          },
          error: (error) => {
            console.error('Error al actualizar almacén:', error);
          }
        });
      } else {
        // Crear nuevo almacén
        const nuevoAlmacen: Omit<Almacen, 'id'> = {
          numero: formData.numero,
          nombre: formData.nombre
        };

        this.almacenService.createAlmacen(nuevoAlmacen).subscribe({
          next: () => {
            this.modalService.dismissAll();
            this.cargarAlmacenes();
          },
          error: (error) => {
            console.error('Error al crear almacén:', error);
          }
        });
      }
    }
  }

  confirmarEliminacion(modal: any, almacen: Almacen): void {
    this.almacenAEliminar = almacen;
    this.modalService.open(modal);
  }

  eliminarAlmacen(): void {
    if (this.almacenAEliminar) {
      this.almacenService.deleteAlmacen(this.almacenAEliminar.id).subscribe({
        next: () => {
          this.modalService.dismissAll();
          this.cargarAlmacenes();
        },
        error: (error) => {
          console.error('Error al eliminar almacén:', error);
        }
      });
    }
  }

  filtrarAlmacenes(): void {
    if (!this.searchTerm.trim()) {
      this.almacenesFiltrados = [...this.almacenes];
    } else {
      const termino = this.searchTerm.toLowerCase();
      this.almacenesFiltrados = this.almacenes.filter(almacen =>
        almacen.numero.toLowerCase().includes(termino) ||
        almacen.nombre.toLowerCase().includes(termino)
      );
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

    this.almacenesFiltrados.sort((a, b) => {
      let valueA = a[column as keyof Almacen];
      let valueB = b[column as keyof Almacen];

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

  private actualizarPaginacion(): void {
    this.collectionSize = this.almacenesFiltrados.length;
    this.page = 1;
  }

  get pagedAlmacenes(): Almacen[] {
    const start = (this.page - 1) * this.pageSize;
    const end = this.page * this.pageSize;
    return this.almacenesFiltrados.slice(start, end);
  }

  canManageAlmacenes(): boolean {
    return this.permissionsService.canManageAssets();
  }
} 