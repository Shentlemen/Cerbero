import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { StockAlmacenService } from '../../services/stock-almacen.service';
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
  templateUrl: './almacenes.component.html',
  styleUrls: ['./almacenes.component.css']
})
export class AlmacenesComponent implements OnInit {
  almacenes: Almacen[] = [];
  almacenesFiltrados: Almacen[] = [];
  stock: any[] = []; // Stock del sistema
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
  searchResultsCount: number = 0;

  // Propiedades para el diálogo de confirmación
  showConfirmDialog: boolean = false;

  constructor(
    private stockAlmacenService: StockAlmacenService,
    private almacenService: AlmacenService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private router: Router,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService
  ) {
    this.almacenForm = this.fb.group({
      numero: ['', [Validators.required, Validators.maxLength(50)]],
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      descripcion: ['', Validators.maxLength(500)]
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    // Cargar almacenes y stock en paralelo
    Promise.all([
      this.almacenService.getAllAlmacenes().toPromise(),
      this.stockAlmacenService.getAllStock().toPromise()
    ]).then(([almacenes, stock]) => {
      if (almacenes) {
        this.almacenes = almacenes;
        this.almacenesFiltrados = [...this.almacenes];
        this.actualizarPaginacion();
      }
      if (stock) {
        this.stock = stock; // Asignar el stock cargado
        // Aquí podrías procesar el stock si es necesario
      }
    }).catch(error => {
      console.error('Error al cargar datos:', error);
      this.error = 'Error al cargar los datos';
    }).finally(() => {
      this.loading = false;
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
            this.cargarDatos();
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
            this.cargarDatos();
          },
          error: (error) => {
            console.error('Error al crear almacén:', error);
          }
        });
      }
    }
  }

  confirmarEliminacion(almacen: Almacen): void {
    this.almacenAEliminar = almacen;
    this.showConfirmDialog = true;
  }

  eliminarAlmacen(): void {
    if (this.almacenAEliminar) {
      this.almacenService.deleteAlmacen(this.almacenAEliminar.id).subscribe({
        next: () => {
          this.showConfirmDialog = false;
          this.almacenAEliminar = null;
          this.cargarDatos();
        },
        error: (error) => {
          console.error('Error al eliminar almacén:', error);
          this.showConfirmDialog = false;
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.almacenAEliminar = null;
  }



  canManageAlmacenes(): boolean {
    return this.permissionsService.canManageAssets();
  }

  verStockAlmacen(almacen: Almacen): void {
    // Navegar al componente stock-almacen con el ID del almacén
    this.router.navigate(['/menu/almacen/stock', almacen.id]);
  }

  /**
   * Calcula el stock disponible por almacén
   */
  private calcularStockPorAlmacen(stock: any[]): void {
    // Esta función se puede implementar si es necesario para cálculos adicionales
  }

  /**
   * Verifica si un almacén tiene stock disponible
   */
  tieneStock(almacenId: number): boolean {
    // Buscar en el stock si hay items para este almacén
    return this.stock && this.stock.some((item: any) => item.almacen.id === almacenId);
  }

  /**
   * Obtiene el stock disponible de un almacén
   */
  getStockDisponible(almacenId: number): number {
    if (!this.stock) return 0;
    return this.stock
      .filter((item: any) => item.almacen.id === almacenId)
      .reduce((total: number, item: any) => total + (item.cantidad || 1), 0);
  }

  actualizarPaginacion(): void {
    this.collectionSize = this.almacenesFiltrados.length;
    this.page = 1;
  }
} 