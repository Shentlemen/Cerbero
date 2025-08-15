import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { StockAlmacenService, StockAlmacen, StockAlmacenCreate } from '../../services/stock-almacen.service';
import { StockAlmacenCreateWithItem } from '../../interfaces/stock-almacen.interface';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { LotesService, LoteDTO } from '../../services/lotes.service';
import { ComprasService, CompraDTO } from '../../services/compras.service';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';
import { firstValueFrom } from 'rxjs';

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
  templateUrl: './stock.component.html',
  styleUrls: ['./stock.component.css']
})
export class UbicacionesComponent implements OnInit {
  stock: StockAlmacen[] = [];
  stockFiltrado: StockAlmacen[] = [];
  almacenes: Almacen[] = [];
  compras: any[] = []; // Compras disponibles
  comprasFiltradas: any[] = [];
  mostrarDropdownCompras: boolean = false;
  compraSearchTerm: string = '';
  itemsDeCompra: LoteDTO[] = []; // Ítems de la compra seleccionada
  itemsFiltrados: LoteDTO[] = [];
  mostrarDropdownItems: boolean = false;
  itemSearchTerm: string = '';
  loading: boolean = false;
  error: string | null = null;
  stockForm: FormGroup;
  modoEdicion: boolean = false;
  stockSeleccionado: StockAlmacen | null = null;
  stockAEliminar: StockAlmacen | null = null;

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
    private lotesService: LotesService,
    private comprasService: ComprasService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService
  ) {
    this.stockForm = this.fb.group({
      compraId: ['', Validators.required],
      itemId: ['', Validators.required],
      almacenId: ['', Validators.required],
      estanteria: ['', [Validators.required, Validators.maxLength(50)]],
      estante: ['', [Validators.required, Validators.maxLength(50)]],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      numero: ['', Validators.maxLength(50)],
      descripcion: ['', Validators.maxLength(255)]
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
    
    // Escuchar cambios en compraId para resetear itemId
    this.stockForm.get('compraId')?.valueChanges.subscribe(compraId => {
      if (compraId) {
        // Resetear itemId cuando cambia la compra
        this.stockForm.patchValue({ itemId: '' });
        this.itemSearchTerm = '';
        this.itemsFiltrados = [];
      }
    });
  }

  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    // Cargar stock, almacenes y compras en paralelo
    Promise.all([
      this.stockAlmacenService.getAllStock().toPromise(),
      this.almacenService.getAllAlmacenes().toPromise(),
      this.getComprasDisponibles()
    ]).then(([stock, almacenes, compras]) => {
      if (stock) {
        this.stock = stock;
        this.stockFiltrado = [...this.stock];
        this.actualizarPaginacion();
      }

      if (almacenes) {
        this.almacenes = almacenes;
      }

      if (compras) {
        this.compras = compras;
        this.comprasFiltradas = [...compras];
      }

      this.loading = false;
    }).catch(error => {
      console.error('Error al cargar datos:', error);
      this.error = 'Error al cargar datos. Por favor, intente nuevamente.';
      this.loading = false;
    });
  }

  async abrirModalUbicacion(modal: any, stock?: StockAlmacen): Promise<void> {
    this.modoEdicion = !!stock;
    this.stockSeleccionado = stock || null;

    console.log('=== DEBUG: Abriendo modal ===');
    console.log('modoEdicion:', this.modoEdicion);

    if (this.modoEdicion && stock) {
      // Modo edición: cargar datos existentes
      // Primero necesitamos encontrar la compra del ítem
      const itemInfo = await this.lotesService.getLote(stock.item.idItem).toPromise();
      if (itemInfo) {
        this.stockForm.patchValue({
          compraId: itemInfo.idCompra,
          itemId: stock.item.idItem,
          almacenId: stock.almacen.id,
          estanteria: stock.estanteria,
          estante: stock.estante,
          cantidad: stock.cantidad,
          numero: stock.numero,
          descripcion: stock.descripcion
        });
        
        // Cargar los ítems de esta compra para el dropdown
        await this.cargarItemsDeCompra(itemInfo.idCompra);
        
        // Establecer el numeroCompra en el campo de búsqueda
        const compraInfo = this.compras.find(c => c.idCompra === itemInfo.idCompra);
        if (compraInfo) {
          this.compraSearchTerm = compraInfo.numeroCompra || '';
        }
      }
    } else {
      // Modo creación: resetear formulario
      this.stockForm.reset();
      this.itemsDeCompra = [];
      this.itemsFiltrados = [];
    }

    console.log('modoEdicion final:', this.modoEdicion);

    // Actualizar validaciones después de configurar el formulario
    this.updateFormValidation();
    this.modalService.open(modal, { size: 'lg' });
  }

  guardarUbicacion(): void {
    if (this.isFormValid()) {
      // Verificar permisos antes de proceder
      if (!this.canManageUbicaciones()) {
        this.notificationService.showError(
          'Permisos Insuficientes',
          'No tienes permisos para gestionar ubicaciones. Solo los administradores y Game Masters pueden realizar esta acción.'
        );
        return;
      }

      // Por ahora, solo soportamos modo individual
      this.guardarUbicacionIndividual();
    }
  }

  private guardarUbicacionIndividual(): void {
    const formData = this.stockForm.value;
    const nuevoStock: StockAlmacenCreateWithItem = {
      compraId: formData.compraId,
      itemId: formData.itemId,
      almacenId: formData.almacenId,
      estanteria: formData.estanteria,
      estante: formData.estante,
      cantidad: formData.cantidad,
      numero: formData.numero,
      descripcion: formData.descripcion
    };

    if (this.modoEdicion && this.stockSeleccionado) {
      // Actualizar ubicación existente
      // Para edición, necesitamos convertir a StockAlmacenCreate
      const stockParaActualizar: StockAlmacenCreate = {
        idCompra: formData.compraId, // Usar idCompra en lugar de compraId
        itemId: this.stockSeleccionado.item.idItem, // Mantener el ID original
        almacenId: formData.almacenId,
        estanteria: formData.estanteria,
        estante: formData.estante,
        cantidad: formData.cantidad,
        numero: formData.numero,
        descripcion: formData.descripcion
      };
      
      this.stockAlmacenService.updateStock(this.stockSeleccionado.id, stockParaActualizar).subscribe({
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
      this.stockAlmacenService.createStockWithItem(nuevoStock).subscribe({
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











  confirmarEliminacion(stock: StockAlmacen): void {
    this.stockAEliminar = stock;
    this.showConfirmDialog = true;
  }

  eliminarUbicacion(): void {
    if (this.stockAEliminar) {
      this.stockAlmacenService.deleteStock(this.stockAEliminar.id).subscribe({
        next: () => {
          this.showConfirmDialog = false;
          this.stockAEliminar = null;
          this.cargarDatos();
        },
        error: (error) => {
          console.error('Error al eliminar ubicación:', error);
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.stockAEliminar = null;
  }

  filtrarUbicaciones(): void {
    if (!this.searchTerm.trim()) {
      this.stockFiltrado = [...this.stock];
    } else {
      const termino = this.searchTerm.toLowerCase();
      this.stockFiltrado = this.stock.filter(stock => {
        // Buscar por nombre del ítem (prioridad alta)
        const itemName = stock?.item?.nombreItem || '';
        if (itemName.toLowerCase().includes(termino)) {
          return true;
        }
        
        // Buscar por número del stock
        const numero = stock?.numero || '';
        if (numero.toLowerCase().includes(termino)) {
          return true;
        }
        
        // Buscar por almacén
        const almacenNumero = stock?.almacen?.numero || '';
        const almacenNombre = stock?.almacen?.nombre || '';
        
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

    this.stockFiltrado.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (column) {
        case 'item':
          valueA = a?.item?.nombreItem || '';
          valueB = b?.item?.nombreItem || '';
          break;
        case 'almacen':
          valueA = a?.almacen?.numero || '';
          valueB = b?.almacen?.numero || '';
          break;
        case 'estanteria':
          valueA = a?.estanteria || '';
          valueB = b?.estanteria || '';
          break;
        case 'estante':
          valueA = a?.estante || '';
          valueB = b?.estante || '';
          break;
        case 'cantidad':
          valueA = a?.cantidad || 0;
          valueB = b?.cantidad || 0;
          break;
        case 'numero':
          valueA = a?.numero || '';
          valueB = b?.numero || '';
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





  /**
   * Verifica si el almacén coincide con el término de búsqueda
   */
  isAlmacenMatch(almacen: any): boolean {
    if (!this.searchTerm.trim() || !almacen) {
      return false;
    }
    
    const almacenNumero = almacen?.numero || '';
    const almacenNombre = almacen?.nombre || '';
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
   * Obtiene el número de almacenes que coinciden con la búsqueda
   */
  getAlmacenMatchesCount(): number {
    if (!this.searchTerm.trim()) {
      return 0;
    }
    
    return this.stockFiltrado.filter(stock => 
      this.isAlmacenMatch(stock?.almacen)
    ).length;
  }

  private actualizarPaginacion(): void {
    this.collectionSize = this.stockFiltrado.length;
    this.searchResultsCount = this.stockFiltrado.length;
    this.page = 1;
  }

  get pagedStock(): StockAlmacen[] {
    const start = (this.page - 1) * this.pageSize;
    const end = this.page * this.pageSize;
    return this.stockFiltrado.slice(start, end);
  }

  canManageUbicaciones(): boolean {
    return this.permissionsService.canManageAssets();
  }

  /**
   * Actualiza las validaciones del formulario
   */
  updateFormValidation(): void {
    const compraIdControl = this.stockForm.get('compraId');
    const itemIdControl = this.stockForm.get('itemId');
    
    // Ambos campos son requeridos
    compraIdControl?.setValidators([Validators.required]);
    itemIdControl?.setValidators([Validators.required]);
    
    compraIdControl?.updateValueAndValidity();
    itemIdControl?.updateValueAndValidity();
  }



  /**
   * Verifica si el formulario es válido
   */
  isFormValid(): boolean {
    try {
      // Validar todo el formulario
      return this.stockForm.valid;
    } catch (error) {
      console.error('Error en validación del formulario:', error);
      return false;
    }
  }

  // Métodos para manejar compras y ítems
  async getComprasDisponibles(): Promise<any[]> {
    try {
      // Obtener todas las compras del sistema
      const compras = await this.comprasService.getCompras().toPromise();
      if (compras) {
        // Obtener los lotes para verificar qué compras tienen ítems disponibles
        const lotes = await this.lotesService.getLotes().toPromise();
        if (lotes) {
          // Crear un mapa de compras que tienen lotes
          const comprasConLotes = new Map();
          
          lotes.forEach(lote => {
            const compra = compras.find(c => c.idCompra === lote.idCompra);
            if (compra && !comprasConLotes.has(compra.idCompra)) {
              comprasConLotes.set(compra.idCompra, {
                idCompra: compra.idCompra,
                numeroCompra: compra.numeroCompra, // Usar el numeroCompra real
                items: []
              });
            }
            if (compra && comprasConLotes.has(compra.idCompra)) {
              comprasConLotes.get(compra.idCompra)!.items.push(lote);
            }
          });
          
          return Array.from(comprasConLotes.values());
        }
      }
      return [];
    } catch (error) {
      console.error('Error al cargar compras:', error);
      return [];
    }
  }

  // Métodos para búsqueda de compras
  filtrarCompras(): void {
    if (!this.compraSearchTerm.trim()) {
      this.comprasFiltradas = [...this.compras];
      return;
    }
    
    const searchTerm = this.compraSearchTerm.toLowerCase().trim();
    this.comprasFiltradas = this.compras.filter(compra => 
      compra.numeroCompra?.toLowerCase().includes(searchTerm) // Filtrar por numeroCompra
    );
  }

  seleccionarCompra(compra: any): void {
    this.stockForm.patchValue({ 
      compraId: compra.idCompra,
      itemId: '' // Resetear el ítem seleccionado
    });
    this.compraSearchTerm = compra.numeroCompra?.toString() || '';
    this.mostrarDropdownCompras = false;
    this.comprasFiltradas = [];
    
    // Cargar los ítems de esta compra
    this.cargarItemsDeCompra(compra.idCompra);
  }

  onCompraBlur(): void {
    // Pequeño delay para permitir que el click en la opción se ejecute
    setTimeout(() => {
      this.mostrarDropdownCompras = false;
    }, 200);
  }

  // Métodos para manejar ítems de la compra seleccionada
  async cargarItemsDeCompra(compraId: number): Promise<void> {
    try {
      const lotes = await this.lotesService.getLotes().toPromise();
      if (lotes) {
        this.itemsDeCompra = lotes.filter(lote => lote.idCompra === compraId);
        this.itemsFiltrados = [...this.itemsDeCompra];
      }
    } catch (error) {
      console.error('Error al cargar ítems de la compra:', error);
      this.itemsDeCompra = [];
      this.itemsFiltrados = [];
    }
  }

  filtrarItems(): void {
    if (!this.itemSearchTerm.trim()) {
      this.itemsFiltrados = [...this.itemsDeCompra];
      return;
    }
    
    const searchTerm = this.itemSearchTerm.toLowerCase().trim();
    this.itemsFiltrados = this.itemsDeCompra.filter(item => 
      item.nombreItem?.toLowerCase().includes(searchTerm)
    );
  }

  seleccionarItem(item: LoteDTO): void {
    this.stockForm.patchValue({ itemId: item.idItem });
    this.itemSearchTerm = item.nombreItem || '';
    this.mostrarDropdownItems = false;
    this.itemsFiltrados = [];
  }

  onItemBlur(): void {
    // Pequeño delay para permitir que el click en la opción se ejecute
    setTimeout(() => {
      this.mostrarDropdownItems = false;
    }, 200);
  }

  getCompraInfo(itemId: number): any | undefined {
    // Primero necesitamos encontrar el lote para obtener el idCompra
    const lote = this.itemsDeCompra.find(item => item.idItem === itemId);
    if (lote) {
      // Luego buscar la compra correspondiente
      return this.compras.find(compra => compra.idCompra === lote.idCompra);
    }
    return undefined;
  }

  getItemInfo(itemId: number): LoteDTO | undefined {
    return this.itemsDeCompra.find(item => item.idItem === itemId);
  }



  /**
   * Resalta el término de búsqueda en el nombre del ítem
   */
  highlightItemName(stock: StockAlmacen): string {
    const itemName = stock?.item?.nombreItem || 'Nombre no disponible';
    
    if (!this.searchTerm.trim()) {
      return itemName;
    }
    
    const termino = this.searchTerm.toLowerCase();
    const index = itemName.toLowerCase().indexOf(termino);
    
    if (index >= 0) {
      const before = itemName.substring(0, index);
      const match = itemName.substring(index, index + this.searchTerm.length);
      const after = itemName.substring(index + this.searchTerm.length);
      
      return `${before}<mark class="bg-warning">${match}</mark>${after}`;
    }
    
    return itemName;
  }
  
  /**
   * Verifica si el ítem coincide con la búsqueda
   */
  isItemMatch(stock: StockAlmacen): boolean {
    if (!this.searchTerm.trim()) {
      return false;
    }
    
    const itemName = stock?.item?.nombreItem || '';
    const termino = this.searchTerm.toLowerCase();
    
    return itemName.toLowerCase().includes(termino);
  }
} 