import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ActivatedRoute } from '@angular/router';
import { StockAlmacenService, StockAlmacen } from '../../services/stock-almacen.service';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';

@Component({
  selector: 'app-stock-almacen',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    NotificationContainerComponent
  ],
  templateUrl: './stock-almacen.component.html',
  styleUrls: ['./stock-almacen.component.css']
})
export class StockAlmacenComponent implements OnInit {
  stock: StockAlmacen[] = [];
  almacenes: Almacen[] = [];
  almacenSeleccionado: Almacen | null = null;
  almacenId: number | null = null;
  loading: boolean = false;
  error: string | null = null;

  // Modal de cantidad
  itemSeleccionado: StockAlmacen | null = null;
  cantidadForm: FormGroup;
  mostrarConfirmacionEliminacion: boolean = false;

  // Organización del stock por almacén y estantería
  stockOrganizado: { [key: string]: { [key: string]: StockAlmacen[] } } = {};

  constructor(
    private stockAlmacenService: StockAlmacenService,
    private almacenService: AlmacenService,
    private route: ActivatedRoute,
    private modalService: NgbModal,
    private fb: FormBuilder,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService
  ) {
    this.cantidadForm = this.fb.group({
      cantidad: [1, [Validators.required, Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    // Suscribirse a los parámetros de la ruta para obtener el ID del almacén
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      this.almacenId = id ? parseInt(id, 10) : null;
      this.cargarDatos();
    });
  }

  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    Promise.all([
      this.stockAlmacenService.getAllStock().toPromise(),
      this.almacenService.getAllAlmacenes().toPromise()
    ]).then(([stock, almacenes]) => {
      if (stock) {
        this.stock = stock;
        
        // Filtrar por almacén si hay un ID específico
        if (this.almacenId) {
          this.stock = this.stock.filter(item => item.almacen.id === this.almacenId);
        }
        this.organizarStock(this.stock);
      }

      if (almacenes) {
        this.almacenes = almacenes;
        
        // Encontrar el almacén seleccionado
        if (this.almacenId) {
          this.almacenSeleccionado = this.almacenes.find(a => a.id === this.almacenId) || null;
        }
      }

      this.loading = false;
    }).catch(error => {
      console.error('Error al cargar datos:', error);
      this.error = 'Error al cargar los datos';
      this.loading = false;
    });
  }

  organizarStock(stock: StockAlmacen[]): void {
    // Organizar stock por almacén y estantería
    const grupos: { [key: string]: { [key: string]: StockAlmacen[] } } = {};

    stock.forEach(item => {
      const almacenKey = `${item.almacen.numero} - ${item.almacen.nombre}`;
      const estanteriaKey = item.estanteria;

      if (!grupos[almacenKey]) {
        grupos[almacenKey] = {};
      }
      if (!grupos[almacenKey][estanteriaKey]) {
        grupos[almacenKey][estanteriaKey] = [];
      }

      grupos[almacenKey][estanteriaKey].push(item);
    });

    this.stockOrganizado = grupos;
  }

  getAlmacenes(): string[] {
    return Object.keys(this.stockOrganizado);
  }

  getEstanterias(almacen: string): string[] {
    return Object.keys(this.stockOrganizado[almacen] || {});
  }

  getStockPorEstanteria(almacen: string, estanteria: string): StockAlmacen[] {
    return this.stockOrganizado[almacen]?.[estanteria] || [];
  }

  getTotalStockPorAlmacen(almacen: string): number {
    const estanterias = this.getEstanterias(almacen);
    return estanterias.reduce((total, estanteria) => {
      const stock = this.getStockPorEstanteria(almacen, estanteria);
      return total + stock.reduce((sum, item) => sum + (item.cantidad || 1), 0);
    }, 0);
  }

  getTotalStockPorEstanteria(almacen: string, estanteria: string): number {
    const stock = this.getStockPorEstanteria(almacen, estanteria);
    return stock.reduce((total, item) => total + (item.cantidad || 1), 0);
  }

  getTotalAlmacenes(): number {
    return this.getAlmacenes().length;
  }

  // Nuevos métodos para la estructura de estantes
  getEstantesPorEstanteria(almacen: string, estanteria: string): string[] {
    const stockItems = this.getStockPorEstanteria(almacen, estanteria);
    const estantes = new Set<string>();
    stockItems.forEach(item => {
      estantes.add(item.estante);
    });
    return Array.from(estantes).sort();
  }

  getItemsPorEstante(almacen: string, estanteria: string, estante: string): StockAlmacen[] {
    const stockItems = this.getStockPorEstanteria(almacen, estanteria);
    return stockItems.filter(item => item.estante === estante);
  }

  /**
   * Abre el modal para modificar la cantidad de un item
   */
  abrirModalCantidad(item: StockAlmacen, modal: any): void {
    if (!this.canManageStock()) {
      this.notificationService.showError(
        'Permisos Insuficientes',
        'No tienes permisos para modificar el stock.'
      );
      return;
    }

    this.itemSeleccionado = item;
    this.cantidadForm.patchValue({
      cantidad: item.cantidad
    });
    this.mostrarConfirmacionEliminacion = false;
    this.modalService.open(modal, { size: 'md' });
  }

  /**
   * Aumenta la cantidad en 1
   */
  aumentarCantidad(): void {
    const cantidadActual = this.cantidadForm.get('cantidad')?.value || 0;
    this.cantidadForm.patchValue({
      cantidad: cantidadActual + 1
    });
    this.mostrarConfirmacionEliminacion = false;
  }

  /**
   * Reduce la cantidad en 1
   */
  reducirCantidad(): void {
    const cantidadActual = this.cantidadForm.get('cantidad')?.value || 0;
    const nuevaCantidad = Math.max(0, cantidadActual - 1);
    this.cantidadForm.patchValue({
      cantidad: nuevaCantidad
    });
    
    // Mostrar confirmación si la cantidad llega a 0
    this.mostrarConfirmacionEliminacion = nuevaCantidad === 0;
  }

  /**
   * Guarda los cambios de cantidad
   */
  guardarCantidad(): void {
    if (!this.itemSeleccionado || !this.cantidadForm.valid) {
      return;
    }

    const nuevaCantidad = this.cantidadForm.get('cantidad')?.value;

    if (nuevaCantidad === 0) {
      // Eliminar el item si la cantidad es 0
      this.eliminarItem();
    } else {
      // Actualizar la cantidad
      this.actualizarCantidad(nuevaCantidad);
    }
  }

  /**
   * Actualiza la cantidad del item
   */
  private actualizarCantidad(nuevaCantidad: number): void {
    if (!this.itemSeleccionado) return;

    this.stockAlmacenService.updateStockQuantity(this.itemSeleccionado.id, nuevaCantidad).subscribe({
      next: () => {
        this.notificationService.showSuccess(
          'Stock Actualizado',
          `La cantidad se ha actualizado a ${nuevaCantidad} unidades.`
        );
        this.modalService.dismissAll();
        this.cargarDatos();
      },
      error: (error) => {
        console.error('Error al actualizar cantidad:', error);
        this.notificationService.showError(
          'Error',
          'No se pudo actualizar la cantidad. Intente nuevamente.'
        );
      }
    });
  }

  /**
   * Elimina el item del stock
   */
  private eliminarItem(): void {
    if (!this.itemSeleccionado) return;

    this.stockAlmacenService.deleteStock(this.itemSeleccionado.id).subscribe({
      next: () => {
        this.notificationService.showSuccess(
          'Item Eliminado',
          'El item ha sido eliminado del stock.'
        );
        this.modalService.dismissAll();
        this.cargarDatos();
      },
      error: (error) => {
        console.error('Error al eliminar item:', error);
        this.notificationService.showError(
          'Error',
          'No se pudo eliminar el item. Intente nuevamente.'
        );
      }
    });
  }

  /**
   * Cancela los cambios y cierra el modal
   */
  cancelarCambios(): void {
    this.modalService.dismissAll();
    this.itemSeleccionado = null;
    this.mostrarConfirmacionEliminacion = false;
  }

  /**
   * Verifica si el usuario puede gestionar stock
   */
  canManageStock(): boolean {
    return this.permissionsService.canManageAssets();
  }
} 