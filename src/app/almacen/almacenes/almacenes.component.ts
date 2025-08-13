import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { ActivoAlmacenService } from '../../services/activo-almacen.service';
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



  // Stock por almacén
  almacenStock: { [key: number]: number } = {};

  // Propiedades para el diálogo de confirmación
  showConfirmDialog: boolean = false;

  constructor(
    private almacenService: AlmacenService,
    private activoAlmacenService: ActivoAlmacenService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private router: Router,
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

    // Cargar almacenes y stock en paralelo
    Promise.all([
      this.almacenService.getAllAlmacenes().toPromise(),
      this.activoAlmacenService.getAllUbicaciones().toPromise()
    ]).then(([almacenes, ubicaciones]) => {
      if (almacenes) {
        this.almacenes = almacenes;
        this.almacenesFiltrados = [...this.almacenes];
      }

      if (ubicaciones) {
        // Calcular stock por almacén
        this.calcularStockPorAlmacen(ubicaciones);
      }

      this.loading = false;
    }).catch(error => {
      console.error('Error al cargar almacenes:', error);
      this.error = 'Error al cargar almacenes. Por favor, intente nuevamente.';
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
          this.cargarAlmacenes();
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
    console.log('Navegando a stock del almacén:', almacen);
    console.log('Ruta destino:', `/menu/almacen/stock/${almacen.id}`);
    this.router.navigate(['/menu/almacen/stock', almacen.id]);
  }

  /**
   * Calcula el stock disponible por almacén
   */
  private calcularStockPorAlmacen(ubicaciones: any[]): void {
    this.almacenStock = {};
    
    ubicaciones.forEach(ubicacion => {
      const almacenId = ubicacion.almacen.id;
      if (!this.almacenStock[almacenId]) {
        this.almacenStock[almacenId] = 0;
      }
      this.almacenStock[almacenId]++;
    });
  }

  /**
   * Verifica si un almacén tiene stock disponible
   */
  tieneStock(almacenId: number): boolean {
    return this.almacenStock[almacenId] > 0;
  }

  /**
   * Obtiene el stock disponible de un almacén
   */
  getStockDisponible(almacenId: number): number {
    return this.almacenStock[almacenId] || 0;
  }
} 