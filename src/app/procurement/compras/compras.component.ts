import { Component, OnDestroy, OnInit, ViewEncapsulation, ChangeDetectorRef, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray, FormControl, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { ComprasService, CompraDTO } from '../../services/compras.service';
import { TiposCompraService, TipoDeCompraDTO } from '../../services/tipos-compra.service';
import { forkJoin } from 'rxjs';
import { ProveedoresService, ProveedorDTO } from '../../services/proveedores.service';
// import { ServiciosGarantiaService, ServicioGarantiaDTO } from '../../services/servicios-garantia.service';
import { LotesService, LoteDTO } from '../../services/lotes.service';
import { EntregasService, EntregaDTO } from '../../services/entregas.service';
import { PermissionsService } from '../../services/permissions.service';
import { RemitosService, RemitoDTO } from '../../services/remitos.service';
// import { PliegosService, PliegoDTO } from '../../services/pliegos.service';
import { CurrencyMaskDirective } from '../../shared/directives/currency-mask.directive';

// Importaciones para PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TourRegistryService } from '../../services/tour-registry.service';
import { GuidedTourHostService, type GuidedTourStepDef } from '../../services/guided-tour-host.service';
import { driver, type DriveStep, type Driver } from 'driver.js';

interface CompraConTipo extends CompraDTO {
  tipoCompraDescripcion?: string;
  tipoCompraAbreviado?: string;
}

/** Paso del tour DEMO con posibilidad de cambiar de pestaña antes de mostrarse. */
interface DemoStepDef extends GuidedTourStepDef {
  /** Pestaña del modal (`activeTab`) en la que debe estar el modal para este paso. */
  tab?: string;
}

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, NgbPaginationModule, NgbNavModule, CurrencyMaskDirective],
  templateUrl: './compras.component.html',
  styleUrls: ['./compras.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ComprasComponent implements OnInit, OnDestroy {
  comprasList: CompraConTipo[] = [];
  comprasFiltradas: CompraConTipo[] = [];
  lotesPorCompra: { [key: number]: LoteDTO[] } = {};
  tiposCompraList: TipoDeCompraDTO[] = [];
  filterForm: FormGroup;
  compraForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 11;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  showConfirmDialog = false;
  compraToDelete: number | null = null;
  itemsFormArray: FormArray;
  entregasFormArray: FormArray;
  activeTab: string = '1';
  proveedoresList: ProveedorDTO[] = [];
  // serviciosGarantiaList: ServicioGarantiaDTO[] = [];
  lotesDeLaCompra: LoteDTO[] = [];
  idItemsOriginales: number[] = [];
  idEntregasOriginales: number[] = [];
  tipoCompraFiltroActivo: number | null = null;
  compraSeleccionada: CompraConTipo | null = null;
  lotesDetalles: LoteDTO[] = [];
  entregasDetalles: EntregaDTO[] = [];
  isCompactView: boolean = true;
  private tourCleanup?: () => void;
  proveedoresFiltrados: { [key: number]: ProveedorDTO[] } = {};
  // serviciosGarantiaFiltrados: { [key: number]: ServicioGarantiaDTO[] } = {};
  proveedorSearchValues: { [key: number]: string } = {};
  servicioGarantiaSearchValues: { [key: number]: string } = {};
  dropdownProveedoresVisible: { [key: number]: boolean } = {};
  dropdownServiciosGarantiaVisible: { [key: number]: boolean } = {};
  
  // Propiedades para documentos
  documentosCompra: RemitoDTO[] = [];
  
  // Propiedades para pliego (un pliego por compra)
  // pliegoCompra: PliegoDTO | null = null;
  // descripcionPliego: string = '';
  
  // Propiedades para dropdowns de servicio de garantía (también proveedores)
  proveedoresGarantiaFiltrados: { [key: number]: ProveedorDTO[] } = {};
  proveedorGarantiaSearchValues: { [key: number]: string } = {};
  dropdownProveedoresGarantiaVisible: { [key: number]: boolean } = {};

  // Propiedades para documentos (unificadas)
  tipoDocumentoSeleccionado: 'documento' | null = null; // Solo documento
  documentoSeleccionado: File | null = null;
  descripcionDocumento: string = '';
  subiendoDocumento: boolean = false;

  /** Validación y errores del modal nueva/editar compra (mismo criterio que tickets). */
  compraModalValidacion: { titulo: string; lineas: string[]; esError: boolean } | null = null;

  @ViewChild('detallesModal') detallesModal!: TemplateRef<any>;
  @ViewChild('compraModal') compraModalTpl!: TemplateRef<any>;

  private tourCompra?: Driver;
  private tourDemoModalRef?: { close: () => void; dismiss: () => void; result: Promise<unknown> };
  /** Bandera que el modal de compra usa para mostrar que está en modo demo y bloquear el guardado. */
  tourDemoActivo = false;

  constructor(
    private comprasService: ComprasService,
    private tiposCompraService: TiposCompraService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private proveedoresService: ProveedoresService,
    // private serviciosGarantiaService: ServiciosGarantiaService,
    private lotesService: LotesService,
    private entregasService: EntregasService,
    private cdr: ChangeDetectorRef,
    private permissionsService: PermissionsService,
    private remitosService: RemitosService,
    private tourRegistry: TourRegistryService,
    private guidedTourHost: GuidedTourHostService
    // private pliegosService: PliegosService // Eliminar
  ) {
    this.filterForm = this.fb.group({
      descripcion: [''],
      moneda: [''],
      fechaInicio: [''],
      fechaFinal: [''],
      numeroCompra: ['']
    });

    this.compraForm = this.fb.group({
      idCompra: [null],
      numeroCompra: ['', Validators.required],
      idTipoCompra: ['', Validators.required],
      moneda: ['USD'], // Valor por defecto USD
      descripcion: [''],
      fechaInicio: [''],
      fechaFinal: [''],
      monto: [''], // Solo para modo edición
      valorDolar: ['', Validators.required], // Nuevo campo requerido
      ano: [new Date().getFullYear(), Validators.required]
    });

    this.itemsFormArray = this.fb.array([]);
    this.entregasFormArray = this.fb.array([]);

    // Suscribirse a cambios en el formulario de filtro
    this.filterForm.valueChanges.subscribe(() => {
      this.aplicarFiltros();
    });

    this.compraForm.valueChanges.subscribe(() => this.limpiarFeedbackCompraModal());
    this.itemsFormArray.valueChanges.subscribe(() => this.limpiarFeedbackCompraModal());
    this.entregasFormArray.valueChanges.subscribe(() => this.limpiarFeedbackCompraModal());
  }

  limpiarFeedbackCompraModal(): void {
    this.compraModalValidacion = null;
  }

  private armarLineasValidacionCompraPrincipal(): string[] {
    const lineas: string[] = [];
    const f = this.compraForm;
    const marcar = (name: string, mensaje: string) => {
      const c = f.get(name);
      if (c?.invalid) {
        lineas.push(mensaje);
      }
    };
    marcar('idTipoCompra', 'Seleccioná el tipo de compra.');
    marcar('numeroCompra', 'El número de compra es obligatorio.');
    marcar('ano', 'El año es obligatorio.');
    marcar('valorDolar', 'El valor del dólar es obligatorio.');
    return lineas;
  }

  private mensajeErrorHttp(error: unknown): string {
    const e = error as { error?: string | { message?: string }; message?: string };
    const body = e?.error;
    if (typeof body === 'string') {
      return body;
    }
    if (body && typeof body === 'object' && typeof body.message === 'string') {
      return body.message;
    }
    if (typeof e?.message === 'string') {
      return e.message;
    }
    return 'Ocurrió un error inesperado.';
  }

  ngOnInit(): void {
    this.loadData();
    this.loadProveedores(); // Asegurar que se ejecute primero
    const tours = [
      {
        id: 'compras-overview',
        title: 'Tour de compras',
        icon: 'fa-route',
        steps: [
          { selector: '#tour-compras-title', title: 'Compras', description: 'Registro de adquisiciones: moneda, tipo, lotes, ítems y entregas vinculados al inventario Cerbero.', side: 'bottom' as const },
          { selector: '#tour-compras-filters', title: 'Filtro por moneda', description: 'Acotá la lista por USD o UYU; “Todos” muestra el universo cargado.', side: 'bottom' as const },
          { selector: '#tour-compras-nueva', title: 'Nueva compra', description: 'Alta o edición en modal con ítems, proveedor y documentos según tus permisos.', side: 'left' as const },
          { selector: '#tour-compras-search-row', title: 'Búsqueda y tipo', description: 'Buscá por número de compra y refiná con chips de tipo de compra.', side: 'bottom' as const },
          { selector: '#tour-compras-table', title: 'Tabla', description: 'Ordená columnas y usá acciones por fila para ver detalle, editar o eliminar.', side: 'top' as const }
        ]
      },
      {
        id: 'compras-ver-detalle',
        title: 'Cómo ver el detalle de una compra',
        icon: 'fa-eye',
        description: 'Abre la primera compra de la lista y recorre las secciones del modal de detalle.',
        run: () => this.runTourVerCompra(),
      },
      ...(this.canManagePurchases()
        ? [{
            id: 'compras-crear-detalle',
            title: 'Cómo crear una compra',
            icon: 'fa-plus-circle',
            description: 'Abre el modal con una compra DEMO pre-cargada y recorre las 4 pestañas (datos, ítems, entregas y documentos).',
            run: () => this.runTourCrearCompra(),
          }]
        : []),
    ];
    this.tourCleanup = this.tourRegistry.register('compras', tours);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
    this.tourCompra?.destroy();
    this.tourCompra = undefined;
  }

  loadData(): Promise<void> {
    return new Promise((resolve, reject) => {
    this.loading = true;
    this.error = null;

    forkJoin({
      tiposCompra: this.tiposCompraService.getTiposCompra(),
      compras: this.comprasService.getCompras()
    }).subscribe({
      next: (data) => {
        this.tiposCompraList = data.tiposCompra;
        
        // Ahora procesar las compras con los tipos ya cargados
        this.comprasList = data.compras.map(compra => ({
          ...compra,
          tipoCompraDescripcion: this.getTipoCompraDescripcion(compra.idTipoCompra),
          tipoCompraAbreviado: this.getTipoCompraAbreviado(compra.idTipoCompra)
        }));
        
        this.comprasFiltradas = [...this.comprasList];
        this.collectionSize = this.comprasFiltradas.length;
        
        // Cargar lotes para recalcular totales
        this.cargarLotesParaCompras();
        
        this.loading = false;
          resolve();
      },
      error: (error) => {
        console.error('Error al cargar los datos:', error);
        this.error = 'Error al cargar los datos. Por favor, intente nuevamente.';
        this.loading = false;
          reject(error);
      }
    });
  });
  }

  loadTiposCompra(): void {
    this.tiposCompraService.getTiposCompra().subscribe({
      next: (tiposCompra) => {
        this.tiposCompraList = tiposCompra;
      },
      error: (error) => {
        console.error('Error al cargar los tipos de compra:', error);
        this.error = 'Error al cargar los tipos de compra. Por favor, intente nuevamente.';
      }
    });
  }

  loadCompras(): void {
    this.loading = true;
    this.error = null;
    
    this.comprasService.getCompras().subscribe({
      next: (compras) => {
        this.comprasList = compras.map(compra => ({
          ...compra,
          tipoCompraDescripcion: this.getTipoCompraDescripcion(compra.idTipoCompra),
          tipoCompraAbreviado: this.getTipoCompraAbreviado(compra.idTipoCompra)
        }));
        this.comprasFiltradas = [...this.comprasList];
        this.collectionSize = this.comprasFiltradas.length;
        
        // Cargar lotes para cada compra
        this.cargarLotesParaCompras();
        
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar las compras:', error);
        this.error = 'Error al cargar las compras. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  cargarLotesParaCompras(): void {
    this.lotesPorCompra = {};
    
    this.comprasList.forEach(compra => {
      this.lotesService.getLotesByCompra(compra.idCompra).subscribe({
        next: (lotes) => {
          this.lotesPorCompra[compra.idCompra] = lotes;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error(`Error al cargar lotes para compra ${compra.idCompra}:`, error);
          this.lotesPorCompra[compra.idCompra] = [];
        }
      });
    });
  }

  getTipoCompraDescripcion(idTipoCompra: number): string {
    const tipoCompra = this.tiposCompraList.find(tipo => tipo.idTipoCompra === idTipoCompra);
    return tipoCompra ? tipoCompra.descripcion : 'Tipo no encontrado';
  }

  getTipoCompraAbreviado(idTipoCompra: number): string {
    const tipoCompra = this.tiposCompraList.find(tipo => tipo.idTipoCompra === idTipoCompra);
    return tipoCompra ? (tipoCompra.abreviado || '') : '';
  }

  getNombreCompraFormateado(compra: CompraConTipo): string {
    // Obtener el abreviado directamente del tipo de compra
    const abreviado = this.getTipoCompraAbreviado(compra.idTipoCompra);
    const numero = compra.numeroCompra || '';
    const ano = compra.ano && compra.ano > 0 ? compra.ano.toString() : '';
    
    if (!abreviado && !numero && !ano) {
      return 'Sin información';
    }
    
    // Construir el nombre formateado: [abreviado] [número] / [año]
    let nombreFormateado = '';
    
    if (abreviado) {
      nombreFormateado += abreviado;
    }
    
    if (numero) {
      if (nombreFormateado) nombreFormateado += ' ';
      nombreFormateado += numero;
    }
    
    if (ano) {
      nombreFormateado += ` / ${ano}`;
    }
    
    return nombreFormateado || 'Sin información';
  }

  get pagedCompras(): CompraConTipo[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.comprasFiltradas.slice(startItem, endItem);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.comprasFiltradas.sort((a, b) => {
      let valueA = a[column as keyof CompraConTipo];
      let valueB = b[column as keyof CompraConTipo];

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

  abrirModal(modal: any, compra?: CompraConTipo): void {
    this.compraModalValidacion = null;
    this.activeTab = '1';
    if (compra) {
      this.modoEdicion = true;
      this.compraForm.patchValue({
        idCompra: compra.idCompra,
        numeroCompra: compra.numeroCompra,
        idTipoCompra: compra.idTipoCompra,
        moneda: compra.moneda,
        descripcion: compra.descripcion,
        fechaInicio: compra.fechaInicio,
        fechaFinal: compra.fechaFinal,
        monto: compra.monto,
        valorDolar: compra.valorDolar, // Nuevo campo
        ano: compra.ano && compra.ano > 0 ? compra.ano : null
      });
      
      // El monto se formateará automáticamente por la directive appCurrencyMask
      // Cargar lotes asociados a la compra
      this.lotesService.getLotesByCompra(compra.idCompra).subscribe({
        next: (lotes) => {
          this.lotesDeLaCompra = lotes;
          this.idItemsOriginales = lotes.map(l => l.idItem);
          this.itemsFormArray.clear();
          lotes.forEach(lote => {
            this.itemsFormArray.push(this.fb.group({
              nombreItem: [lote.nombreItem, Validators.required],
              descripcion: [lote.descripcion],
              cantidad: [lote.cantidad, [Validators.required, Validators.min(1)]],
              mesesGarantia: [lote.mesesGarantia, [Validators.required, Validators.min(0)]],
              idProveedor: [lote.idProveedor, Validators.required],
              idServicioGarantia: [lote.idServicioGarantia, Validators.required],
              idItem: [lote.idItem],
              precioUnitario: [lote.precioUnitario, [Validators.required, Validators.min(0.01)]],
              monedaPrecio: [lote.monedaPrecio || 'USD', Validators.required],
              porcentajeIva: [lote.porcentajeIva || 22.00, [Validators.required, Validators.min(0), Validators.max(100)]]
            }));
          });
          // Cargar entregas asociadas a los lotes de la compra
          this.entregasFormArray.clear();
          this.idEntregasOriginales = [];
          const entregasObservables = lotes.map(lote => this.entregasService.getEntregasByItem(lote.idItem).toPromise());
          Promise.all(entregasObservables).then(entregasPorLote => {
            const entregas = entregasPorLote.flat().filter(e => !!e);
            this.idEntregasOriginales = entregas.map(e => e.idEntrega!);
            entregas.forEach(entrega => {
              this.entregasFormArray.push(this.fb.group({
                idEntrega: [entrega.idEntrega],
                idItem: [entrega.idItem, Validators.required],
                cantidad: [entrega.cantidad, [Validators.required, Validators.min(1)]],
                descripcion: [entrega.descripcion],
                fechaPedido: [entrega.fechaPedido, Validators.required],
                fechaFinGarantia: [entrega.fechaFinGarantia, Validators.required]
              }));
            });
            this.cdr.detectChanges();
          });
          this.cdr.detectChanges();
        },
        error: () => {
          this.lotesDeLaCompra = [];
          this.idItemsOriginales = [];
          this.idEntregasOriginales = [];
          this.itemsFormArray.clear();
          this.entregasFormArray.clear();
        }
      });
      
        // Cargar documentos de la compra para el modo edición
  this.cargarDocumentosCompra(compra.idCompra);
      
      // Cargar pliego de la compra para el modo edición
      // this.cargarPliegoCompra(compra.idCompra);
    } else {
      this.modoEdicion = false;
      this.compraForm.reset();
      // En modo creación, no mostrar el campo monto
      this.compraForm.patchValue({
        ano: new Date().getFullYear(),
        moneda: 'USD', // Establecer USD como valor por defecto
        valorDolar: null // Limpiar valor dólar
      });
      this.itemsFormArray.clear();
      this.entregasFormArray.clear();
      this.lotesDeLaCompra = [];
      this.documentosCompra = [];
      this.descripcionDocumento = '';
      // this.pliegoCompra = null;
      // this.descripcionPliego = '';
    }
    this.cdr.detectChanges();
    this.modalService.open(modal, {
      size: 'xl',
      backdrop: true,
      windowClass: 'compra-form-modal-window'
    });
  }

  get itemsControls() {
    return (this.itemsFormArray.controls as FormGroup[] || []);
  }

  get entregasControls() {
    return (this.entregasFormArray.controls as FormGroup[] || []);
  }

  agregarItem() {
    this.itemsFormArray.push(this.fb.group({
      nombreItem: ['', Validators.required],
      descripcion: [''],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      mesesGarantia: [0, [Validators.min(0)]],
      idProveedor: [null],
      idServicioGarantia: [null],
      precioUnitario: [null], // Sin validación requerida
      monedaPrecio: ['USD'], // Sin validación requerida
      porcentajeIva: [22.00, [Validators.required, Validators.min(0), Validators.max(100)]]
    }));
    this.cdr.detectChanges();
  }

  eliminarItem(index: number) {
    this.itemsFormArray.removeAt(index);
    this.cdr.detectChanges();
  }

  agregarEntrega() {
    const hoy = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    
    console.log('Agregando nueva entrega con fecha:', hoy);
    
    this.entregasFormArray.push(this.fb.group({
      idItem: [null, Validators.required],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      descripcion: [''],
      fechaPedido: [hoy, Validators.required],
      fechaFinGarantia: ['', Validators.required]
    }));
    
    console.log('Entrega agregada, total de entregas:', this.entregasFormArray.length);
  }

  calcularFechaFinGarantia(index: number): void {
    console.log('Calculando fecha fin garantía para entrega:', index);
    
    const entregaControl = this.entregasFormArray.at(index);
    const idItem = entregaControl.get('idItem')?.value;
    const nombreItem = entregaControl.get('nombreItem')?.value;
    const fechaPedido = entregaControl.get('fechaPedido')?.value;
    
    console.log('Valores de la entrega:', { idItem, nombreItem, fechaPedido });
    
    if ((idItem || nombreItem) && fechaPedido) {
      // Buscar el ítem seleccionado para obtener los meses de garantía
      let itemEncontrado = null;
      
      if (this.modoEdicion) {
        // En modo edición, buscar en lotesDeLaCompra
        itemEncontrado = this.lotesDeLaCompra.find(lote => lote.idItem === idItem);
      } else {
        // En modo creación, buscar en itemsControls
        itemEncontrado = this.itemsControls.find(itemControl => 
          itemControl.get('nombreItem')?.value === nombreItem
        );
      }
      
      console.log('Ítem encontrado:', itemEncontrado);
      
      if (itemEncontrado) {
        let mesesGarantia = 0;
        
        if (this.modoEdicion) {
          // En modo edición, obtener de lotesDeLaCompra
          const lote = itemEncontrado as LoteDTO;
          mesesGarantia = lote.mesesGarantia || 0;
        } else {
          // En modo creación, obtener de itemsControls
          const itemControl = itemEncontrado as FormGroup;
          mesesGarantia = itemControl.get('mesesGarantia')?.value || 0;
        }
        
        console.log('Meses de garantía:', mesesGarantia);
        
        if (mesesGarantia > 0) {
          // Calcular fecha de fin de garantía
          const fechaInicio = new Date(fechaPedido);
          const fechaFin = new Date(fechaInicio);
          fechaFin.setMonth(fechaFin.getMonth() + mesesGarantia);
          
          // Formatear a YYYY-MM-DD
          const fechaFinFormateada = fechaFin.toISOString().split('T')[0];
          
          console.log('Fecha fin garantía calculada:', fechaFinFormateada);
          
          // Actualizar el campo fechaFinGarantia
          entregaControl.get('fechaFinGarantia')?.setValue(fechaFinFormateada);
          
          // Forzar detección de cambios
          this.cdr.detectChanges();
        }
      }
    }
  }

  eliminarEntrega(index: number) {
    this.entregasFormArray.removeAt(index);
  }

  guardarCompra(): void {
    if (this.tourDemoActivo) {
      this.tourDemoModalRef?.dismiss();
      return;
    }
    if (!this.compraForm.valid) {
      this.compraForm.markAllAsTouched();
      const lineas = this.armarLineasValidacionCompraPrincipal();
      this.compraModalValidacion = {
        titulo: 'Revisá el formulario antes de guardar',
        lineas: lineas.length > 0 ? lineas : ['Por favor, complete todos los campos requeridos.'],
        esError: false
      };
      this.error = null;
      return;
    }

    const valorDolar = this.compraForm.get('valorDolar')?.value;
    if (!valorDolar || valorDolar <= 0) {
      this.compraModalValidacion = {
        titulo: 'Revisá el valor del dólar',
        lineas: ['El valor del dólar es requerido y debe ser mayor a 0.'],
        esError: false
      };
      this.error = null;
      return;
    }

    const itemsData = this.itemsFormArray.value;
    if (itemsData.length > 0) {
      for (const item of itemsData) {
        const nombre = (item.nombreItem || 'sin nombre').trim() || 'sin nombre';
        if (!item.precioUnitario || item.precioUnitario <= 0) {
          this.compraModalValidacion = {
            titulo: 'Revisá los ítems',
            lineas: [`El ítem "${nombre}" debe tener un precio unitario válido.`],
            esError: false
          };
          this.error = null;
          return;
        }
        if (!item.monedaPrecio) {
          this.compraModalValidacion = {
            titulo: 'Revisá los ítems',
            lineas: [`El ítem "${nombre}" debe tener una moneda de precio especificada.`],
            esError: false
          };
          this.error = null;
          return;
        }
      }
    }

    const montoTotalConIva = this.calcularMontoTotalConIva();
    const subtotalTotal = this.calcularSubtotalTotal();
    const ivaTotal = this.calcularIvaTotal();

    const moneda = this.compraForm.get('moneda')?.value;

    let montoConvertido = montoTotalConIva;
    let subtotalConvertido = subtotalTotal;
    let ivaConvertido = ivaTotal;

    if (moneda === 'UYU' && valorDolar && valorDolar > 0) {
      montoConvertido = montoTotalConIva * valorDolar;
      subtotalConvertido = subtotalTotal * valorDolar;
      ivaConvertido = ivaTotal * valorDolar;
    }

    this.compraForm.patchValue({
      monto: montoConvertido,
      montoTotalConIva: montoConvertido,
      subtotalCompra: subtotalConvertido,
      totalIva: ivaConvertido
    });

    const compraData = this.compraForm.value;
    const entregasData = this.entregasFormArray.value;
    this.compraModalValidacion = null;
    this.error = null;

    if (this.modoEdicion) {
      if (!compraData.idCompra) {
        this.compraModalValidacion = {
          titulo: 'No se pudo guardar',
          lineas: ['Error: ID de compra no válido.'],
          esError: true
        };
        this.error = null;
        return;
      }
      this.comprasService.actualizarCompra(compraData.idCompra, compraData).subscribe({
        next: () => {
          this.guardarItemsYEntregas(compraData.idCompra, itemsData, entregasData);
        },
        error: (error) => {
          this.compraModalValidacion = {
            titulo: 'Error al actualizar la compra',
            lineas: [this.mensajeErrorHttp(error)],
            esError: true
          };
          this.error = null;
        }
      });
    } else {
      const { idCompra, ...nuevaCompra } = compraData;
      this.comprasService.crearCompra(nuevaCompra).subscribe({
        next: (compraCreada) => {
          this.guardarItemsYEntregas(compraCreada.idCompra, itemsData, entregasData);
        },
        error: (error) => {
          this.compraModalValidacion = {
            titulo: 'Error al crear la compra',
            lineas: [this.mensajeErrorHttp(error)],
            esError: true
          };
          this.error = null;
        }
      });
    }
  }

  guardarItemsYEntregas(idCompra: number, itemsData: any[], entregasData: any[]) {
    console.log('🔍 DEBUG - Iniciando guardado...');
    console.log('🔍 DEBUG - ID Compra:', idCompra);
    console.log('🔍 DEBUG - Items a enviar:', JSON.stringify(itemsData, null, 2));
    console.log('🔍 DEBUG - Entregas a enviar:', JSON.stringify(entregasData, null, 2));
    
    // Si estamos editando, eliminar los ítems que fueron quitados
    if (this.modoEdicion && this.idItemsOriginales.length > 0) {
      const idItemsActuales = itemsData.filter(i => i.idItem).map(i => i.idItem);
      const idItemsAEliminar = this.idItemsOriginales.filter(id => !idItemsActuales.includes(id));
      const deleteObservables = idItemsAEliminar.map(id => this.lotesService.eliminarLote(id).toPromise());
      Promise.all(deleteObservables).catch(() => {}); // No detener el flujo si falla un delete
    }
    // Si estamos editando, eliminar las entregas que fueron quitadas
    if (this.modoEdicion && this.idEntregasOriginales.length > 0) {
      const idEntregasActuales = entregasData.filter(e => e.idEntrega).map(e => e.idEntrega);
      const idEntregasAEliminar = this.idEntregasOriginales.filter(id => !idEntregasActuales.includes(id));
      const deleteEntregasObs = idEntregasAEliminar.map(id => this.entregasService.eliminarEntrega(id).toPromise());
      Promise.all(deleteEntregasObs).catch(() => {});
    }
    // Guardar ítems (lotes)
    const lotesObservables = itemsData.map(item => {
      const itemData = { ...item, idCompra };
      console.log('🔍 DEBUG - Enviando lote:', JSON.stringify(itemData, null, 2));
      
      if (item.idItem) {
        // Actualizar lote existente
        console.log('🔍 DEBUG - Actualizando lote existente ID:', item.idItem);
        return this.lotesService.actualizarLote(item.idItem, itemData);
      } else {
        // Crear nuevo lote
        console.log('🔍 DEBUG - Creando nuevo lote');
        return this.lotesService.crearLote(itemData);
      }
    });
    
    Promise.all(lotesObservables.map(obs => obs.toPromise()))
      .then(lotesGuardados => {
        console.log('🔍 DEBUG - Lotes guardados exitosamente:', lotesGuardados);
        
        // Guardar entregas
        const entregasObservables = entregasData.map(entrega => {
          // Buscar el idItem correspondiente
          let idItem = entrega.idItem;
          if (!idItem && entrega.nombreItem) {
            // Buscar por nombre si es necesario
            const lote = lotesGuardados.find(l => l?.nombreItem === entrega.nombreItem);
            idItem = lote?.idItem;
          }
          if (!idItem) return null;
          if (entrega.idEntrega) {
            // Actualizar entrega existente
            return this.entregasService.actualizarEntrega(entrega.idEntrega, { ...entrega, idItem });
          } else {
            // Crear nueva entrega
            return this.entregasService.crearEntrega({ ...entrega, idItem });
          }
        }).filter(Boolean);
        return Promise.all(entregasObservables.filter(obs => !!obs).map(obs => obs!.toPromise()));
      })
      .then(() => {
        // Cerrar el modal siempre que la operación sea exitosa
        this.modalService.dismissAll();
        this.error = null;
        
        // Recargar datos en segundo plano
        this.loadData().catch(error => {
          console.warn('No se pudieron recargar los datos, pero la compra se guardó correctamente:', error);
        });
      })
      .catch(error => {
        console.error('🔍 DEBUG - Error completo:', error);
        console.error('🔍 DEBUG - Error response:', error.error);
        console.error('🔍 DEBUG - Error status:', error.status);
        console.error('🔍 DEBUG - Error message:', error.message);
        console.error('🔍 DEBUG - Error URL:', error.url);
        
        // Intentar obtener más detalles del error
        if (error.error) {
          console.error('🔍 DEBUG - Error details:', error.error);
        }
        
        this.compraModalValidacion = {
          titulo: 'Error al guardar ítems o entregas',
          lineas: [this.mensajeErrorHttp(error)],
          esError: true
        };
        this.error = null;
      });
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
    
    this.comprasFiltradas = this.comprasList.filter(compra => {
      let cumpleFiltros = true;

      if (filtros.numeroCompra && compra.numeroCompra) {
        cumpleFiltros = cumpleFiltros && compra.numeroCompra.toLowerCase().includes(filtros.numeroCompra.toLowerCase());
      }
      if (filtros.descripcion && compra.descripcion) {
        cumpleFiltros = cumpleFiltros && 
          compra.descripcion.toLowerCase().includes(filtros.descripcion.toLowerCase());
      }

      if (filtros.moneda && compra.moneda) {
        cumpleFiltros = cumpleFiltros && 
          compra.moneda.toLowerCase().includes(filtros.moneda.toLowerCase());
      }

      if (filtros.fechaInicio && compra.fechaInicio) {
        cumpleFiltros = cumpleFiltros && 
          compra.fechaInicio >= filtros.fechaInicio;
      }

      if (filtros.fechaFinal && compra.fechaFinal) {
        cumpleFiltros = cumpleFiltros && 
          compra.fechaFinal <= filtros.fechaFinal;
      }

      return cumpleFiltros;
    });

    this.collectionSize = this.comprasFiltradas.length;
    this.page = 1;
  }

  eliminarCompra(id: number): void {
    this.compraToDelete = id;
    this.showConfirmDialog = true;
  }

  confirmarEliminacion(): void {
    if (this.compraToDelete) {
      this.comprasService.eliminarCompra(this.compraToDelete).subscribe({
        next: () => {
          this.loadData();
          this.showConfirmDialog = false;
          this.compraToDelete = null;
        },
        error: (error) => {
          console.error('Error al eliminar la compra:', error);
          this.error = 'Error al eliminar la compra. Por favor, intente nuevamente.';
          this.showConfirmDialog = false;
          this.compraToDelete = null;
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.compraToDelete = null;
  }

  formatearMoneda(monto: number | null | undefined, moneda: string | null | undefined): string {
    if (monto === null || monto === undefined || monto === 0) {
      return 'No definido';
    }
    
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    }).format(monto);
  }

  // Método de formateo de monto reemplazado por la directive appCurrencyMask

  formatearMontoOnBlur(event: any): void {
    const input = event.target;
    let value = input.value;
    
    // Si el campo está vacío, limpiarlo completamente
    if (!value.trim()) {
      input.value = '';
      this.compraForm.patchValue({ monto: null });
      return;
    }
    
    // Remover todos los caracteres no numéricos
    value = value.replace(/[^\d]/g, '');
    
    // Si no hay valor, limpiar completamente
    if (!value) {
      input.value = '';
      this.compraForm.patchValue({ monto: null });
      return;
    }
    
    // Formatear el número correctamente - FORMATO ESPAÑOL
    let formateado = '';
    
    if (value.length === 1) {
      formateado = '0,0' + value;
    } else if (value.length === 2) {
      formateado = '0,' + value;
    } else {
      const parteEntera = value.slice(0, -2);
      const parteDecimal = value.slice(-2);
      
      // Formatear parte entera con separadores de miles (puntos)
      let parteEnteraFormateada = parteEntera;
      if (parteEntera.length > 3) {
        let result = '';
        for (let i = 0; i < parteEntera.length; i++) {
          if (i > 0 && (parteEntera.length - i) % 3 === 0) {
            result += '.';
          }
          result += parteEntera[i];
        }
        parteEnteraFormateada = result;
      }
      
      // Construir el formato final: parteEntera,parteDecimal
      formateado = parteEnteraFormateada + ',' + parteDecimal;
    }
    
    // Actualizar el input directamente para asegurar que se vea el formato
    input.value = formateado;
    
    // Actualizar el FormControl con el valor numérico (para el backend)
    // Convertir de formato español a número decimal
    const monto = parseFloat(value) / 100;
    this.compraForm.patchValue({ monto: monto });
  }


  // Método de verificación de borrado reemplazado por la directive appCurrencyMask

  formatearFecha(fecha: string | null | undefined): string {
    if (!fecha) {
      return 'No definida';
    }
    
    try {
    const date = new Date(fecha);
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      
    const dia = date.getDate().toString().padStart(2, '0');
    const mes = (date.getMonth() + 1).toString().padStart(2, '0');
    const año = date.getFullYear();
    return `${dia}/${mes}/${año}`;
    } catch (error) {
      return 'Fecha inválida';
    }
  }

  loadProveedores(): void {
    this.proveedoresService.getProveedores().subscribe({
      next: (proveedores) => {
        this.proveedoresList = proveedores;
      },
      error: (error) => {
        console.error('Error al cargar los proveedores:', error);
        this.error = 'Error al cargar los proveedores. Por favor, intente nuevamente.';
      }
    });
  }

  // loadServiciosGarantia(): void {
  //   this.serviciosGarantiaService.getServiciosGarantia().subscribe({
  //     next: (servicios) => {
  //       this.serviciosGarantiaList = servicios;
  //     },
  //     error: (error) => {
  //       console.error('Error al cargar los servicios de garantía:', error);
  //       this.error = 'Error al cargar los servicios de garantía. Por favor, intente nuevamente.';
  //     }
  //   });
  // }

  get numeroCompraControl(): FormControl {
    return this.filterForm.get('numeroCompra') as FormControl;
  }

  canManagePurchases(): boolean {
    return this.permissionsService.canManagePurchases();
  }

  getMonedaCount(moneda: string): number {
    return this.comprasList.filter(compra => compra.moneda === moneda).length;
  }

  getTipoCompraCount(idTipoCompra: number): number {
    return this.comprasList.filter(compra => compra.idTipoCompra === idTipoCompra).length;
  }

  filtrarPorTipoCompra(idTipoCompra: number | null): void {
    this.tipoCompraFiltroActivo = idTipoCompra;
    
    if (idTipoCompra === null) {
      // Mostrar todas las compras
      this.comprasFiltradas = [...this.comprasList];
    } else {
      // Filtrar por tipo de compra específico
      this.comprasFiltradas = this.comprasList.filter(compra => compra.idTipoCompra === idTipoCompra);
    }
    this.collectionSize = this.comprasFiltradas.length;
    this.page = 1; // Resetear a la primera página
  }

  getTipoColor(index: number): string {
    const colors = [
      '#0369a1', // Azul
      '#92400e', // Naranja
      '#00695c', // Verde
      '#7b1fa2', // Púrpura
      '#d32f2f', // Rojo
      '#388e3c', // Verde oscuro
      '#f57c00', // Naranja oscuro
      '#6a1b9a', // Púrpura oscuro
      '#2e7d32', // Verde
      '#c62828'  // Rojo oscuro
    ];
    return colors[index % colors.length];
  }

  getTipoBgColor(index: number): string {
    const bgColors = [
      '#e0f2fe', // Azul claro
      '#fef3c7', // Naranja claro
      '#e0f7fa', // Verde claro
      '#f3e5f5', // Púrpura claro
      '#ffebee', // Rojo claro
      '#e8f5e9', // Verde oscuro claro
      '#fff3e0', // Naranja oscuro claro
      '#f3e5f5', // Púrpura oscuro claro
      '#e8f6f3', // Verde claro
      '#ffebee'  // Rojo oscuro claro
    ];
    return bgColors[index % bgColors.length];
  }

  getTipoBorderColor(index: number): string {
    const borderColors = [
      '#bae6fd', // Azul
      '#fde68a', // Naranja
      '#b2ebf2', // Verde
      '#e1bee7', // Púrpura
      '#ffcdd2', // Rojo
      '#c8e6c9', // Verde oscuro
      '#ffe0b2', // Naranja oscuro
      '#e1bee7', // Púrpura oscuro
      '#c8e6c9', // Verde
      '#ffcdd2'  // Rojo oscuro
    ];
    return borderColors[index % borderColors.length];
  }

  verDetallesCompra(compra: CompraConTipo): void {
    this.compraSeleccionada = compra;
    
    // Asegurar que los proveedores estén cargados
    if (this.proveedoresList.length === 0) {
      this.loadProveedores();
    }
    
    // Cargar lotes de la compra
    this.lotesService.getLotesByCompra(compra.idCompra).subscribe({
      next: (lotes) => {
        this.lotesDetalles = lotes;
        
        // Solo cargar entregas si hay lotes
        if (lotes.length > 0) {
        const entregasObservables = lotes.map(lote => 
          this.entregasService.getEntregasByItem(lote.idItem).toPromise()
        );
        
        Promise.all(entregasObservables).then(entregasPorLote => {
          this.entregasDetalles = entregasPorLote.flat().filter(e => !!e);
          this.cdr.detectChanges();
        });
        } else {
          this.entregasDetalles = [];
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error al cargar los detalles de la compra:', error);
        this.lotesDetalles = [];
        this.entregasDetalles = [];
        this.cdr.detectChanges();
      }
    });
    
    // Cargar documentos de la compra
    this.cargarDocumentosCompra(compra.idCompra);
    
    
    // Abrir el modal de detalles
    this.modalService.open(this.detallesModal, { 
      size: 'xl', 
      backdrop: false,  // Deshabilitar el backdrop
      keyboard: false,
      centered: true
    });
  }

  getProveedorNombre(idProveedor: number | null): string {
    // Solo verificar si es null o 0 (que es falsy)
    if (!idProveedor) {
      return 'Sin especificar';
    }
    
    // Buscar en la lista local en lugar de hacer llamada HTTP
    const proveedor = this.proveedoresList.find(p => p.idProveedores === idProveedor);
    return proveedor ? proveedor.nombreComercial : 'No disponible';
  }

  getServicioGarantiaNombre(idServicio: number | null): string {
    // Solo verificar si es null o 0 (que es falsy)
    if (!idServicio) {
      return 'Sin especificar';
    }
    
    // Buscar en la lista local en lugar de hacer llamada HTTP
    const proveedor = this.proveedoresList.find(p => p.idProveedores === idServicio);
    return proveedor ? proveedor.nombreComercial : 'No disponible';
  }

  getLoteNombre(idItem: number): string {
    const lote = this.lotesDetalles.find(l => l.idItem === idItem);
    return lote ? lote.nombreItem : 'No disponible';
  }

  toggleCompactView(): void {
    this.isCompactView = !this.isCompactView;
  }

  // Métodos para búsqueda en dropdowns
  filtrarProveedores(event: any, index: number): void {
    const searchTerm = event.target.value.toLowerCase();
    this.proveedorSearchValues[index] = searchTerm;
    
    if (!searchTerm) {
      this.proveedoresFiltrados[index] = [...this.proveedoresList];
    } else {
      this.proveedoresFiltrados[index] = this.proveedoresList.filter(proveedor =>
        proveedor.nombreComercial.toLowerCase().includes(searchTerm) ||
        proveedor.nombre.toLowerCase().includes(searchTerm)
      );
    }
  }

  // filtrarServiciosGarantia(event: any, index: number): void {
  //   const searchTerm = event.target.value.toLowerCase();
  //   this.servicioGarantiaSearchValues[index] = searchTerm;
  //   
  //   if (!searchTerm) {
  //     this.serviciosGarantiaFiltrados[index] = [...this.serviciosGarantiaList];
  //   } else {
  //     this.serviciosGarantiaFiltrados[index] = this.serviciosGarantiaList.filter(servicio =>
  //       servicio.nombreComercial.toLowerCase().includes(searchTerm) ||
  //       servicio.nombre.toLowerCase().includes(searchTerm)
  //     );
  //   }
  // }

  getProveedoresFiltrados(index: number): ProveedorDTO[] {
    if (!this.proveedoresFiltrados[index]) {
      this.proveedoresFiltrados[index] = [...this.proveedoresList];
    }
    return this.proveedoresFiltrados[index];
  }

  // getServiciosGarantiaFiltrados(index: number): ServicioGarantiaDTO[] {
  //   if (!this.serviciosGarantiaFiltrados[index]) {
  //     this.serviciosGarantiaFiltrados[index] = [...this.serviciosGarantiaList];
  //   }
  //   return this.serviciosGarantiaFiltrados[index];
  // }

  getProveedorSearchValue(index: number): string {
    return this.proveedorSearchValues[index] || '';
  }

  // getServicioGarantiaSearchValue(index: number): string {
  //   return this.servicioGarantiaSearchValues[index] || '';
  // }

  // Métodos para manejar dropdowns integrados
  mostrarDropdownProveedores(index: number): void {
    this.dropdownProveedoresVisible[index] = true;
    this.proveedoresFiltrados[index] = [...this.proveedoresList];
  }

  ocultarDropdownProveedores(index: number): void {
    setTimeout(() => {
      this.dropdownProveedoresVisible[index] = false;
    }, 200);
  }

  // mostrarDropdownServiciosGarantia(index: number): void {
  //   this.dropdownServiciosGarantiaVisible[index] = true;
  //   this.serviciosGarantiaFiltrados[index] = [...this.serviciosGarantiaList];
  // }

  ocultarDropdownServiciosGarantia(index: number): void {
    setTimeout(() => {
      this.dropdownServiciosGarantiaVisible[index] = false;
    }, 200);
  }

  isDropdownProveedoresVisible(index: number): boolean {
    return this.dropdownProveedoresVisible[index] || false;
  }

  isDropdownServiciosGarantiaVisible(index: number): boolean {
    return this.dropdownServiciosGarantiaVisible[index] || false;
  }

  seleccionarProveedor(proveedor: ProveedorDTO, index: number): void {
    const itemControl = this.itemsFormArray.at(index);
    itemControl.patchValue({
      idProveedor: proveedor.idProveedores
    });
    this.proveedorSearchValues[index] = proveedor.nombreComercial;
    this.dropdownProveedoresVisible[index] = false;
  }

  seleccionarProveedorGarantia(proveedor: ProveedorDTO, index: number): void {
    const itemControl = this.itemsFormArray.at(index);
    itemControl.patchValue({
      idServicioGarantia: proveedor.idProveedores
    });
    this.proveedorGarantiaSearchValues[index] = proveedor.nombreComercial;
    this.dropdownProveedoresGarantiaVisible[index] = false;
  }

  getProveedorDisplayValue(index: number): string {
    const itemControl = this.itemsFormArray.at(index);
    const idProveedor = itemControl.get('idProveedor')?.value;
    if (idProveedor) {
      const proveedor = this.proveedoresList.find(p => p.idProveedores === idProveedor);
      return proveedor ? proveedor.nombreComercial : '';
    }
    return this.proveedorSearchValues[index] || '';
  }

  getProveedorGarantiaDisplayValue(index: number): string {
    const itemControl = this.itemsFormArray.at(index);
    const idServicioGarantia = itemControl.get('idServicioGarantia')?.value;
    if (idServicioGarantia) {
      const proveedor = this.proveedoresList.find(p => p.idProveedores === idServicioGarantia);
      return proveedor ? proveedor.nombreComercial : '';
    }
    return this.servicioGarantiaSearchValues[index] || '';
  }

  // Métodos para documentos
  cargarDocumentosCompra(idCompra: number): void {
    this.remitosService.getRemitosByCompra(idCompra).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.documentosCompra = response.data;
        } else {
          this.documentosCompra = [];
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al cargar documentos:', error);
        this.documentosCompra = [];
      }
    });
  }

  // Método onArchivoSeleccionado reemplazado por onDocumentoSeleccionado

  subirDocumento(): void {
    // Obtener idCompra del formulario si no hay compraSeleccionada
    const idCompra = this.compraSeleccionada?.idCompra || this.compraForm.get('idCompra')?.value;
    
    console.log('Datos para subir documento:', {
      documentoSeleccionado: this.documentoSeleccionado,
      tipoDocumentoSeleccionado: this.tipoDocumentoSeleccionado,
      idCompra: idCompra,
      compraSeleccionada: this.compraSeleccionada
    });
    
    if (!this.documentoSeleccionado) {
      this.error = 'Debe seleccionar un archivo';
      return;
    }
    
    if (!idCompra) {
      this.error = 'No se puede identificar la compra';
      return;
    }

    if (!this.descripcionDocumento || this.descripcionDocumento.trim().length === 0) {
      this.error = 'Debe agregar una descripción para el documento';
      return;
    }

    this.subiendoDocumento = true;
    this.error = null;

    // Solo subir como documento
    this.remitosService.subirRemito(
      idCompra, 
      this.documentoSeleccionado, 
      this.descripcionDocumento || undefined
    ).subscribe({
      next: (response) => {
        if (response.success) {
          // Limpiar formulario
          this.documentoSeleccionado = null;
          this.descripcionDocumento = '';
          this.tipoDocumentoSeleccionado = null;
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (fileInput) fileInput.value = '';
          
          // Recargar documentos
          this.cargarDocumentosCompra(idCompra);
          
          this.subiendoDocumento = false;
        } else {
          this.error = response.message || 'Error al subir documento';
          this.subiendoDocumento = false;
        }
      },
      error: (error) => {
        console.error('Error al subir documento:', error);
        this.error = 'Error al subir documento';
        this.subiendoDocumento = false;
      }
    });
  }



  formatearTamanoArchivo(bytes: number): string {
    return this.remitosService.formatearTamaño(bytes);
  }

  getIconoArchivo(tipoArchivo: string): string {
    return this.remitosService.getIconoArchivo(tipoArchivo);
  }

  esTipoImagen(tipoArchivo: string): boolean {
    return this.remitosService.esTipoImagen(tipoArchivo);
  }



  

  // Método para exportar a PDF
  exportarAPDF(): void {
    try {
      // Deshabilitar el botón durante la exportación
      const exportButton = document.querySelector('.export-pdf-btn') as HTMLButtonElement;
      if (exportButton) {
        exportButton.disabled = true;
        exportButton.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i><span>Generando PDF...</span>';
      }

      // Verificar que tenemos la compra seleccionada
      if (!this.compraSeleccionada) {
        this.error = 'No hay compra seleccionada para exportar';
        return;
      }

      // Generar y descargar el PDF
      this.generarPDF();

      // Restaurar el botón
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.innerHTML = '<i class="fas fa-file-pdf me-1"></i><span>Exportar PDF</span>';
      }

    } catch (error) {
      console.error('Error al exportar PDF:', error);
      this.error = 'Error al generar el PDF. Por favor, intente nuevamente.';
      
      // Restaurar el botón en caso de error
      const exportButton = document.querySelector('.export-pdf-btn') as HTMLButtonElement;
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.innerHTML = '<i class="fas fa-file-pdf me-1"></i><span>Exportar PDF</span>';
      }
    }
  }

  private generarPDF(): void {
    if (!this.compraSeleccionada) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const compra = this.compraSeleccionada;
    const nombreCompra = this.getNombreCompraFormateado(compra);
    const montoFormateado = this.formatearMoneda(compra.monto || 0, compra.moneda || 'USD');
    const fechaInicio = this.formatearFecha(compra.fechaInicio || '');
    const fechaFinal = this.formatearFecha(compra.fechaFinal || '');
    const tipoCompra = this.getTipoCompraDescripcion(compra.idTipoCompra || 0);

    let y = 20;
    const margin = 14;
    const pageHeight = 277; // Altura útil A4

    // Título principal
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(nombreCompra, margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(compra.descripcion || '', margin, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.text(`${compra.moneda || 'USD'} ${montoFormateado}`, margin, y);
    y += 12;

    // Información de la compra (tabla simple)
    autoTable(doc, {
      head: [['Campo', 'Valor']],
      body: [
        ['Tipo de Compra', tipoCompra],
        ['Número', compra.numeroCompra || 'No disponible'],
        ['Año', String(compra.ano || 'No disponible')],
        ['Fecha Apertura', fechaInicio],
        ['Fecha Adjudicación', fechaFinal]
      ],
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [65, 161, 175], textColor: 255 },
      columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
      theme: 'grid'
    });
    y = (doc as any).lastAutoTable.finalY + 12;

    // Tabla de ítems
    if (this.lotesDetalles.length > 0) {
      if (y > pageHeight - 60) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Ítems de la Compra (${this.lotesDetalles.length})`, margin, y);
      y += 8;

      const itemsBody = this.lotesDetalles.map(lote => [
        lote.nombreItem || '',
        String(lote.cantidad),
        `${lote.mesesGarantia} meses`,
        this.getProveedorNombre(lote.idProveedor),
        this.getServicioGarantiaNombre(lote.idServicioGarantia),
        (lote.descripcion || '-').substring(0, 30)
      ]);

      autoTable(doc, {
        head: [['Ítem', 'Cant.', 'Garantía', 'Proveedor', 'Servicio', 'Obs.']],
        body: itemsBody,
        startY: y,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [108, 117, 125], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        theme: 'striped',
        tableWidth: 'auto'
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }

    // Tabla de entregas
    if (this.entregasDetalles.length > 0) {
      if (y > pageHeight - 60) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Entregas (${this.entregasDetalles.length})`, margin, y);
      y += 8;

      const entregasBody = this.entregasDetalles.map(e => [
        this.getLoteNombre(e.idItem),
        String(e.cantidad),
        this.formatearFecha(e.fechaPedido),
        this.formatearFecha(e.fechaFinGarantia),
        (e.descripcion || '-').substring(0, 25)
      ]);

      autoTable(doc, {
        head: [['Ítem', 'Cant.', 'Fecha Entrega', 'Fin Garantía', 'Obs.']],
        body: entregasBody,
        startY: y,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [108, 117, 125], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        theme: 'striped',
        tableWidth: 'auto'
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }

    // Tabla de documentos
    if (this.documentosCompra.length > 0) {
      if (y > pageHeight - 60) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Documentos de Entrega (${this.documentosCompra.length})`, margin, y);
      y += 8;

      const docsBody = this.documentosCompra.map(d => [
        (d.nombreArchivoOriginal || '').substring(0, 35),
        this.formatearTamanoArchivo(d.tamanoArchivo),
        this.formatearFecha(d.fechaCreacion),
        (d.descripcion || '-').substring(0, 30)
      ]);

      autoTable(doc, {
        head: [['Archivo', 'Tamaño', 'Fecha', 'Descripción']],
        body: docsBody,
        startY: y,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [108, 117, 125], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        theme: 'striped',
        tableWidth: 'auto'
      });
    }

    // Pie de página en la última página
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Documento generado el ${new Date().toLocaleDateString('es-ES')} - Sistema Cerbero - Página ${i} de ${totalPages}`,
        doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    const fileName = `compra_${compra.numeroCompra || 'detalles'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    this.error = null;
  }

  // Métodos separados para el dropdown del servicio de garantía
  filtrarProveedoresGarantia(event: any, index: number): void {
    const searchTerm = event.target.value.toLowerCase();
    this.proveedorGarantiaSearchValues[index] = searchTerm;
    
    if (!searchTerm) {
      this.proveedoresGarantiaFiltrados[index] = [...this.proveedoresList];
    } else {
      this.proveedoresGarantiaFiltrados[index] = this.proveedoresList.filter(proveedor =>
        proveedor.nombreComercial.toLowerCase().includes(searchTerm) ||
        proveedor.nombre.toLowerCase().includes(searchTerm)
      );
    }
  }

  getProveedoresGarantiaFiltrados(index: number): ProveedorDTO[] {
    if (!this.proveedoresGarantiaFiltrados[index]) {
      this.proveedoresGarantiaFiltrados[index] = [...this.proveedoresList];
    }
    return this.proveedoresGarantiaFiltrados[index];
  }

  mostrarDropdownProveedoresGarantia(index: number): void {
    this.dropdownProveedoresGarantiaVisible[index] = true;
    this.proveedoresGarantiaFiltrados[index] = [...this.proveedoresList];
  }

  ocultarDropdownProveedoresGarantia(index: number): void {
    setTimeout(() => {
      this.dropdownProveedoresGarantiaVisible[index] = false;
    }, 200);
  }

  isDropdownProveedoresGarantiaVisible(index: number): boolean {
    return this.dropdownProveedoresGarantiaVisible[index] || false;
  }

  // Métodos para documentos unificados
  agregarDocumento(): void {
    this.tipoDocumentoSeleccionado = 'documento';
    this.documentoSeleccionado = null;
    this.descripcionDocumento = '';
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    
    this.error = null;
  }

  onDocumentoSeleccionado(event: any): void {
    const archivo = event.target.files[0];
    
    if (archivo) {
      const validacion = this.remitosService.validarArchivo(archivo);
      
      if (validacion.valido) {
        this.documentoSeleccionado = archivo;
        this.error = null;
      } else {
        this.error = validacion.mensaje;
        this.documentoSeleccionado = null;
        event.target.value = '';
      }
    } else {
      this.documentoSeleccionado = null;
    }
  }

  

  limpiarFormularioDocumento(): void {
    this.documentoSeleccionado = null;
    this.descripcionDocumento = '';
    this.tipoDocumentoSeleccionado = null;
    this.error = null;
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  visualizarDocumento(documento: any): void {
    this.remitosService.visualizarRemito(documento.idRemito);
  }

  descargarDocumento(documento: any): void {
    this.remitosService.descargarRemito(documento.idRemito);
  }

  eliminarDocumento(documento: any): void {
    if (confirm('¿Está seguro que desea eliminar este documento?')) {
      const idCompra = this.compraSeleccionada?.idCompra || this.compraForm.get('idCompra')?.value;
      
      this.remitosService.eliminarRemito(documento.idRemito).subscribe({
        next: (response) => {
          if (response.success && idCompra) {
            this.cargarDocumentosCompra(idCompra);
          } else {
            this.error = response.message || 'Error al eliminar documento';
          }
        },
        error: (error) => {
          console.error('Error al eliminar documento:', error);
          this.error = 'Error al eliminar documento';
        }
      });
    }
  }

  // Nuevo método para calcular el monto total
  calcularMontoTotal(): number {
    let montoTotal = 0;
    const valorDolar = this.compraForm.get('valorDolar')?.value;
    
    if (!valorDolar || valorDolar <= 0) {
      return 0;
    }
    
    this.itemsFormArray.controls.forEach(control => {
      const precioUnitario = control.get('precioUnitario')?.value;
      const cantidad = control.get('cantidad')?.value;
      const monedaPrecio = control.get('monedaPrecio')?.value;
      
      // Solo calcular si tiene todos los datos necesarios
      if (precioUnitario && cantidad && monedaPrecio && precioUnitario > 0) {
        let precioEnDolares = precioUnitario;
        
        // Si el precio está en pesos, convertir a dólares
        if (monedaPrecio === 'UYU') {
          precioEnDolares = precioUnitario / valorDolar;
        }
        
        montoTotal += precioEnDolares * cantidad;
      }
    });
    
    return montoTotal;
  }

  // Método para actualizar el monto total cuando cambian los ítems
  actualizarMontoTotal(): void {
    // Forzar la detección de cambios para recalcular todos los valores
    this.cdr.detectChanges();
    
    const montoTotalConIva = this.calcularMontoTotalConIva();
    this.compraForm.patchValue({ monto: montoTotalConIva });
  }

  // Método para obtener el monto total convertido según la moneda seleccionada
  getMontoTotalConvertido(): number {
    const montoTotalConIva = this.calcularMontoTotalConIva();
    const moneda = this.compraForm.get('moneda')?.value;
    const valorDolar = this.compraForm.get('valorDolar')?.value;
    
    if (!moneda || !valorDolar) {
      return montoTotalConIva;
    }
    
    // Si la moneda es UYU, convertir de dólares a pesos
    if (moneda === 'UYU') {
      return montoTotalConIva * valorDolar;
    }
    
    // Si la moneda es USD, devolver en dólares
    return montoTotalConIva;
  }

  // Método para obtener el subtotal convertido según la moneda seleccionada
  getSubtotalConvertido(): number {
    const subtotalTotal = this.calcularSubtotalTotal();
    const moneda = this.compraForm.get('moneda')?.value;
    const valorDolar = this.compraForm.get('valorDolar')?.value;
    
    if (!moneda || !valorDolar) {
      return subtotalTotal;
    }
    
    // Si la moneda es UYU, convertir de dólares a pesos
    if (moneda === 'UYU') {
      return subtotalTotal * valorDolar;
    }
    
    // Si la moneda es USD, devolver en dólares
    return subtotalTotal;
  }

  // Método para obtener el IVA convertido según la moneda seleccionada
  getIvaConvertido(): number {
    const ivaTotal = this.calcularIvaTotal();
    const moneda = this.compraForm.get('moneda')?.value;
    const valorDolar = this.compraForm.get('valorDolar')?.value;
    
    if (!moneda || !valorDolar) {
      return ivaTotal;
    }
    
    // Si la moneda es UYU, convertir de dólares a pesos
    if (moneda === 'UYU') {
      return ivaTotal * valorDolar;
    }
    
    // Si la moneda es USD, devolver en dólares
    return ivaTotal;
  }

  // Método para calcular el subtotal de un ítem específico
  getItemSubtotal(index: number): number {
    const control = this.itemsFormArray.at(index);
    const precioUnitario = control.get('precioUnitario')?.value;
    const cantidad = control.get('cantidad')?.value;
    const monedaPrecio = control.get('monedaPrecio')?.value;
    const valorDolar = this.compraForm.get('valorDolar')?.value;
    
    if (!precioUnitario || !cantidad || !monedaPrecio || !valorDolar) {
      return 0;
    }
    
    let precioEnDolares = precioUnitario;
    
    // Si el precio está en pesos, convertir a dólares
    if (monedaPrecio === 'UYU') {
      precioEnDolares = precioUnitario / valorDolar;
    }
    
    return precioEnDolares * cantidad;
  }

  // Método para formatear moneda con símbolo
  formatearMonedaConSimbolo(monto: number, moneda: string): string {
    if (monto === null || monto === undefined || monto === 0) {
      return 'No definido';
    }
    
    const simbolo = moneda === 'USD' ? '$' : '$U';
    return `${simbolo} ${new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto)}`;
  }

  // Agregar un método para obtener el subtotal en pesos
  getItemSubtotalEnPesos(index: number): number {
    const control = this.itemsFormArray.at(index);
    const precioUnitario = control.get('precioUnitario')?.value;
    const cantidad = control.get('cantidad')?.value;
    const monedaPrecio = control.get('monedaPrecio')?.value;
    const valorDolar = this.compraForm.get('valorDolar')?.value;
    
    if (!precioUnitario || !cantidad || !monedaPrecio || !valorDolar) {
      return 0;
    }
    
    // Si el precio está en pesos, el subtotal en pesos es precio * cantidad
    if (monedaPrecio === 'UYU') {
      return precioUnitario * cantidad;
    }
    
    // Si el precio está en dólares, convertir a pesos
    return precioUnitario * cantidad * valorDolar;
  }

  // Métodos para cálculos de IVA
  getItemPorcentajeIva(index: number): number {
    const control = this.itemsFormArray.at(index);
    return control.get('porcentajeIva')?.value || 22.00;
  }

  getItemMontoIva(index: number): number {
    const subtotal = this.getItemSubtotal(index);
    const porcentajeIva = this.getItemPorcentajeIva(index);
    return subtotal * (porcentajeIva / 100);
  }

  getItemTotal(index: number): number {
    const subtotal = this.getItemSubtotal(index);
    const montoIva = this.getItemMontoIva(index);
    return subtotal + montoIva;
  }

  getItemMontoIvaEnPesos(index: number): number {
    const subtotalEnPesos = this.getItemSubtotalEnPesos(index);
    const porcentajeIva = this.getItemPorcentajeIva(index);
    return subtotalEnPesos * (porcentajeIva / 100);
  }

  getItemTotalEnPesos(index: number): number {
    const subtotalEnPesos = this.getItemSubtotalEnPesos(index);
    const montoIvaEnPesos = this.getItemMontoIvaEnPesos(index);
    return subtotalEnPesos + montoIvaEnPesos;
  }

  // Métodos para totales de la compra
  calcularSubtotalTotal(): number {
    let total = 0;
    for (let i = 0; i < this.itemsFormArray.length; i++) {
      total += this.getItemSubtotal(i);
    }
    return total;
  }

  calcularIvaTotal(): number {
    let total = 0;
    for (let i = 0; i < this.itemsFormArray.length; i++) {
      total += this.getItemMontoIva(i);
    }
    return total;
  }

  calcularMontoTotalConIva(): number {
    return this.calcularSubtotalTotal() + this.calcularIvaTotal();
  }

  // Método para calcular totales de una compra específica usando sus lotes
  calcularTotalesCompra(compra: CompraConTipo, lotes: LoteDTO[]): { subtotal: number, iva: number, total: number } {
    let subtotal = 0;
    let iva = 0;
    const valorDolar = compra.valorDolar || 1;
    
    lotes.forEach(lote => {
      if (lote.precioUnitario && lote.cantidad) {
        let precioEnDolares = lote.precioUnitario;
        
        // Si el precio está en pesos, convertir a dólares
        if (lote.monedaPrecio === 'UYU') {
          precioEnDolares = lote.precioUnitario / valorDolar;
        }
        
        const subtotalItem = precioEnDolares * lote.cantidad;
        const porcentajeIva = lote.porcentajeIva || 22.00;
        const ivaItem = subtotalItem * (porcentajeIva / 100);
        
        subtotal += subtotalItem;
        iva += ivaItem;
      }
    });
    
    const total = subtotal + iva;
    
    // Convertir según la moneda de la compra
    if (compra.moneda === 'UYU') {
      return {
        subtotal: subtotal * valorDolar,
        iva: iva * valorDolar,
        total: total * valorDolar
      };
    }
    
    return { subtotal, iva, total };
  }

  // Método para obtener el monto total de una compra (para lista y detalles)
  getMontoTotalCompra(compra: CompraConTipo, lotes: LoteDTO[]): number {
    const totales = this.calcularTotalesCompra(compra, lotes);
    return totales.total;
  }

  // Método para obtener el subtotal de una compra (para lista y detalles)
  getSubtotalCompra(compra: CompraConTipo, lotes: LoteDTO[]): number {
    const totales = this.calcularTotalesCompra(compra, lotes);
    return totales.subtotal;
  }

  // Método para obtener el IVA de una compra (para lista y detalles)
  getIvaCompra(compra: CompraConTipo, lotes: LoteDTO[]): number {
    const totales = this.calcularTotalesCompra(compra, lotes);
    return totales.iva;
  }

  // Métodos para modo edición - calcular subtotal e IVA a partir del monto total
  calcularSubtotalDesdeMontoTotal(): number {
    const montoTotal = this.compraForm.get('monto')?.value;
    if (!montoTotal || montoTotal <= 0) {
      return 0;
    }
    // Asumiendo IVA del 22%: montoTotal = subtotal * 1.22
    return montoTotal / 1.22;
  }

  calcularIvaDesdeMontoTotal(): number {
    const montoTotal = this.compraForm.get('monto')?.value;
    if (!montoTotal || montoTotal <= 0) {
      return 0;
    }
    const subtotal = this.calcularSubtotalDesdeMontoTotal();
    return montoTotal - subtotal;
  }

  private elegirCompraParaTour(): CompraConTipo | null {
    if (this.comprasFiltradas.length > 0) {
      return this.comprasFiltradas[0];
    }
    if (this.comprasList.length > 0) {
      return this.comprasList[0];
    }
    return null;
  }

  private esperarSelectores(
    selectores: string[],
    timeoutMs: number = 2500,
    intervalMs: number = 60
  ): Promise<string[]> {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const presentes = selectores.filter((sel) => document.querySelector(sel));
        if (presentes.length === selectores.length || Date.now() - start >= timeoutMs) {
          resolve(presentes);
          return;
        }
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  private buildModalSteps(pasos: GuidedTourStepDef[]): DriveStep[] {
    return pasos
      .filter((p) => !!document.querySelector(p.selector))
      .map((p) => ({
        element: p.selector,
        popover: {
          title: p.title,
          description: p.description,
          side: (p.side ?? 'bottom') as 'top' | 'bottom' | 'left' | 'right',
          align: 'start'
        }
      }));
  }

  private runTourVerCompra(): void {
    this.tourCompra?.destroy();
    this.tourCompra = undefined;
    this.modalService.dismissAll();

    const compra = this.elegirCompraParaTour();
    if (!compra) {
      this.error = 'Necesitás al menos una compra cargada para ver este tour.';
      this.cdr.detectChanges();
      return;
    }

    this.isCompactView = false;
    this.verDetallesCompra(compra);

    const pasos: GuidedTourStepDef[] = [
      {
        selector: '#tour-compras-detalles-header',
        title: 'Detalle de la compra',
        description:
          'Abrís el detalle con el ícono de <strong>ojo</strong> en la fila de cada compra. Acá tenés todo en modo lectura: datos generales, ítems, entregas y documentos.',
        side: 'bottom'
      },
      {
        selector: '#tour-compras-detalles-toggle',
        title: 'Vista compacta / detallada',
        description:
          '<strong>Detallada</strong> muestra todas las secciones expandidas (ideal para revisar a fondo). <strong>Compacta</strong> resume la información para ver más datos sin scroll.',
        side: 'bottom'
      },
      {
        selector: '#tour-compras-detalles-pdf',
        title: 'Exportar a PDF',
        description:
          'Genera un PDF con el detalle completo de la compra (datos, ítems, entregas y documentos). Sirve para enviar a proveedores o archivar.',
        side: 'bottom'
      },
      {
        selector: '#tour-compras-detalles-main-info',
        title: 'Resumen principal',
        description:
          'Nombre de la compra, descripción, moneda y <strong>monto total</strong>. Si hay ítems cargados, también ves el desglose de <strong>subtotal e IVA</strong>.',
        side: 'top'
      },
      {
        selector: '#tour-compras-detalles-info-compra',
        title: 'Información de la compra',
        description:
          'Tipo de compra, número, año y fechas de <strong>apertura</strong> y <strong>adjudicación</strong>. Estos campos identifican unívocamente la compra dentro del sistema.',
        side: 'top'
      },
      {
        selector: '#tour-compras-detalles-items',
        title: 'Ítems de la compra',
        description:
          'Listado de ítems (lotes) con cantidad, precio unitario, moneda, meses de garantía, proveedor y servicio de garantía. Cada ítem se cuenta como una línea del PDF.',
        side: 'top'
      },
      {
        selector: '#tour-compras-detalles-entregas',
        title: 'Entregas',
        description:
          'Recorrido de las entregas asociadas a los ítems: cuántas unidades, fecha de entrega y fecha de fin de garantía. Si todavía no hay entregas, esta sección queda vacía.',
        side: 'top'
      },
      {
        selector: '#tour-compras-detalles-documentos',
        title: 'Documentos adjuntos',
        description:
          'Acá ves los documentos cargados (remitos, facturas, contratos, etc.). Desde cada uno podés <strong>visualizarlo</strong> o <strong>descargarlo</strong>.',
        side: 'top'
      }
    ];

    setTimeout(() => {
      const modalSteps = this.buildModalSteps(pasos);
      if (modalSteps.length === 0) {
        this.modalService.dismissAll();
        return;
      }
      const inst = this.guidedTourHost.startTour(modalSteps, () => {
        this.modalService.dismissAll();
      });
      if (inst) {
        this.tourCompra = inst;
      }
    }, 320);
  }

  /**
   * Tour de creación de compra completo. Abre el modal con una compra DEMO en memoria
   * (sin tocar backend) y recorre las 4 pestañas, cambiando de pestaña dinámicamente
   * entre pasos mediante `onDeselected` del paso previo.
   */
  private runTourCrearCompra(): void {
    this.tourCompra?.destroy();
    this.tourCompra = undefined;
    this.modalService.dismissAll();

    if (!this.canManagePurchases()) {
      return;
    }

    if (this.tiposCompraList.length === 0) {
      this.error = 'No hay tipos de compra cargados para mostrar el tour.';
      this.cdr.detectChanges();
      return;
    }

    this.prepararCompraDemo();
    this.tourDemoModalRef = this.modalService.open(this.compraModalTpl, {
      size: 'xl',
      backdrop: 'static',
      windowClass: 'compra-form-modal-window'
    });
    this.tourDemoModalRef.result.then(
      () => this.finalizarTourDemo(),
      () => this.finalizarTourDemo()
    );

    const pasos: DemoStepDef[] = [
      // ---------- PESTAÑA 1: DATOS ----------
      { tab: '1', selector: '#tour-compras-edit-header', title: 'Crear compra (DEMO)',
        description: 'Acá creás una compra desde cero. El header naranja indica que estás en <strong>modo DEMO</strong>: el botón Guardar está bloqueado para que puedas explorar sin riesgo.', side: 'bottom' },
      { tab: '1', selector: '#tour-compras-edit-tabs', title: 'Las 4 pestañas',
        description: 'El formulario se divide en <strong>Datos</strong>, <strong>Ítems</strong>, <strong>Entregas</strong> y <strong>Documentos</strong>. Las vamos a recorrer una por una.', side: 'bottom' },
      { tab: '1', selector: '#tour-compras-edit-row-identidad', title: 'Tipo, Número y Año',
        description: '<strong>Tipo de compra</strong> (licitación, compra directa, etc.), <strong>número</strong> identificador y <strong>año</strong>. Los tres son obligatorios y permiten ubicar la compra rápidamente.', side: 'top' },
      { tab: '1', selector: '#tour-compras-edit-row-monetario', title: 'Valor dólar, moneda y monto',
        description: 'El <strong>valor del dólar</strong> es obligatorio: lo usamos para convertir entre USD y UYU cuando un ítem está en una moneda distinta. El <strong>monto total</strong> se calcula automáticamente sumando ítems + IVA.', side: 'top' },
      { tab: '1', selector: '#tour-compras-edit-row-nombre', title: 'Nombre de la compra',
        description: 'Texto libre que aparece en la tabla y en el PDF. Conviene un nombre descriptivo (por ejemplo "Compra de impresoras Q2").', side: 'top' },
      { tab: '1', selector: '#tour-compras-edit-row-fechas', title: 'Fechas de apertura y adjudicación',
        description: 'Marcadores del ciclo de la compra: <strong>apertura</strong> (cuando empezó el proceso) y <strong>adjudicación</strong> (cuando se decidió a quién comprarle).', side: 'top' },

      // ---------- PESTAÑA 2: ÍTEMS ----------
      { tab: '2', selector: '#tour-compras-edit-tab-items', title: 'Pestaña «Ítems»',
        description: 'Cada compra se desglosa en <strong>ítems</strong> (lotes). Es el corazón económico: ahí defi­nís qué se compra, a qué precio y con qué garantía.', side: 'bottom' },
      { tab: '2', selector: '#tour-compras-edit-item-card', title: 'Tarjeta de un ítem',
        description: 'Cada ítem es una tarjeta independiente. Podés agregar tantas como necesites; cada una se ordena con su número (Ítem 1, Ítem 2, ...) y se puede eliminar con el botón de la basura.', side: 'top' },
      { tab: '2', selector: '#tour-compras-edit-item-row-nombre', title: 'Nombre y cantidad',
        description: '<strong>Nombre del ítem</strong> describe qué se compra (ej. "Notebook Dell Latitude 5440"). <strong>Cantidad</strong> es cuántas unidades; ambos son obligatorios.', side: 'bottom' },
      { tab: '2', selector: '#tour-compras-edit-item-row-proveedor', title: 'Proveedor y servicio de garantía',
        description: '<strong>Proveedor</strong>: quién vende el ítem. <strong>Servicio de garantía</strong>: quién responde por la garantía (puede ser el mismo proveedor o un tercero). Ambos campos buscan dinámicamente al tipear.', side: 'bottom' },
      { tab: '2', selector: '#tour-compras-edit-item-row-precio', title: 'Garantía, precio, moneda e IVA',
        description: '<strong>Meses de garantía</strong> definen la duración de la cobertura. <strong>Precio unitario</strong>, <strong>moneda</strong> (USD/UYU) e <strong>IVA</strong> (% por defecto 22) se combinan con la cantidad para calcular el total del ítem.', side: 'top' },
      { tab: '2', selector: '#tour-compras-edit-item-row-calculo', title: 'Cálculo automático del ítem',
        description: 'Mientras completás precio y cantidad, ves el <strong>subtotal, IVA y total</strong> del ítem en USD y UYU automáticamente. Estos totales suman al monto total de la compra.', side: 'top' },
      { tab: '2', selector: '#tour-compras-edit-items-add', title: 'Agregar ítem',
        description: 'Botón verde para sumar otro ítem a la compra. Una sola compra puede tener varios ítems con monedas y proveedores distintos.', side: 'left' },

      // ---------- PESTAÑA 3: ENTREGAS ----------
      { tab: '3', selector: '#tour-compras-edit-tab-entregas', title: 'Pestaña «Entregas»',
        description: 'Una vez definidos los ítems, registrás <strong>cuándo y cuántas unidades</strong> se entregaron. Un mismo ítem puede tener entregas parciales hasta completar la cantidad total.', side: 'bottom' },
      { tab: '3', selector: '#tour-compras-edit-entrega-card', title: 'Tarjeta de entrega',
        description: 'Cada entrega es independiente. Podés tener tantas como necesites (por ejemplo, 3 entregas de 2 notebooks cada una para un ítem de 6).', side: 'top' },
      { tab: '3', selector: '#tour-compras-edit-entrega-row-item', title: 'Ítem y cantidad',
        description: '<strong>Ítem</strong>: a cuál de los ítems de la compra corresponde esta entrega. <strong>Cantidad</strong>: cuántas unidades llegaron en esta entrega puntual.', side: 'bottom' },
      { tab: '3', selector: '#tour-compras-edit-entrega-row-fechas', title: 'Fecha de entrega y fin de garantía',
        description: '<strong>Fecha de entrega</strong>: cuándo llegó. <strong>Fecha fin garantía</strong>: se calcula automáticamente sumando los meses de garantía del ítem; igual la podés ajustar manualmente.', side: 'top' },
      { tab: '3', selector: '#tour-compras-edit-entrega-row-obs', title: 'Observación',
        description: 'Texto libre opcional para anotaciones sobre la entrega (ej. "Falta un cable", "Entrega parcial pendiente de OC adicional").', side: 'top' },
      { tab: '3', selector: '#tour-compras-edit-entregas-add', title: 'Agregar entrega',
        description: 'Botón para registrar otra entrega. Útil para entregas escalonadas o cuando el proveedor manda en tandas.', side: 'left' },

      // ---------- PESTAÑA 4: DOCUMENTOS ----------
      { tab: '4', selector: '#tour-compras-edit-tab-documentos', title: 'Pestaña «Documentos»',
        description: 'Acá adjuntás respaldo: <strong>remitos, facturas, contratos, pliegos</strong> y cualquier otro archivo asociado a la compra.', side: 'bottom' },
      { tab: '4', selector: '#tour-compras-edit-doc-fields', title: 'Subir un documento',
        description: 'Seleccioná el archivo (PDF, JPG, PNG, DOC, DOCX) y agregale una <strong>descripción</strong> opcional para identificarlo después.', side: 'top' },
      { tab: '4', selector: '#tour-compras-edit-doc-upload-btn', title: 'Botón Subir Documento',
        description: 'Confirma la carga. Mientras se sube se deshabilita el botón. Se admiten varios documentos por compra.', side: 'top' },
      { tab: '4', selector: '#tour-compras-edit-doc-list', title: 'Lista de documentos cargados',
        description: 'Acá se acumulan los archivos subidos, con opciones para <strong>visualizar</strong>, <strong>descargar</strong> o <strong>eliminar</strong> cada uno. En esta demo está vacía.', side: 'top' },

      // ---------- VOLVER A TAB 1 PARA FOOTER ----------
      { tab: '1', selector: '#tour-compras-edit-footer', title: 'Validaciones y avisos',
        description: 'Si al guardar falta algo obligatorio, el pie del modal muestra un <strong>aviso amarillo o rojo</strong> con la lista exacta de campos a corregir.', side: 'top' },
      { tab: '1', selector: '#tour-compras-edit-save', title: 'Guardar / Actualizar',
        description: 'Confirma la creación. En modo normal el botón pasa de <strong>Guardar</strong> (alta) a <strong>Actualizar</strong> (edición). En esta demo está bloqueado para evitar que se guarde algo de prueba en el sistema.', side: 'top' }
    ];

    this.esperarSelectores(
      [
        '#tour-compras-edit-header',
        '#tour-compras-edit-tabs',
        '#tour-compras-edit-row-identidad',
        '#tour-compras-edit-save'
      ],
      3000
    ).then(() => this.iniciarTourDemoConPestañas(pasos));
  }

  /**
   * Construye e inicia un driver.js que cambia de pestaña en función de la dirección de
   * navegación (Siguiente/Anterior), evitando que `onDeselected` dispare cambios cruzados.
   * Se intercepta `onNextClick` / `onPrevClick` globales para sincronizar `activeTab`
   * ANTES de que driver.js resuelva el selector del paso destino.
   */
  private iniciarTourDemoConPestañas(pasos: DemoStepDef[]): void {
    const driveSteps: DriveStep[] = pasos.map((p) => ({
      element: p.selector,
      popover: {
        title: p.title,
        description: p.description,
        side: (p.side ?? 'bottom') as 'top' | 'bottom' | 'left' | 'right',
        align: 'start'
      }
    }));

    if (driveSteps.length === 0) {
      this.finalizarTourDemo();
      this.modalService.dismissAll();
      return;
    }

    const aplicarTabDe = (idx: number): void => {
      const tab = pasos[idx]?.tab;
      if (tab && this.activeTab !== tab) {
        this.activeTab = tab;
        this.cdr.detectChanges();
      }
    };

    this.guidedTourHost.suspendGlobalZoom();

    const inst: Driver = driver({
      allowClose: true,
      overlayClickBehavior: () => undefined,
      allowKeyboardControl: false,
      showProgress: true,
      animate: false,
      smoothScroll: false,
      stagePadding: 10,
      overlayOpacity: 0.6,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      onNextClick: () => {
        const cur = inst.getActiveIndex() ?? 0;
        const next = cur + 1;
        if (next < driveSteps.length) {
          aplicarTabDe(next);
        }
        inst.moveNext();
      },
      onPrevClick: () => {
        const cur = inst.getActiveIndex() ?? 0;
        const prev = cur - 1;
        if (prev < 0) {
          return;
        }
        aplicarTabDe(prev);
        inst.movePrevious();
      },
      onDestroyed: () => {
        this.tourDemoModalRef?.dismiss();
        this.finalizarTourDemo();
        this.guidedTourHost.restoreGlobalZoom();
      },
      steps: driveSteps
    });

    this.tourCompra = inst;
    aplicarTabDe(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        inst.drive();
      });
    });
  }

  /**
   * Pre-llena el formulario de compra con datos ficticios para el tour, sin tocar el backend.
   * Forzamos `modoEdicion = true` para que aparezcan las 4 pestañas y la bandera `tourDemoActivo`
   * bloquea el botón Guardar/Actualizar mientras dure el tour.
   */
  private prepararCompraDemo(): void {
    const hoy = new Date();
    const fechaHoy = hoy.toISOString().split('T')[0];
    const enUnMes = new Date(hoy.getTime() + 30 * 86400000).toISOString().split('T')[0];
    const enDosAnios = new Date(hoy.getTime() + 730 * 86400000).toISOString().split('T')[0];

    this.tourDemoActivo = true;
    this.modoEdicion = true;
    this.activeTab = '1';
    this.compraModalValidacion = null;

    this.compraForm.reset();
    this.compraForm.patchValue({
      idCompra: -1,
      numeroCompra: 'DEMO-001',
      idTipoCompra: this.tiposCompraList[0].idTipoCompra,
      moneda: 'USD',
      descripcion: 'Compra DEMO para tutorial',
      fechaInicio: fechaHoy,
      fechaFinal: enUnMes,
      monto: 12500,
      valorDolar: 42.50,
      ano: hoy.getFullYear()
    });

    this.itemsFormArray.clear();
    this.itemsFormArray.push(this.fb.group({
      nombreItem: ['Notebook DEMO', Validators.required],
      descripcion: ['Equipo de demostración para el tour'],
      cantidad: [5, [Validators.required, Validators.min(1)]],
      mesesGarantia: [12, [Validators.required, Validators.min(0)]],
      idProveedor: [null, Validators.required],
      idServicioGarantia: [null, Validators.required],
      idItem: [-101],
      precioUnitario: [1500, [Validators.required, Validators.min(0.01)]],
      monedaPrecio: ['USD', Validators.required],
      porcentajeIva: [22.00, [Validators.required, Validators.min(0), Validators.max(100)]]
    }));
    this.itemsFormArray.push(this.fb.group({
      nombreItem: ['Monitor 24" DEMO', Validators.required],
      descripcion: ['Monitor para demostración'],
      cantidad: [10, [Validators.required, Validators.min(1)]],
      mesesGarantia: [24, [Validators.required, Validators.min(0)]],
      idProveedor: [null, Validators.required],
      idServicioGarantia: [null, Validators.required],
      idItem: [-102],
      precioUnitario: [300, [Validators.required, Validators.min(0.01)]],
      monedaPrecio: ['USD', Validators.required],
      porcentajeIva: [22.00, [Validators.required, Validators.min(0), Validators.max(100)]]
    }));

    this.lotesDeLaCompra = [
      {
        idItem: -101, nombreItem: 'Notebook DEMO', descripcion: 'Equipo de demostración para el tour',
        cantidad: 5, mesesGarantia: 12, idProveedor: 0, idServicioGarantia: 0, idCompra: -1,
        precioUnitario: 1500, monedaPrecio: 'USD', porcentajeIva: 22
      } as unknown as LoteDTO,
      {
        idItem: -102, nombreItem: 'Monitor 24" DEMO', descripcion: 'Monitor para demostración',
        cantidad: 10, mesesGarantia: 24, idProveedor: 0, idServicioGarantia: 0, idCompra: -1,
        precioUnitario: 300, monedaPrecio: 'USD', porcentajeIva: 22
      } as unknown as LoteDTO
    ];

    this.entregasFormArray.clear();
    this.entregasFormArray.push(this.fb.group({
      idEntrega: [-201],
      idItem: [-101, Validators.required],
      cantidad: [3, [Validators.required, Validators.min(1)]],
      descripcion: ['Primera entrega parcial DEMO'],
      fechaPedido: [fechaHoy, Validators.required],
      fechaFinGarantia: [enDosAnios, Validators.required]
    }));

    this.documentosCompra = [];
    this.descripcionDocumento = '';

    this.cdr.detectChanges();
  }

  private finalizarTourDemo(): void {
    if (!this.tourDemoActivo) {
      return;
    }
    this.tourDemoActivo = false;
    this.modoEdicion = false;
    this.compraForm.reset();
    this.itemsFormArray.clear();
    this.entregasFormArray.clear();
    this.lotesDeLaCompra = [];
    this.idItemsOriginales = [];
    this.idEntregasOriginales = [];
    this.documentosCompra = [];
    this.compraModalValidacion = null;
    this.tourDemoModalRef = undefined;
    this.cdr.detectChanges();
  }

} 