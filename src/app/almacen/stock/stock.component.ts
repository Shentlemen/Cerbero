import { Component, OnInit, ChangeDetectorRef, ViewChild, TemplateRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { AlmacenConfigService } from '../../services/almacen-config.service';
import { AlmacenConfig } from '../../interfaces/almacen-config.interface';
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
  private cargandoFormularioEdicion: boolean = false;
  stockSeleccionado: StockAlmacen | null = null;
  stockAEliminar: StockAlmacen | null = null;
  stockParaVer: StockAlmacen | null = null;

  @ViewChild('modalUbicacion') modalUbicacionRef!: TemplateRef<any>;

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

  // Propiedades para configuración de almacén (mismo formato que transferir equipo: E1, E2... / 1, 2, 3 / A, B, C)
  configAlmacenActual: AlmacenConfig | null = null;
  estanteriasDisponibles: string[] = [];
  estantesDisponibles: string[] = [];
  divisionesDisponibles: string[] = [];

  constructor(
    private stockAlmacenService: StockAlmacenService,
    private almacenService: AlmacenService,
    private lotesService: LotesService,
    private comprasService: ComprasService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private almacenConfigService: AlmacenConfigService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.stockForm = this.fb.group({
      compraId: ['', Validators.required],
      itemId: ['', Validators.required],
      almacenId: ['', Validators.required],
      estanteria: ['', [Validators.required, Validators.maxLength(50)]],
      estante: ['', [Validators.required, Validators.maxLength(50)]],
      division: ['', Validators.maxLength(10)], // Nueva división del estante
      cantidad: [1, [Validators.required, Validators.min(1)]],
      numero: ['', Validators.maxLength(50)],
      descripcion: ['', Validators.maxLength(255)]
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
    
    // Nota: NO usamos compraId.valueChanges para resetear itemId porque provoca un bug:
    // al seleccionar almacén, algo dispara una emisión falsa que borra el ítem. En su lugar,
    // seleccionarCompra() ya limpia itemId cuando el usuario elige una nueva compra.

    // Escuchar cambios en almacenId para cargar configuración y resetear ubicación
    this.stockForm.get('almacenId')?.valueChanges.subscribe(almacenId => {
      if (almacenId) {
        this.cargarConfiguracionAlmacen(parseInt(almacenId));
        if (!this.cargandoFormularioEdicion) {
          this.stockForm.patchValue({ estanteria: '', estante: '', division: '' }, { emitEvent: false });
        }
      } else {
        this.limpiarConfiguracionAlmacen();
      }
    });
  }

  cargarConfiguracionAlmacen(almacenId: number): void {
    this.almacenConfigService.getConfigByAlmacenId(almacenId).subscribe({
      next: (config) => {
        if (config) {
          this.configAlmacenActual = config;
          // Mismas opciones que el modal de transferir equipo: E1, E2... / 1, 2, 3 / A, B, C
          this.estanteriasDisponibles = Array.from({ length: config.cantidadEstanterias }, (_, i) => `E${i + 1}`);
          this.estantesDisponibles = Array.from({ length: config.cantidadEstantesPorEstanteria }, (_, i) => `${i + 1}`);
          this.divisionesDisponibles = this.almacenConfigService.getDivisionesArray(config.divisionesEstante);
          this.updateFormValidation();
        } else {
          // Sin configuración: usar mismos valores por defecto que transferir equipo
          this.configAlmacenActual = null;
          this.estanteriasDisponibles = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
          this.estantesDisponibles = ['1', '2', '3'];
          this.divisionesDisponibles = ['A', 'B', 'C'];
          this.updateFormValidation();
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al cargar configuración del almacén:', error);
        this.estanteriasDisponibles = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
        this.estantesDisponibles = ['1', '2', '3'];
        this.divisionesDisponibles = ['A', 'B', 'C'];
        this.configAlmacenActual = null;
        this.updateFormValidation();
        this.cdr.detectChanges();
      }
    });
  }

  limpiarConfiguracionAlmacen(): void {
    this.configAlmacenActual = null;
    this.estanteriasDisponibles = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
    this.estantesDisponibles = ['1', '2', '3'];
    this.divisionesDisponibles = ['A', 'B', 'C'];
    this.updateFormValidation();
  }

  /** Normaliza valor de estantería para el dropdown (E1, E2...) si viene como número "1", "2" */
  private normalizarEstanteriaParaForm(estanteria: string | null | undefined): string {
    if (!estanteria) return '';
    const s = String(estanteria).trim();
    if (/^E\d+$/i.test(s)) return s;
    const num = parseInt(s, 10);
    if (!isNaN(num) && num >= 1) return `E${num}`;
    return s;
  }

  updateFormValidation(): void {
    // Validaciones básicas para compraId e itemId
    const compraIdControl = this.stockForm.get('compraId');
    const itemIdControl = this.stockForm.get('itemId');
    
    compraIdControl?.setValidators([Validators.required]);
    itemIdControl?.setValidators([Validators.required]);
    
    compraIdControl?.updateValueAndValidity();
    itemIdControl?.updateValueAndValidity();

    // Si hay configuración, validar que estantería y estante estén en las opciones disponibles
    if (this.configAlmacenActual) {
      const estanteriaControl = this.stockForm.get('estanteria');
      const estanteControl = this.stockForm.get('estante');
      if (estanteriaControl) {
        estanteriaControl.setValidators([
          Validators.required,
          (control) => {
            if (!control.value || this.estanteriasDisponibles.length === 0) return null;
            return this.estanteriasDisponibles.includes(String(control.value)) ? null : { invalidEstanteria: true };
          }
        ]);
        estanteriaControl.updateValueAndValidity();
      }
      if (estanteControl) {
        estanteControl.setValidators([
          Validators.required,
          (control) => {
            if (!control.value || this.estantesDisponibles.length === 0) return null;
            return this.estantesDisponibles.includes(String(control.value)) ? null : { invalidEstante: true };
          }
        ]);
        estanteControl.updateValueAndValidity();
      }
    }
  }

  /**
   * Filtra el stock excluyendo items en cementerio o laboratorio.
   * Los equipos en esos almacenes especiales no deben aparecer en la gestión de stock.
   */
  private filtrarStockExcluyendoAlmacenesEspeciales(stock: StockAlmacen[], almacenes: any[]): StockAlmacen[] {
    const idsExcluidos = new Set<number>();
    for (const a of almacenes) {
      const numero = (a?.numero || '').toLowerCase().trim();
      const nombre = (a?.nombre || '').toLowerCase();
      const esCementerio = numero === 'alm01' || numero === 'alm 01' ||
        nombre.includes('subsuelo') || nombre.includes('cementerio');
      const esLaboratorio = numero === 'alm05' || numero === 'alm 05' ||
        nombre.includes('pañol 3');
      if (esCementerio || esLaboratorio) {
        idsExcluidos.add(Number(a.id));
      }
    }
    if (idsExcluidos.size === 0) return stock;
    return stock.filter(item => {
      const almacenId = item?.almacen?.id;
      return almacenId == null || !idsExcluidos.has(Number(almacenId));
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
      if (almacenes) {
        this.almacenes = almacenes;
      }

      if (stock) {
        // Excluir items en cementerio o laboratorio: nunca deben aparecer en gestión de stock
        this.stock = this.filtrarStockExcluyendoAlmacenesEspeciales(stock, almacenes || []);
        this.stockFiltrado = [...this.stock];
        this.actualizarPaginacion();
      }

      if (compras) {
        this.compras = compras;
        this.comprasFiltradas = [...compras];
      }

      this.loading = false;

      // Si llegamos con query registrarAlmacen, abrir modal de registro con ese almacén pre-seleccionado
      const registrarAlmacen = this.route.snapshot.queryParams['registrarAlmacen'];
      if (registrarAlmacen != null && registrarAlmacen !== '') {
        const almacenId = Number(registrarAlmacen);
        if (!isNaN(almacenId) && this.permissionsService.canManageAssets()) {
          this.abrirModalRegistrarConAlmacen(almacenId);
          this.router.navigate([], { relativeTo: this.route, queryParams: {}, queryParamsHandling: '' });
        }
      }
    }).catch(error => {
      console.error('Error al cargar datos:', error);
      this.error = 'Error al cargar datos. Por favor, intente nuevamente.';
      this.loading = false;
    });
  }

  /**
   * Abre el modal de registro de stock con un almacén ya pre-seleccionado.
   * Se usa cuando el usuario llega desde la vista de un almacén concreto.
   */
  abrirModalRegistrarConAlmacen(almacenId: number): void {
    this.abrirModalUbicacion(this.modalUbicacionRef, undefined, almacenId);
  }

  abrirModalVer(modal: any, stock: StockAlmacen): void {
    this.stockParaVer = stock;
    this.modalService.open(modal, { size: 'md', backdrop: true });
  }

  cerrarYEditarStock(): void {
    if (!this.stockParaVer) return;
    const stock = this.stockParaVer;
    this.modalService.dismissAll();
    setTimeout(() => this.abrirModalUbicacion(this.modalUbicacionRef, stock), 150);
  }

  getDescripcionResumida(descripcion: string | null | undefined): string {
    if (!descripcion?.trim()) return '-';
    return descripcion.length > 40 ? descripcion.slice(0, 40) + '...' : descripcion;
  }

  async abrirModalUbicacion(modal: any, stock?: StockAlmacen, almacenIdPreseleccionado?: number): Promise<void> {
    this.modoEdicion = !!stock;
    this.stockSeleccionado = stock || null;


    if (this.modoEdicion && stock) {
      this.cargandoFormularioEdicion = true;
      const idItem = stock.item?.idItem ?? null;
      if (idItem != null) {
        const itemInfo = await this.lotesService.getLote(idItem).toPromise();
        if (itemInfo) {
          let estanteValue = stock.estante;
          let divisionValue = '';
          if (stock.estante) {
            const match = stock.estante.match(/^(\d+)[\s-]?([A-Za-z]+)?$/);
            if (match) {
              estanteValue = match[1];
              divisionValue = match[2] || '';
            }
          }

          const estanteriaForForm = this.normalizarEstanteriaParaForm(stock.estanteria);
          this.stockForm.patchValue({
            compraId: itemInfo.idCompra,
            itemId: idItem,
            almacenId: stock.almacen.id,
            estanteria: estanteriaForForm,
            estante: estanteValue,
            division: divisionValue || stock.seccion || '',
            cantidad: stock.cantidad,
            numero: stock.numero,
            descripcion: stock.descripcion
          });
          
          await this.cargarItemsDeCompra(itemInfo.idCompra);
          
          const compraInfo = this.compras.find(c => c.idCompra === itemInfo.idCompra);
          if (compraInfo) {
            this.compraSearchTerm = compraInfo.numeroCompra || '';
          }
          const idBuscado = Number(idItem);
          const itemCargado = this.itemsDeCompra.find(i => Number(i.idItem) === idBuscado);
          this.itemSearchTerm = itemCargado?.nombreItem ?? (stock.item as any)?.nombreItem ?? (stock.item as any)?.nombre ?? '';
        }
      } else {
        // Equipo/dispositivo transferido (sin ítem de compra): solo cargar ubicación y detalles
        let estanteValue = stock.estante;
        let divisionValue = '';
        if (stock.estante) {
          const match = stock.estante.match(/^(\d+)[\s-]?([A-Za-z]+)?$/);
          if (match) {
            estanteValue = match[1];
            divisionValue = match[2] || '';
          }
        }
        const estanteriaForForm = this.normalizarEstanteriaParaForm(stock.estanteria);
        this.stockForm.patchValue({
          almacenId: stock.almacen.id,
          estanteria: estanteriaForForm,
          estante: estanteValue,
          division: divisionValue || stock.seccion || '',
          cantidad: stock.cantidad,
          numero: stock.numero,
          descripcion: stock.descripcion
        });
        this.compraSearchTerm = 'Equipo transferido';
        this.itemSearchTerm = stock.item?.nombreItem || stock.numero || 'Equipo transferido';
        this.itemsDeCompra = [];
        this.itemsFiltrados = [];
      }
      this.cargandoFormularioEdicion = false;
      this.cdr.detectChanges();
    } else {
      // Modo creación: resetear formulario (valores '' para que los dropdowns muestren "Sin selección")
      // Si viene almacenIdPreseleccionado (ej. desde vista de almacén), pre-seleccionar ese almacén
      const almacenInicial = almacenIdPreseleccionado ?? '';
      this.stockForm.reset({
        compraId: '',
        itemId: '',
        almacenId: almacenInicial,
        estanteria: '',
        estante: '',
        division: '',
        cantidad: 1,
        numero: '',
        descripcion: ''
      });
      this.itemsDeCompra = [];
      this.itemsFiltrados = [];
      if (almacenIdPreseleccionado != null) {
        this.cargarConfiguracionAlmacen(almacenIdPreseleccionado);
      } else {
        this.limpiarConfiguracionAlmacen();
      }
    }

    // Actualizar validaciones después de configurar el formulario
    this.updateFormValidation();
    this.modalService.open(modal, { 
      size: 'lg',
      backdrop: true
    });
    // Reaplicar nombre del ítem después de abrir el modal (algo en el render del modal lo deja en blanco)
    if (this.modoEdicion && this.stockSeleccionado) {
      setTimeout(() => {
        const idItem = this.stockSeleccionado!.item?.idItem;
        if (idItem != null) {
          const idBuscado = Number(idItem);
          const itemCargado = this.itemsDeCompra.find(i => Number(i.idItem) === idBuscado);
          this.itemSearchTerm = itemCargado?.nombreItem ?? (this.stockSeleccionado!.item as any)?.nombreItem ?? (this.stockSeleccionado!.item as any)?.nombre ?? '';
        } else {
          this.itemSearchTerm = this.stockSeleccionado!.item?.nombreItem || this.stockSeleccionado!.numero || 'Equipo transferido';
        }
        this.cdr.detectChanges();
      }, 0);
    }
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
    const estanteFinal = formData.estante ? String(formData.estante) : '';
    const seccionFinal = formData.division && String(formData.division).trim() ? String(formData.division).trim() : undefined;

    const nuevoStock: StockAlmacenCreateWithItem = {
      compraId: formData.compraId,
      itemId: formData.itemId,
      almacenId: formData.almacenId,
      estanteria: formData.estanteria ? String(formData.estanteria) : '',
      estante: estanteFinal,
      seccion: seccionFinal,
      cantidad: formData.cantidad,
      numero: formData.numero,
      descripcion: formData.descripcion
    };

    if (this.modoEdicion && this.stockSeleccionado) {
      const stockParaActualizar: StockAlmacenCreate = {
        idCompra: formData.compraId,
        itemId: formData.itemId,
        almacenId: formData.almacenId,
        estanteria: formData.estanteria ? String(formData.estanteria) : '',
        estante: estanteFinal,
        seccion: seccionFinal,
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
      const compras = await this.comprasService.getCompras().toPromise();
      if (!compras || compras.length === 0) {
        return [];
      }
      
      let lotes: any[] = [];
      try {
        const lotesResult = await this.lotesService.getLotes().toPromise();
        lotes = lotesResult || [];
      } catch (lotesError) {
        return compras.map(compra => ({
          idCompra: compra.idCompra,
          numeroCompra: compra.numeroCompra,
          descripcion: compra.descripcion,
          items: []
        }));
      }
      
      if (lotes.length === 0) {
        return compras.map(compra => ({
          idCompra: compra.idCompra,
          numeroCompra: compra.numeroCompra,
          descripcion: compra.descripcion,
          items: []
        }));
      }
      
      const comprasConLotes = new Map();
      lotes.forEach(lote => {
        const compra = compras.find(c => Number(c.idCompra) === Number(lote.idCompra));
        if (compra && !comprasConLotes.has(Number(compra.idCompra))) {
          comprasConLotes.set(Number(compra.idCompra), {
            idCompra: compra.idCompra,
            numeroCompra: compra.numeroCompra,
            descripcion: compra.descripcion,
            items: []
          });
        }
        if (compra && comprasConLotes.has(Number(compra.idCompra))) {
          comprasConLotes.get(Number(compra.idCompra))!.items.push(lote);
        }
      });
      
      return Array.from(comprasConLotes.values());
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
    this.comprasFiltradas = this.compras.filter(compra => {
      const numeroCompra = String(compra.numeroCompra || '').toLowerCase();
      const idCompra = String(compra.idCompra || '').toLowerCase();
      return numeroCompra.includes(searchTerm) || idCompra.includes(searchTerm);
    });
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

  // Métodos para manejar ítems de la compra seleccionada (usa by-compra para evitar fallos de tipo idCompra)
  async cargarItemsDeCompra(compraId: number): Promise<void> {
    try {
      const lotes = await this.lotesService.getLotesByCompra(compraId).toPromise();
      if (lotes && lotes.length >= 0) {
        this.itemsDeCompra = lotes;
        this.itemsFiltrados = [...this.itemsDeCompra];
      } else {
        this.itemsDeCompra = [];
        this.itemsFiltrados = [];
      }
    } catch (error) {
      console.error('Error al cargar ítems de la compra:', error);
      this.itemsDeCompra = [];
      this.itemsFiltrados = [];
    }
  }

  /** Valor mostrado en el input de ítem: usa itemId como fuente de verdad para evitar que se borre al cambiar almacén */
  getItemInputDisplayValue(): string {
    const itemId = this.stockForm.get('itemId')?.value;
    if (itemId && this.itemsDeCompra?.length > 0) {
      const item = this.itemsDeCompra.find(i => Number(i.idItem) === Number(itemId));
      if (item) {
        return item.nombreItem || '';
      }
    }
    return this.itemSearchTerm || '';
  }

  onItemInputChange(value: string): void {
    this.itemSearchTerm = value || '';
    this.filtrarItems();
    // Si el usuario escribe algo distinto al ítem seleccionado, limpiar la selección
    const itemId = this.stockForm.get('itemId')?.value;
    if (itemId) {
      const item = this.itemsDeCompra.find(i => Number(i.idItem) === Number(itemId));
      if (item && item.nombreItem !== value) {
        this.stockForm.patchValue({ itemId: '' }, { emitEvent: false });
      }
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