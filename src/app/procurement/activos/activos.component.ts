import { Component, OnDestroy, OnInit, TemplateRef, ViewEncapsulation, ViewChild, ChangeDetectorRef, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivosService, ActivoDTO } from '../../services/activos.service';
import {
  NgbActiveModal,
  NgbModal,
  NgbModalOptions,
  NgbModule,
  NgbNavModule
} from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { UbicacionesService } from '../../services/ubicaciones.service';
import { UbicacionDTO } from '../../interfaces/ubicacion.interface';
import { UsuariosService, UsuarioDTO } from '../../services/usuarios.service';
import { ComprasService, CompraDTO } from '../../services/compras.service';
import { HardwareService } from '../../services/hardware.service';
import { BiosService } from '../../services/bios.service';
import { CpuService } from '../../services/cpu.service';
import { DriveService } from '../../services/drive.service';
import { MemoryService } from '../../services/memory.service';
import { MonitorService } from '../../services/monitor.service';
import { StorageService } from '../../services/storage.service';
import { VideoService } from '../../services/video.service';
import { SoftwareByHardwareService } from '../../services/software-by-hardware.service';
import { SoftwareDTO } from '../../services/software.service';
import { LotesService, LoteDTO } from '../../services/lotes.service';
import { EntregasService, EntregaDTO } from '../../services/entregas.service';
import { ServiciosGarantiaService, ServicioGarantiaDTO } from '../../services/servicios-garantia.service';
import { TiposActivoService, TipoDeActivoDTO } from '../../services/tipos-activo.service';
import { TiposCompraService, TipoDeCompraDTO } from '../../services/tipos-compra.service';
import { firstValueFrom, of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';
import { driver, type Driver, type DriveStep } from 'driver.js';
import { TourRegistryService } from '../../services/tour-registry.service';
import {
  SearchListPickerModalComponent,
  SearchListPickerItem
} from '../../components/search-list-picker-modal/search-list-picker-modal.component';
import { ActivoViewModalComponent } from './activo-view-modal/activo-view-modal.component';

type ActivoSortColumn = 'numeroCompra' | 'name' | 'idUsuario' | 'idUbicacion' | 'criticidad' | 'estado';

/** Valores del formulario de activo (getRawValue incluye controles deshabilitados). */
interface ActivoFormRaw {
  name: string;
  criticidad: string;
  clasificacionDeINFO: string;
  estado: string;
  idTipoActivo: string | number;
  idNumeroCompra: string | number;
  idItem: string | number;
  idEntrega: string | number;
  idUbicacion: string | number | null | undefined;
  idUsuario: string | number | null | undefined;
  idSecundario: string;
  idServicioGarantia: string | number;
  fechaFinGarantia: string;
}

type PdfHardwareRemoteDep =
  | 'bios'
  | 'cpu'
  | 'drive'
  | 'memory'
  | 'monitor'
  | 'storage'
  | 'video'
  | 'software';

interface HwPdfBundle {
  bios?: unknown | null;
  cpu?: unknown | null;
  drive?: unknown[] | null;
  memory?: unknown[] | null;
  monitor?: unknown[] | null;
  storage?: unknown[] | null;
  video?: unknown[] | null;
  software?: SoftwareDTO[] | null;
}

interface PdfExportSection {
  id: string;
  title: string;
  hint?: string;
  cols: ReadonlyArray<{ key: string; label: string }>;
}

@Component({
  selector: 'app-activos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    NgbNavModule,
    NotificationContainerComponent
  ],
  templateUrl: './activos.component.html',
  styleUrls: ['./activos.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ActivosComponent implements OnInit, OnDestroy {
  private inventoryTour?: Driver;
  private inventoryTourZoomSuspendCount = 0;
  private inventoryTourOpenedActivoModal = false;
  private tourCleanup?: () => void;
  private static readonly PDF_KEY_REMOTE_DEP: Partial<
    Record<string, PdfHardwareRemoteDep>
  > = {
    biosSmanufacturer: 'bios',
    biosSmodel: 'bios',
    biosSsn: 'bios',
    biosAssettag: 'bios',
    biosType: 'bios',
    biosBmanufacturer: 'bios',
    biosBversion: 'bios',
    biosBdate: 'bios',
    cpuManufacturer: 'cpu',
    cpuType: 'cpu',
    cpuSerial: 'cpu',
    cpuSpeed: 'cpu',
    cpuCores: 'cpu',
    cpuSocket: 'cpu',
    cpuArch: 'cpu',
    cpuLogicalCpus: 'cpu',
    cpuVoltage: 'cpu',
    drivesSummary: 'drive',
    memorySummary: 'memory',
    monitorsSummary: 'monitor',
    storageSummary: 'storage',
    videosSummary: 'video',
    softwareSummary: 'software'
  };

  @ViewChild('modalActivo') modalActivo: any;
  /** Referencia del template del modal alta/edición (para suspender zoom y layout). */
  @ViewChild('activoModal') activoModalTemplate!: TemplateRef<unknown>;
  activos: ActivoDTO[] = [];
  activosFiltrados: ActivoDTO[] = [];
  loading: boolean = false;
  error: string | null = null;
  activoForm: FormGroup;
  modoEdicion: boolean = false;
  activoSeleccionado: ActivoDTO | null = null;
  usuarioSeleccionado: UsuarioDTO | null = null;
  compraSeleccionada: CompraDTO | null = null;
  ubicaciones = new Map<number, UbicacionDTO>();
  usuarios: Map<number, UsuarioDTO> = new Map();
  compras: Map<number, CompraDTO> = new Map();
  hardwareMap: Map<number, any> = new Map();
  /** Nombre de equipo → registro de inventario Cerbero (`getHardware()`). */
  private hardwareByName: Map<string, any> = new Map();
  
  // Paginación
  page = 1;
  pageSize = 25;
  collectionSize = 0;

  // Búsqueda y ordenamiento
  searchTerm = '';
  sortColumn: ActivoSortColumn = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Filtrado
  currentFilter: string = '';
  /** Filtro por columna estado (valor '' = todos). */
  currentEstadoFilter: string = '';
  altaCount: number = 0;
  mediaCount: number = 0;
  bajaCount: number = 0;
  estadoActivoCount: number = 0;
  estadoInactivoCount: number = 0;
  estadoMantenimientoCount: number = 0;
  totalActivos: number = 0;

  /**
   * Búsqueda de compra en el modal activo — mismo patrón que Registrar Stock (`stock.component`):
   * un input + lista absoluta `.items-dropdown` (sin segundo control ni Popper).
   */
  compraModalSearchTerm = '';
  comprasModalFiltradas: CompraDTO[] = [];
  mostrarDropdownComprasModal = false;

  itemModalDisplayTerm = '';
  entregaModalDisplayTerm = '';

  /**
   * Búsqueda de ubicación en el modal activo — mismo patrón que Compra / Registrar Stock:
   * input + `.items-dropdown` (sin typeahead en body).
   */
  ubicacionModalSearchTerm = '';
  ubicacionesModalFiltradas: UbicacionDTO[] = [];
  mostrarDropdownUbicacionesModal = false;

  /**
   * Servicio de garantía en el modal — mismo patrón que Compra / Ubicación.
   */
  servicioGarantiaModalSearchTerm = '';
  serviciosGarantiaModalFiltrados: ServicioGarantiaDTO[] = [];
  mostrarDropdownServiciosGarantiaModal = false;

  // Listas para los dropdowns
  hardwareList: any[] = [];
  comprasList: CompraDTO[] = [];
  /** Orden estable para listar / filtrar compras en el modal. */
  comprasListOrdenadasModal: CompraDTO[] = [];
  lotesList: LoteDTO[] = [];
  lotesFiltrados: LoteDTO[] = []; // Nueva propiedad para lotes filtrados por compra
  entregasList: EntregaDTO[] = [];
  entregasFiltradas: EntregaDTO[] = []; // Nueva propiedad para entregas filtradas por item
  ubicacionesList: UbicacionDTO[] = [];
  serviciosGarantiaList: ServicioGarantiaDTO[] = [];
  tiposActivoList: TipoDeActivoDTO[] = [];
  tiposCompraList: TipoDeCompraDTO[] = [];

  selectedRelatedAssets: number[] = [];

  successMessage: string | null = null;
  errorMessage: string | null = null;

  // Propiedades para creación por rango
  private _creationMode: 'single' | 'range' = 'single';
  
  get creationMode(): 'single' | 'range' {
    return this._creationMode;
  }
  
  set creationMode(value: 'single' | 'range') {
    this._creationMode = value;
    this.updateValidationRules();
    // Resetear la visualización de errores cuando cambie el modo
    this.shouldShowValidationErrors = false;
  }
  rangeStart: string = '';
  rangeEnd: string = '';

  // Propiedad para las pestañas del modal
  activeTab: string = '1';

  // Getters para los campos de rango
  get rangeStartControl(): string {
    return this.rangeStart;
  }

  set rangeStartControl(value: string) {
    this.rangeStart = value;
    this.resetValidationDisplay();
  }

  get rangeEndControl(): string {
    return this.rangeEnd;
  }

  set rangeEndControl(value: string) {
    this.rangeEnd = value;
    this.resetValidationDisplay();
  }

  activosRelacionados: ActivoDTO[] = [];

  activoAEliminar: any = null;
  showConfirmDialog: boolean = false;

  // Propiedades para el modal de detalles de compra
  lotesDetalles: LoteDTO[] = [];
  entregasDetalles: EntregaDTO[] = [];

  // Propiedad para controlar cuándo mostrar errores de validación
  shouldShowValidationErrors: boolean = false;

  /**
   * Secciones del modal de PDF (gestión del activo + datos de inventario almacenados en Cerbero).
   * El orden de las secciones define el orden de columnas en el documento.
   */
  readonly pdfExportSections: ReadonlyArray<PdfExportSection> = [
    {
      id: 'identidad',
      title: 'Identificación del activo (gestión)',
      cols: [
        { key: 'idActivo', label: 'ID activo' },
        { key: 'numeroActivo', label: 'Número de equipo' },
        { key: 'tipoActivo', label: 'Tipo de activo' },
        { key: 'idSecundario', label: 'ID secundario' }
      ]
    },
    {
      id: 'compra',
      title: 'Compra y referencias',
      cols: [
        { key: 'compra', label: 'Compra' },
        { key: 'itemLote', label: 'Ítem / lote' }
      ]
    },
    {
      id: 'asignacion',
      title: 'Asignación (detalle activo)',
      cols: [
        { key: 'responsable', label: 'Responsable' },
        { key: 'ubicacion', label: 'Ubicación (gerencia/oficina)' },
        { key: 'entrega', label: 'Entrega' }
      ]
    },
    {
      id: 'garantia',
      title: 'Garantía',
      cols: [
        { key: 'servicioGarantia', label: 'Servicio de garantía' },
        { key: 'fechaFinGarantia', label: 'Fin garantía' }
      ]
    },
    {
      id: 'estado_clas',
      title: 'Clasificación y estado',
      cols: [
        { key: 'clasificacion', label: 'Clasificación de información' },
        { key: 'criticidad', label: 'Criticidad' },
        { key: 'estado', label: 'Estado' }
      ]
    },
    {
      id: 'ocs_general',
      title: 'Inventario Cerbero — General',
      hint: 'Como la pestaña General del detalle del equipo. El nombre del activo debe coincidir con un equipo en inventario Cerbero.',
      cols: [
        { key: 'hwIdInventario', label: 'ID equipo (inventario)' },
        { key: 'hwWorkgroup', label: 'Grupo de trabajo' },
        { key: 'hwIpAddr', label: 'IP' },
        { key: 'hwIpSrc', label: 'IP source' },
        { key: 'hwDns', label: 'DNS' },
        { key: 'hwDefaultGateway', label: 'Gateway' },
        { key: 'hwOsName', label: 'Nombre SO' },
        { key: 'hwOsVersion', label: 'Versión SO' },
        { key: 'hwOsComments', label: 'Comentarios SO' },
        { key: 'hwDescription', label: 'Descripción' },
        { key: 'hwProcessorsLabel', label: 'Procesadores (etiqueta)' },
        { key: 'hwProcessorType', label: 'Tipo de procesador' },
        { key: 'hwProcessorCores', label: 'Núcleos' },
        { key: 'hwMemoryMb', label: 'Memoria (MB)' },
        { key: 'hwSwapMb', label: 'Swap (MB)' },
        { key: 'hwWinCompany', label: 'Windows — compañía' },
        { key: 'hwWinUser', label: 'Último usuario (Windows)' },
        { key: 'hwLastDate', label: 'Último inventario' },
        { key: 'hwLastCome', label: 'Último contacto agente' }
      ]
    },
    {
      id: 'ocs_bios',
      title: 'Inventario Cerbero — BIOS',
      hint: 'Datos guardados en Cerbero por equipo; con muchas filas la exportación puede tardar.',
      cols: [
        { key: 'biosSmanufacturer', label: 'Fabricante del sistema' },
        { key: 'biosSmodel', label: 'Modelo del sistema' },
        { key: 'biosSsn', label: 'Nº serie del sistema' },
        { key: 'biosAssettag', label: 'Etiqueta de activo' },
        { key: 'biosType', label: 'Tipo de BIOS' },
        { key: 'biosBmanufacturer', label: 'Fabricante del BIOS' },
        { key: 'biosBversion', label: 'Versión del BIOS' },
        { key: 'biosBdate', label: 'Fecha del BIOS' }
      ]
    },
    {
      id: 'ocs_cpu',
      title: 'Inventario Cerbero — CPU',
      cols: [
        { key: 'cpuManufacturer', label: 'Fabricante CPU' },
        { key: 'cpuType', label: 'Tipo / modelo CPU' },
        { key: 'cpuSerial', label: 'Nº serie CPU' },
        { key: 'cpuSpeed', label: 'Velocidad' },
        { key: 'cpuCores', label: 'Núcleos' },
        { key: 'cpuSocket', label: 'Socket' },
        { key: 'cpuArch', label: 'Arquitectura' },
        { key: 'cpuLogicalCpus', label: 'CPUs lógicas' },
        { key: 'cpuVoltage', label: 'Voltaje' }
      ]
    },
    {
      id: 'ocs_volumes',
      title: 'Inventario Cerbero — Unidades (volúmenes)',
      cols: [{ key: 'drivesSummary', label: 'Resumen de volúmenes' }]
    },
    {
      id: 'ocs_mem',
      title: 'Inventario Cerbero — Memoria (módulos)',
      cols: [{ key: 'memorySummary', label: 'Resumen de módulos' }]
    },
    {
      id: 'ocs_mon',
      title: 'Inventario Cerbero — Monitor',
      cols: [{ key: 'monitorsSummary', label: 'Resumen de monitores' }]
    },
    {
      id: 'ocs_disk',
      title: 'Inventario Cerbero — Almacenamiento (discos físicos)',
      cols: [{ key: 'storageSummary', label: 'Resumen de discos' }]
    },
    {
      id: 'ocs_vid',
      title: 'Inventario Cerbero — Video',
      cols: [{ key: 'videosSummary', label: 'Resumen de placas / video' }]
    },
    {
      id: 'ocs_sw',
      title: 'Inventario Cerbero — Software',
      cols: [{ key: 'softwareSummary', label: 'Resumen de software instalado' }]
    }
  ];

  /** Selección por clave (ngModel en el modal). */
  pdfColumnSelected: Record<string, boolean> = {};

  /** Columnas marcadas por defecto (botón «Por defecto» / al cargar la vista). */
  private readonly pdfDefaultOnKeys = new Set([
    'numeroActivo',
    'compra',
    'responsable',
    'ubicacion',
    'criticidad',
    'estado'
  ]);

  pdfGenerando = false;

  /** Mientras hay modal de alta/edición abierto suspendemos zoom global (`body:not(.no-global-zoom)`) para que Popper/ngb-typeahead calcule bien. */
  private activoModalBodyZoomSuspendCount = 0;

  /** Columnas en orden de exportación (aplanadas desde `pdfExportSections`). */
  get pdfColumnsFlat(): ReadonlyArray<{ key: string; label: string }> {
    return this.pdfExportSections.flatMap((s) => [...s.cols]);
  }

  constructor(
    private activosService: ActivosService,
    private ubicacionesService: UbicacionesService,
    private usuariosService: UsuariosService,
    private comprasService: ComprasService,
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private cpuService: CpuService,
    private driveService: DriveService,
    private memoryService: MemoryService,
    private monitorService: MonitorService,
    private storageService: StorageService,
    private videoService: VideoService,
    private softwareByHardwareService: SoftwareByHardwareService,
    private lotesService: LotesService,
    private entregasService: EntregasService,
    private serviciosGarantiaService: ServiciosGarantiaService,
    private tiposActivoService: TiposActivoService,
    private tiposCompraService: TiposCompraService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private tourRegistry: TourRegistryService,
    @Inject(DOCUMENT) private documentRef: Document
  ) {
    this.activoForm = this.fb.group({
      name: ['', Validators.required],
      criticidad: ['', Validators.required],
      clasificacionDeINFO: ['', Validators.required],
      estado: ['', Validators.required],
      idTipoActivo: ['', Validators.required],
      idNumeroCompra: ['', Validators.required],
      idItem: ['', Validators.required],
      idEntrega: ['', Validators.required],
      idUbicacion: [''], // Quitado Validators.required
      idUsuario: ['', Validators.required],
      idSecundario: ['', Validators.required],
      idServicioGarantia: ['', Validators.required],
      fechaFinGarantia: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.reiniciarSeleccionPdfColumnas();

    this.cargarUbicaciones();
    this.cargarUsuarios();
    this.cargarCompras();
    this.cargarActivos();
    this.cargarHardware();
    this.cargarLotes();
    this.cargarEntregas();
    this.cargarServiciosGarantia();
    this.cargarTiposActivo();
    this.cargarTiposCompra();
    
    // Suscribirse a cambios en la compra seleccionada
    this.activoForm.get('idNumeroCompra')?.valueChanges.subscribe((raw) => {
      this.onCompraChange(raw);
    });

    // Suscribirse a cambios en el item seleccionado
    this.activoForm.get('idItem')?.valueChanges.subscribe((idItem) => {
      this.onItemChange(idItem);
    });

    // Suscribirse a cambios en el tipo de activo seleccionado
    this.activoForm.get('idTipoActivo')?.valueChanges.subscribe((idTipoActivo) => {
      this.onTipoActivoChange(idTipoActivo);
      this.resetValidationDisplay();
    });

    // Suscribirse a cambios en otros campos para resetear la visualización de errores
    this.activoForm.get('clasificacionDeINFO')?.valueChanges.subscribe(() => {
      this.resetValidationDisplay();
    });

    this.activoForm.get('criticidad')?.valueChanges.subscribe(() => {
      this.resetValidationDisplay();
    });

    this.activoForm.get('estado')?.valueChanges.subscribe(() => {
      this.resetValidationDisplay();
    });

    this.activoForm.get('idNumeroCompra')?.valueChanges.subscribe(() => {
      this.resetValidationDisplay();
    });

    this.activoForm.get('idItem')?.valueChanges.subscribe(() => {
      this.resetValidationDisplay();
    });

    this.activoForm.get('idEntrega')?.valueChanges.subscribe(() => {
      this.resetValidationDisplay();
    });

    this.activoForm.get('idUsuario')?.valueChanges.subscribe(() => {
      this.resetValidationDisplay();
    });

    this.activoForm.get('idSecundario')?.valueChanges.subscribe(() => {
      this.resetValidationDisplay();
    });

    this.activoForm.get('idServicioGarantia')?.valueChanges.subscribe(() => {
      this.resetValidationDisplay();
    });

    this.activoForm.get('fechaFinGarantia')?.valueChanges.subscribe(() => {
      this.resetValidationDisplay();
    });

    // Suscribirse a cambios en los campos de rango para resetear la visualización de errores
    // Usar un observable personalizado para los campos de rango
    this.activoForm.get('name')?.valueChanges.subscribe(() => {
      this.resetValidationDisplay();
    });

    // Actualizar validaciones iniciales
    this.updateValidationRules();

    this.tourCleanup = this.tourRegistry.register('activos', [
      {
        id: 'activos-inventario-overview',
        title: 'Tour de inventario de activos',
        icon: 'fa-route',
        run: () => this.runTourInventario(),
      },
      {
        id: 'activos-alta-modal',
        title: 'Cómo dar de alta un activo',
        icon: 'fa-plus-circle',
        description: 'Abre el modal de creación y recorre los campos.',
        run: () => this.runTourAltaActivo(),
      },
    ]);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
    this.inventoryTour?.destroy();
    this.inventoryTour = undefined;
  }

  private runTourInventario(): void {
    this.inventoryTourOpenedActivoModal = false;
    const steps: DriveStep[] = [];
    const addStep = (selector: string, title: string, description: string, side: 'top' | 'bottom' | 'left' | 'right' = 'bottom') => {
      if (!this.documentRef.querySelector(selector)) return;
      steps.push({
        element: selector,
        popover: {
          title,
          description,
          side,
          align: 'start'
        }
      });
    };

    addStep(
      '#activos-tour-title',
      'Gestión de Activos',
      'Desde esta pantalla gestionás altas, edición, filtros, búsqueda e impresión del inventario.',
      'bottom'
    );
    addStep(
      '#activos-tour-new-btn',
      'Nuevo Activo',
      'Abre el modal para crear activos individuales o por rango. Si querés ver los campos del formulario, elegí «Cómo dar de alta un activo» en el menú del perro.',
      'bottom',
    );
    addStep(
      '#activos-tour-search',
      'Búsqueda rápida',
      'Acá podés buscar por número de activo, responsable o compra para filtrar la lista.',
      'bottom'
    );
    addStep(
      '#activos-tour-table',
      'Tabla de inventario',
      'La tabla muestra el estado actual del inventario y permite ver detalles o editar registros.',
      'top'
    );
    addStep(
      '#activos-tour-print-btn',
      'Exportar a PDF',
      'Desde acá exportás el listado filtrado con las columnas que elijas.',
      'left'
    );

    if (steps.length === 0) {
      return;
    }

    this.startInventoryDriver(steps);
  }

  /**
   * Selectores que el sub-tour de alta de activo necesita ver en el DOM.
   * Tener la lista centralizada nos sirve para el polling de espera y para
   * el filtrado final de pasos.
   */
  private static readonly ALTA_ACTIVO_TOUR_SELECTORS = [
    '#activos-tour-modal-creation-mode',
    '#activos-tour-modal-name',
    '#activos-tour-modal-tipo-clasificacion',
    '#activos-tour-modal-criticidad-estado',
    '#activos-tour-modal-compra',
    '#activos-tour-modal-item',
    '#activos-tour-modal-entrega-ubicacion',
    '#activos-tour-modal-responsable-id',
    '#activos-tour-modal-garantia',
    '#activos-tour-modal-relacionados',
    '#activos-tour-modal-save'
  ];

  private runTourAltaActivo(): void {
    this.inventoryTour?.destroy();
    this.modalService.dismissAll();
    this.inventoryTourOpenedActivoModal = true;
    // Forzamos modo Individual y pestaña principal antes de abrir el modal:
    // así #activos-tour-modal-name se renderiza desde el primer frame y el
    // ngbNavContent ('1') queda activo para que todos los campos vivan en el
    // DOM cuando arranque el tour.
    this.creationMode = 'single';
    this.activeTab = '1';
    void this.abrirModal(this.activoModalTemplate).then(
      () => this.waitForModalAndStartTour(),
      () => this.waitForModalAndStartTour()
    );
  }

  /**
   * Espera a que el modal de alta esté completamente montado en el DOM antes
   * de armar los pasos. `abrirModal` resuelve su promesa apenas pide a
   * NgbModal abrirlo, pero el contenido vive dentro de un `ng-template
   * ngbNavContent` y se renderiza recién cuando NgbNav decide activarlo.
   * Si filtramos por selector antes de eso, los IDs nuevos se pierden y el
   * tour queda con menos pasos de los esperados.
   *
   * El polling chequea TODOS los selectores que el tour necesita; mientras
   * tanto, también intenta forzar la pestaña "Datos del activo" haciendo
   * click programático en el `ngbNavLink` por si NgbNav no la montó solo.
   * Techo de ~3 segundos para no colgar la UI si algún selector
   * definitivamente no está.
   */
  private waitForModalAndStartTour(): void {
    const maxAttempts = 60;
    let attempts = 0;
    let navClicked = false;
    const checkAndRun = () => {
      attempts++;
      if (this.creationMode !== 'single') {
        this.creationMode = 'single';
      }
      if (this.activeTab !== '1') {
        this.activeTab = '1';
      }
      this.changeDetectorRef.detectChanges();

      // Si el modal-body ya está pero el contenido del nav todavía no,
      // forzamos un click sobre el `ngbNavLink` la primera vez para montar
      // el ng-template del nav (mitiga timings donde [(activeId)] no
      // propaga el render inmediatamente).
      const modalBody = this.documentRef.querySelector('#activos-tour-modal-root');
      const navContentMounted = !!this.documentRef.querySelector('#activos-tour-modal-tipo-clasificacion');
      if (modalBody && !navContentMounted && !navClicked) {
        const navLink = modalBody.querySelector('a[ngbnavlink], a.nav-link') as HTMLElement | null;
        if (navLink) {
          navLink.click();
          navClicked = true;
        }
      }

      const allPresent = ActivosComponent.ALTA_ACTIVO_TOUR_SELECTORS.every(
        sel => !!this.documentRef.querySelector(sel)
      );
      if (allPresent || attempts >= maxAttempts) {
        this.startTourAltaActivoSteps();
        return;
      }
      window.setTimeout(checkAndRun, 50);
    };
    checkAndRun();
  }

  private startTourAltaActivoSteps(): void {
    // Defensivo: por si el usuario cambió a "Rango" antes de entrar al tour,
    // volvemos a forzar single y damos un detectChanges para que el campo
    // "#activos-tour-modal-name" esté en el DOM al filtrar.
    if (this.creationMode !== 'single') {
      this.creationMode = 'single';
    }
    this.changeDetectorRef.detectChanges();

    const stepHighlightRefresh = () => this.inventoryTourRefreshHighlightAfterLayout();

    const allSteps: DriveStep[] = [
      {
        element: '#activos-tour-modal-creation-mode',
        onHighlighted: stepHighlightRefresh,
        popover: {
          title: '1. Individual o por rango',
          description:
            'Primero decidís cómo crear los activos. <strong>Individual</strong>: un solo número de activo. ' +
            '<strong>Rango</strong>: número inicial y final con el mismo formato (ej. PC14000 a PC14005, o 100 a 105) y el sistema crea todos los activos del rango con datos comunes. ' +
            'Si el rango es muy grande, te avisa porque la operación puede tardar.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#activos-tour-modal-name',
        onHighlighted: stepHighlightRefresh,
        popover: {
          title: '2. Número de Activo',
          description:
            'Identificador único del equipo (ej. PC14000, IMP123, 14000). El sistema valida que no esté duplicado: si ya existe, te lo marca en rojo. ' +
            'En modo Rango, este campo se reemplaza por "Número Inicial" y "Número Final".',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#activos-tour-modal-tipo-clasificacion',
        onHighlighted: stepHighlightRefresh,
        popover: {
          title: '3. Tipo de Activo y Clasificación',
          description:
            '<strong>Tipo de Activo</strong> define la categoría operativa (PC, impresora, monitor, etc.) y, según las reglas del sistema, autocompleta el responsable más abajo. ' +
            '<strong>Clasificación de INFO</strong> indica la sensibilidad de la información (Confidencial, No confidencial o Pública).',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#activos-tour-modal-criticidad-estado',
        onHighlighted: stepHighlightRefresh,
        popover: {
          title: '4. Criticidad y Estado',
          description:
            '<strong>Criticidad</strong> (Alta / Media / Baja) refleja qué tan crítico es el equipo para la operación. ' +
            '<strong>Estado</strong> (Activo / Inactivo / Mantenimiento) indica la situación operativa actual del equipo.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#activos-tour-modal-compra',
        onHighlighted: stepHighlightRefresh,
        popover: {
          title: '5. Compra',
          description:
            'Escribí en el campo para buscar la compra por número o descripción y elegí una de la lista. ' +
            'Al seleccionar una compra se habilitan los campos de Ítem y Entrega asociados a esa compra.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '#activos-tour-modal-item',
        onHighlighted: stepHighlightRefresh,
        popover: {
          title: '6. Ítem de la compra',
          description:
            'Una vez seleccionada la compra, este desplegable lista los ítems disponibles para esa compra. ' +
            'Elegir el ítem habilita el campo Entrega con las entregas correspondientes a ese ítem.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: '#activos-tour-modal-entrega-ubicacion',
        onHighlighted: stepHighlightRefresh,
        popover: {
          title: '7. Entrega y Ubicación',
          description:
            '<strong>Entrega</strong>: una vez elegido el ítem, aparecen las entregas concretas (lote físico) asociadas. ' +
            '<strong>Ubicación</strong>: campo de búsqueda libre por gerencia, oficina o ciudad para asignar dónde queda físicamente el activo. Es opcional.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: '#activos-tour-modal-responsable-id',
        onHighlighted: stepHighlightRefresh,
        popover: {
          title: '8. Responsable e ID Secundario',
          description:
            '<strong>Responsable</strong>: persona a cargo del equipo. Cuando el tipo de activo tiene una regla de asignación automática, este campo se llena solo y queda bloqueado. ' +
            '<strong>ID Secundario</strong>: identificador alternativo (serie, código interno, etiqueta) para referenciar el equipo desde otros sistemas.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: '#activos-tour-modal-garantia',
        onHighlighted: stepHighlightRefresh,
        popover: {
          title: '9. Servicio de Garantía y Fecha Fin',
          description:
            '<strong>Servicio de Garantía</strong>: buscás al proveedor que da soporte/garantía (por nombre comercial, razón social o RUC) y lo seleccionás del listado. ' +
            '<strong>Fecha Fin Garantía</strong>: día en que vence la cobertura. Útil para programar renovaciones y filtrar equipos próximos a quedar fuera de garantía.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: '#activos-tour-modal-relacionados',
        onHighlighted: stepHighlightRefresh,
        popover: {
          title: '10. Activos Relacionados',
          description:
            'Sirve para vincular este activo con otros (por ejemplo, un monitor y su CPU, o una impresora con su servidor). ' +
            'Podés agregar varios con el buscador (modal): número de equipo, ID de activo o ID secundario. La relación queda visible desde el detalle del equipo.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: '#activos-tour-modal-save',
        onHighlighted: stepHighlightRefresh,
        popover: {
          title: '11. Guardar',
          description:
            'Cuando el formulario está completo y sin errores, este botón registra el alta (o las modificaciones si estás editando un activo existente). ' +
            'En modo Rango, esta acción crea todos los activos del rango en una sola operación.',
          side: 'top',
          align: 'start'
        }
      }
    ];

    const missing: string[] = [];
    const steps = allSteps.filter(s => {
      const sel = s.element as string;
      const exists = !!this.documentRef.querySelector(sel);
      if (!exists) {
        missing.push(sel);
      }
      return exists;
    });

    if (missing.length > 0) {
      // Útil en desarrollo para detectar selectores que no se renderizaron
      // todavía en el modal cuando arrancó el tour.
      console.warn('[ActivosTour] selectores no encontrados en el modal:', missing);
    }

    if (steps.length === 0) {
      this.modalService.dismissAll();
      this.inventoryTourOpenedActivoModal = false;
      return;
    }

    this.startInventoryDriver(steps);
  }

  private startInventoryDriver(steps: DriveStep[]): void {
    this.inventoryTour?.destroy();
    this.suspenderZoomGlobalParaTour();
    this.inventoryTour = driver({
      allowClose: true,
      /** No cerrar ni avanzar con clic en el oscuro: solo botones del popover y la X. */
      overlayClickBehavior: () => undefined,
      allowKeyboardControl: false,
      showProgress: true,
      overlayOpacity: 0.6,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      onDestroyed: () => {
        const wasModalTour = this.inventoryTourOpenedActivoModal;
        if (wasModalTour) {
          this.modalService.dismissAll();
          this.inventoryTourOpenedActivoModal = false;
        }
        this.restaurarZoomGlobalTrasTour();
        // El tour del listado salta de paso en paso por toda la página y
        // suele terminar con la tabla/PDF scrolleados; al cerrar lo dejamos
        // arriba para que la siguiente acción del usuario arranque limpia.
        // En el sub-tour del modal evitamos tocar el scroll del listado de
        // fondo: el modal era el contexto, no el listado.
        if (!wasModalTour) {
          this.resetScrollToTop();
        }
      },
      steps
    });
    this.inventoryTour.drive();
  }

  private suspenderZoomGlobalParaTour(): void {
    this.inventoryTourZoomSuspendCount += 1;
    this.documentRef.body.classList.add('no-global-zoom');
  }

  private restaurarZoomGlobalTrasTour(): void {
    this.inventoryTourZoomSuspendCount = Math.max(0, this.inventoryTourZoomSuspendCount - 1);
    if (this.inventoryTourZoomSuspendCount === 0) {
      this.documentRef.body.classList.remove('no-global-zoom');
    }
  }

  /**
   * Vuelve la pantalla al inicio cuando termina el tour.
   *
   * Lo posponemos dos frames porque al cerrar el tour quitamos la clase
   * `body.no-global-zoom`, lo que restaura el `zoom: 0.8` global y reescala
   * el documento. Scrollear en el mismo tick que ese cambio cancela el
   * smooth (e incluso, en algunos casos, el browser decide ignorar el
   * `scrollTo`). Esperar al layout asentado evita ambos problemas.
   */
  private resetScrollToTop(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          window.scrollTo(0, 0);
        }
      });
    });
  }

  /** driver.js puede medir antes de que el modal termine layout; repetir refresh evita el “globo centrado”. */
  private inventoryTourRefreshHighlightAfterLayout(): void {
    const tour = this.inventoryTour;
    const tick = () => tour?.refresh();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(tick, 0);
        window.setTimeout(tick, 100);
        window.setTimeout(tick, 260);
      });
    });
  }

  private isElementDomReadyForHighlight(el: Element | null): boolean {
    if (!(el instanceof HTMLElement)) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4;
  }

  /**
   * Espera a que el selector exista y tenga tamaño (y opcionalmente condición extra) antes de moveNext + refresh.
   */
  private inventoryTourAdvanceWhenVisibleSelector(
    selector: string,
    options?: {
      extra?: () => boolean;
      maxAttempts?: number;
      intervalMs?: number;
      settleDelayMs?: number;
    }
  ): void {
    const maxAttempts = options?.maxAttempts ?? 50;
    const intervalMs = options?.intervalMs ?? 80;
    const settleDelayMs = options?.settleDelayMs ?? 140;

    const tryAdvance = (left: number) => {
      const el = this.documentRef.querySelector(selector);
      const base = this.isElementDomReadyForHighlight(el);
      const extraOk = options?.extra ? options.extra() : true;
      if (base && extraOk) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.setTimeout(() => {
              this.inventoryTour?.moveNext();
              window.setTimeout(() => this.inventoryTour?.refresh(), 100);
            }, settleDelayMs);
          });
        });
        return;
      }
      if (left <= 0) {
        this.inventoryTour?.moveNext();
        window.setTimeout(() => this.inventoryTour?.refresh(), 160);
        return;
      }
      window.setTimeout(() => tryAdvance(left - 1), intervalMs);
    };
    tryAdvance(maxAttempts);
  }

  private inventoryTourAdvanceWhenModalCreationModeListo(): void {
    this.changeDetectorRef.detectChanges();
    this.inventoryTourAdvanceWhenVisibleSelector('#activos-tour-modal-creation-mode', {
      extra: () => !!this.documentRef.querySelector('.modal.show'),
      maxAttempts: 55,
      intervalMs: 70,
      settleDelayMs: 160
    });
  }

  /** Evita enviar el formulario del activo con un clic accidental durante el tour guiado. */
  isActivoSubmitBlockedByInventoryTour(): boolean {
    return !!(this.inventoryTour?.isActive() && this.inventoryTourOpenedActivoModal);
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

  private setUbicacionesDesdeApi(ubicaciones: UbicacionDTO[]): void {
    this.ubicaciones.clear();
    this.ubicacionesList = ubicaciones;
    ubicaciones.forEach((ubicacion) => {
      if (ubicacion.id) {
        this.ubicaciones.set(ubicacion.id, ubicacion);
      }
    });
  }

  cargarUbicaciones() {
    this.ubicacionesService.getUbicaciones().subscribe({
      next: (ubicaciones: UbicacionDTO[]) => {
        this.setUbicacionesDesdeApi(ubicaciones);
      },
      error: (error: any) => {
        console.error('Error al cargar ubicaciones:', error);
        this.errorMessage = 'Error al cargar las ubicaciones. Por favor, intente nuevamente.';
      }
    });
  }

  getUbicacionInfo(idUbicacion: number | null): string {
    if (!idUbicacion) return 'No asignada';
    const ubicacion = this.ubicaciones.get(idUbicacion);
    return ubicacion ? `${ubicacion.nombreGerencia} - ${ubicacion.nombreOficina}` : 'No asignada';
  }

  verDetallesUbicacion(idUbicacion: number | null, ubicacionModal: any) {
    if (!idUbicacion) return;
    const ubicacion = this.ubicaciones.get(idUbicacion);
    if (ubicacion) {
      this.activoSeleccionado = this.activos.find(a => a.idUbicacion === idUbicacion) || null;
      this.modalService.open(ubicacionModal, { size: 'lg' });
    }
  }

  verDetallesUsuario(idUsuario: number, usuarioModal: any) {
    const usuario = this.usuarios.get(idUsuario);
    if (usuario) {
      this.usuarioSeleccionado = usuario;
      this.modalService.open(usuarioModal, { size: 'lg' });
    }
  }

  cargarCompras() {
    this.comprasService.getCompras().subscribe({
      next: (compras) => {
        this.comprasList = compras;
        const ay = (c: CompraDTO) => c.ano ?? 0;
        const num = (c: CompraDTO) => (c.numeroCompra || '').trim();
        this.comprasListOrdenadasModal = [...compras].sort((a, b) => {
          const yd = ay(b) - ay(a);
          if (yd !== 0) return yd;
          const cmpNum = num(a).localeCompare(num(b), undefined, { numeric: true });
          if (cmpNum !== 0) return cmpNum;
          return (a.descripcion || '').localeCompare(b.descripcion || '', undefined, { sensitivity: 'base' });
        });
        compras.forEach(compra => {
          if (compra.idCompra) {
            this.compras.set(compra.idCompra, compra);
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar compras:', error);
      }
    });
  }

  etiquetaCompraModal(compra: CompraDTO | null): string {
    if (!compra) {
      return '';
    }
    const n = compra.numeroCompra ?? '';
    const d = compra.descripcion?.trim();
    return d ? `${n} — ${d}` : n;
  }

  filtrarComprasModal(): void {
    const base = this.comprasListOrdenadasModal;
    const limiteListaInicial = 200;
    if (!this.compraModalSearchTerm.trim()) {
      this.comprasModalFiltradas = base.slice(0, limiteListaInicial);
      return;
    }
    const searchTerm = this.compraModalSearchTerm.toLowerCase().trim();
    this.comprasModalFiltradas = base.filter((compra) => {
      const numero = String(compra.numeroCompra || '').toLowerCase();
      const desc = String(compra.descripcion || '').toLowerCase();
      const idC = String(compra.idCompra || '').toLowerCase();
      return (
        numero.includes(searchTerm) || desc.includes(searchTerm) || idC.includes(searchTerm)
      );
    });
  }

  onCompraModalSearchFocus(): void {
    this.mostrarDropdownComprasModal = true;
    this.filtrarComprasModal();
  }

  onCompraModalBlur(): void {
    setTimeout(() => {
      this.mostrarDropdownComprasModal = false;
      this.changeDetectorRef.markForCheck();
    }, 200);
  }

  seleccionarCompraModal(compra: CompraDTO): void {
    if (compra?.idCompra == null) {
      return;
    }
    this.activoForm.patchValue({ idNumeroCompra: compra.idCompra }, { emitEvent: false });
    this.compraModalSearchTerm = String(compra.numeroCompra ?? '');
    this.itemModalDisplayTerm = '';
    this.entregaModalDisplayTerm = '';
    this.mostrarDropdownComprasModal = false;
    this.comprasModalFiltradas = [];
    this.onCompraChange(compra.idCompra);
  }

  esCompraSeleccionadaEnModal(compra: CompraDTO): boolean {
    const raw = this.activoForm.get('idNumeroCompra')?.value as string | number | null | undefined;
    if (raw === '' || raw === null || raw === undefined) {
      return false;
    }
    const id = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    return Number.isFinite(id) && Number(compra.idCompra) === id;
  }

  limpiarSeleccionCompraModal(): void {
    this.compraModalSearchTerm = '';
    this.itemModalDisplayTerm = '';
    this.entregaModalDisplayTerm = '';
    this.comprasModalFiltradas = [];
    this.mostrarDropdownComprasModal = false;
    this.activoForm.patchValue({ idNumeroCompra: '' }, { emitEvent: true });
  }

  private sublabelEntregaModal(entrega: EntregaDTO): string | undefined {
    const partes: string[] = [];
    const desc = (entrega.descripcion || '').trim();
    if (desc) {
      partes.push(desc);
    }
    if (entrega.cantidad != null) {
      partes.push(`Cant.: ${entrega.cantidad}`);
    }
    return partes.length > 0 ? partes.join(' · ') : undefined;
  }

  etiquetaItemModal(lote: LoteDTO | null): string {
    if (!lote) {
      return '';
    }
    const nombre = (lote.nombreItem || '').trim();
    return nombre || `Ítem #${lote.idItem}`;
  }

  etiquetaEntregaModal(entrega: EntregaDTO | null): string {
    if (!entrega) {
      return '';
    }
    if (entrega.fechaPedido) {
      return this.formatearFecha(entrega.fechaPedido);
    }
    const desc = (entrega.descripcion || '').trim();
    if (desc) {
      return desc;
    }
    return entrega.idEntrega != null ? `Entrega #${entrega.idEntrega}` : '';
  }

  seleccionarItemModal(lote: LoteDTO): void {
    if (lote?.idItem == null) {
      return;
    }
    const itemControl = this.activoForm.get('idItem');
    itemControl?.enable({ emitEvent: false });
    itemControl?.setValue(lote.idItem, { emitEvent: false });
    this.itemModalDisplayTerm = this.etiquetaItemModal(lote);
    this.onItemChange(lote.idItem);
  }

  seleccionarEntregaModal(entrega: EntregaDTO): void {
    if (entrega?.idEntrega == null) {
      return;
    }
    const entregaControl = this.activoForm.get('idEntrega');
    entregaControl?.enable({ emitEvent: false });
    entregaControl?.setValue(entrega.idEntrega, { emitEvent: false });
    this.entregaModalDisplayTerm = this.etiquetaEntregaModal(entrega);
  }

  private syncItemModalDisplayFromForm(): void {
    const raw = this.activoForm.get('idItem')?.value as string | number | null | undefined;
    if (raw === '' || raw == null) {
      this.itemModalDisplayTerm = '';
      return;
    }
    const id = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(id)) {
      this.itemModalDisplayTerm = '';
      return;
    }
    const lote =
      this.lotesFiltrados.find((l) => Number(l.idItem) === id) ??
      this.lotesList.find((l) => Number(l.idItem) === id) ??
      null;
    this.itemModalDisplayTerm = lote ? this.etiquetaItemModal(lote) : '';
  }

  private syncEntregaModalDisplayFromForm(): void {
    const raw = this.activoForm.get('idEntrega')?.value as string | number | null | undefined;
    if (raw === '' || raw == null) {
      this.entregaModalDisplayTerm = '';
      return;
    }
    const id = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(id)) {
      this.entregaModalDisplayTerm = '';
      return;
    }
    const entrega =
      this.entregasFiltradas.find((e) => Number(e.idEntrega) === id) ??
      this.entregasList.find((e) => Number(e.idEntrega) === id) ??
      null;
    this.entregaModalDisplayTerm = entrega ? this.etiquetaEntregaModal(entrega) : '';
  }

  private getCompraIdFromForm(): number | null {
    const raw = this.activoForm.getRawValue().idNumeroCompra as string | number | null | undefined;
    if (raw === '' || raw == null) {
      return null;
    }
    const id = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    return Number.isFinite(id) ? id : null;
  }

  private getItemIdFromForm(): number | null {
    const raw = this.activoForm.getRawValue().idItem as string | number | null | undefined;
    if (raw === '' || raw == null) {
      return null;
    }
    const id = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    return Number.isFinite(id) ? id : null;
  }

  abrirPickerItem(): void {
    if (!this.tieneCompraSeleccionada()) {
      this.notificationService.showWarning(
        'Ítem',
        'Seleccione primero una compra para ver los ítems disponibles.'
      );
      return;
    }
    if (this.lotesFiltrados.length === 0) {
      this.notificationService.showWarning(
        'Ítem',
        'No hay ítems disponibles para la compra seleccionada.'
      );
      return;
    }
    const items: SearchListPickerItem<LoteDTO>[] = this.lotesFiltrados.map((lote) => ({
      id: String(lote.idItem ?? ''),
      label: this.etiquetaItemModal(lote),
      sublabel: lote.descripcion?.trim() || undefined,
      iconClass: 'fa-box',
      data: lote
    }));
    const raw = this.activoForm.get('idItem')?.value;
    const selectedId = raw !== '' && raw != null ? String(raw) : null;
    this.openSearchListPicker<LoteDTO>({
      title: 'Seleccionar ítem',
      searchPlaceholder: 'Buscar por nombre o descripción…',
      items,
      selectedId
    }).then((lote) => {
      if (lote === undefined) {
        return;
      }
      if (lote === null || lote.idItem == null) {
        return;
      }
      this.seleccionarItemModal(lote);
    });
  }

  abrirPickerEntrega(): void {
    if (!this.tieneItemSeleccionado()) {
      this.notificationService.showWarning(
        'Entrega',
        'Seleccione primero un ítem para ver las entregas disponibles.'
      );
      return;
    }
    if (this.entregasFiltradas.length === 0) {
      this.notificationService.showWarning(
        'Entrega',
        'No hay entregas disponibles para el ítem seleccionado.'
      );
      return;
    }
    const items: SearchListPickerItem<EntregaDTO>[] = this.entregasFiltradas.map((entrega) => ({
      id: String(entrega.idEntrega ?? ''),
      label: this.etiquetaEntregaModal(entrega),
      sublabel: this.sublabelEntregaModal(entrega),
      iconClass: 'fa-truck',
      data: entrega
    }));
    const raw = this.activoForm.get('idEntrega')?.value;
    const selectedId = raw !== '' && raw != null ? String(raw) : null;
    this.openSearchListPicker<EntregaDTO>({
      title: 'Seleccionar entrega',
      searchPlaceholder: 'Buscar por fecha o descripción…',
      items,
      selectedId
    }).then((entrega) => {
      if (entrega === undefined) {
        return;
      }
      if (entrega === null || entrega.idEntrega == null) {
        return;
      }
      this.seleccionarEntregaModal(entrega);
    });
  }

  private syncCompraModalSearchFromForm(): void {
    const raw = this.activoForm.get('idNumeroCompra')?.value as string | number | null | undefined;
    if (raw === '' || raw === null || raw === undefined) {
      this.compraModalSearchTerm = '';
      this.comprasModalFiltradas = [];
      return;
    }
    const id = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(id)) {
      this.compraModalSearchTerm = '';
      this.comprasModalFiltradas = [];
      return;
    }
    const compra = this.comprasList.find((c) => Number(c.idCompra) === id) ?? null;
    this.compraModalSearchTerm = compra ? String(compra.numeroCompra ?? '') : '';
    this.filtrarComprasModal();
  }

  etiquetaUbicacionModal(u: UbicacionDTO | null): string {
    if (!u) {
      return '';
    }
    const ger = (u.nombreGerencia || '').trim();
    const ofi = (u.nombreOficina || '').trim();
    const dep = (u.departamento || '').trim();
    const ciu = (u.ciudad || '').trim();
    const base = [ger, ofi].filter(Boolean).join(' — ');
    if (base && ciu) {
      return `${base} (${ciu})`;
    }
    if (base) {
      return base;
    }
    const loc = [dep, ciu].filter(Boolean).join(' — ');
    if (loc) {
      return loc;
    }
    if (ciu) {
      return ciu;
    }
    return `#${u.id}`;
  }

  filtrarUbicacionesParaModal(term: string): UbicacionDTO[] {
    const t = term.trim().toLowerCase();
    const n = (s: string | null | undefined) => (s || '').toLowerCase();
    const lista = !t.length
      ? this.ubicacionesList
      : this.ubicacionesList.filter(
          (u) =>
            n(u.nombreGerencia).includes(t) ||
            n(u.nombreOficina).includes(t) ||
            n(u.ciudad).includes(t) ||
            n(u.departamento).includes(t) ||
            String(u.id ?? '').includes(t)
        );
    return lista.slice(0, 200);
  }

  filtrarUbicacionesModal(): void {
    this.ubicacionesModalFiltradas = this.filtrarUbicacionesParaModal(this.ubicacionModalSearchTerm);
  }

  onUbicacionModalSearchFocus(): void {
    this.mostrarDropdownUbicacionesModal = true;
    this.filtrarUbicacionesModal();
  }

  onUbicacionModalBlur(): void {
    setTimeout(() => {
      this.mostrarDropdownUbicacionesModal = false;
      this.changeDetectorRef.markForCheck();
    }, 200);
  }

  seleccionarUbicacionModal(u: UbicacionDTO): void {
    if (u?.id == null) {
      return;
    }
    this.activoForm.patchValue({ idUbicacion: String(u.id) }, { emitEvent: true });
    this.ubicacionModalSearchTerm = this.etiquetaUbicacionModal(u);
    this.mostrarDropdownUbicacionesModal = false;
    this.ubicacionesModalFiltradas = [];
  }

  esUbicacionSeleccionadaEnModal(u: UbicacionDTO): boolean {
    const raw = this.activoForm.get('idUbicacion')?.value as string | number | null | undefined;
    if (raw === '' || raw === null || raw === undefined) {
      return false;
    }
    const id = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    return Number.isFinite(id) && Number(u.id) === id;
  }

  limpiarSeleccionUbicacionModal(): void {
    this.ubicacionModalSearchTerm = '';
    this.ubicacionesModalFiltradas = [];
    this.mostrarDropdownUbicacionesModal = false;
    this.activoForm.patchValue({ idUbicacion: '' }, { emitEvent: true });
  }

  private syncUbicacionModalSearchFromForm(): void {
    const raw = this.activoForm.get('idUbicacion')?.value as string | number | null | undefined;
    if (raw === '' || raw === null || raw === undefined) {
      this.ubicacionModalSearchTerm = '';
      this.ubicacionesModalFiltradas = [];
      return;
    }
    const id = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(id)) {
      this.ubicacionModalSearchTerm = '';
      this.ubicacionesModalFiltradas = [];
      return;
    }
    const ubicacion = this.ubicacionesList.find((u) => Number(u.id) === id) ?? null;
    this.ubicacionModalSearchTerm = ubicacion ? this.etiquetaUbicacionModal(ubicacion) : '';
    this.filtrarUbicacionesModal();
  }

  etiquetaServicioGarantiaModal(sg: ServicioGarantiaDTO | null): string {
    if (!sg) {
      return '';
    }
    const com = (sg.nombreComercial || '').trim();
    if (com) {
      return com;
    }
    const nom = (sg.nombre || '').trim();
    if (nom) {
      return nom;
    }
    return `#${sg.idServicioGarantia}`;
  }

  filtrarServiciosGarantiaParaModal(term: string): ServicioGarantiaDTO[] {
    const t = term.trim().toLowerCase();
    const n = (s: string | null | undefined) => (s || '').toLowerCase();
    const lista = !t.length
      ? this.serviciosGarantiaList
      : this.serviciosGarantiaList.filter(
          (sg) =>
            n(sg.nombreComercial).includes(t) ||
            n(sg.nombre).includes(t) ||
            n(sg.ruc).includes(t) ||
            n(sg.correoDeContacto).includes(t) ||
            n(sg.telefonoDeContacto).includes(t) ||
            String(sg.idServicioGarantia ?? '').includes(t)
        );
    return lista.slice(0, 200);
  }

  filtrarServiciosGarantiaModal(): void {
    this.serviciosGarantiaModalFiltrados = this.filtrarServiciosGarantiaParaModal(this.servicioGarantiaModalSearchTerm);
  }

  onServicioGarantiaModalSearchFocus(): void {
    this.mostrarDropdownServiciosGarantiaModal = true;
    this.filtrarServiciosGarantiaModal();
  }

  onServicioGarantiaModalBlur(): void {
    setTimeout(() => {
      this.mostrarDropdownServiciosGarantiaModal = false;
      this.changeDetectorRef.markForCheck();
    }, 200);
  }

  seleccionarServicioGarantiaModal(sg: ServicioGarantiaDTO): void {
    if (sg?.idServicioGarantia == null) {
      return;
    }
    this.activoForm.patchValue({ idServicioGarantia: String(sg.idServicioGarantia) }, { emitEvent: true });
    this.servicioGarantiaModalSearchTerm = this.etiquetaServicioGarantiaModal(sg);
    this.mostrarDropdownServiciosGarantiaModal = false;
    this.serviciosGarantiaModalFiltrados = [];
  }

  esServicioGarantiaSeleccionadoEnModal(sg: ServicioGarantiaDTO): boolean {
    const raw = this.activoForm.get('idServicioGarantia')?.value as string | number | null | undefined;
    if (raw === '' || raw === null || raw === undefined) {
      return false;
    }
    const id = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    return Number.isFinite(id) && Number(sg.idServicioGarantia) === id;
  }

  limpiarSeleccionServicioGarantiaModal(): void {
    this.servicioGarantiaModalSearchTerm = '';
    this.serviciosGarantiaModalFiltrados = [];
    this.mostrarDropdownServiciosGarantiaModal = false;
    this.activoForm.patchValue({ idServicioGarantia: '' }, { emitEvent: true });
  }

  private syncServicioGarantiaModalSearchFromForm(): void {
    const raw = this.activoForm.get('idServicioGarantia')?.value as string | number | null | undefined;
    if (raw === '' || raw === null || raw === undefined) {
      this.servicioGarantiaModalSearchTerm = '';
      this.serviciosGarantiaModalFiltrados = [];
      return;
    }
    const id = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(id)) {
      this.servicioGarantiaModalSearchTerm = '';
      this.serviciosGarantiaModalFiltrados = [];
      return;
    }
    const sg =
      this.serviciosGarantiaList.find((s) => Number(s.idServicioGarantia) === id) ?? null;
    this.servicioGarantiaModalSearchTerm = sg ? this.etiquetaServicioGarantiaModal(sg) : '';
    this.filtrarServiciosGarantiaModal();
  }

  private readonly searchPickerModalOptions: NgbModalOptions = {
    size: 'lg',
    centered: true,
    scrollable: true,
    backdrop: true,
    modalDialogClass: 'search-list-picker-dialog'
  };

  private openSearchListPicker<T>(config: {
    title: string;
    searchPlaceholder: string;
    items: SearchListPickerItem<T>[];
    allowClear?: boolean;
    clearLabel?: string;
    selectedId?: string | null;
  }): Promise<T | null | undefined> {
    const ref = this.modalService.open(SearchListPickerModalComponent<T>, this.searchPickerModalOptions);
    ref.componentInstance.title = config.title;
    ref.componentInstance.searchPlaceholder = config.searchPlaceholder;
    ref.componentInstance.items = config.items;
    ref.componentInstance.allowClear = config.allowClear ?? false;
    if (config.clearLabel) {
      ref.componentInstance.clearLabel = config.clearLabel;
    }
    ref.componentInstance.selectedId = config.selectedId ?? null;
    return ref.result.then(
      (value) => value as T | null,
      () => undefined
    );
  }

  abrirPickerCompra(): void {
    const items: SearchListPickerItem<CompraDTO>[] = this.comprasListOrdenadasModal.map((c) => ({
      id: String(c.idCompra ?? ''),
      label: `Compra ${c.numeroCompra ?? c.idCompra}`,
      sublabel: c.descripcion?.trim() || undefined,
      iconClass: 'fa-shopping-cart',
      data: c
    }));
    const raw = this.activoForm.get('idNumeroCompra')?.value;
    const selectedId = raw !== '' && raw != null ? String(raw) : null;
    this.openSearchListPicker<CompraDTO>({
      title: 'Seleccionar compra',
      searchPlaceholder: 'Buscar por número, descripción o ID…',
      items,
      selectedId
    }).then((compra) => {
      if (compra === undefined) {
        return;
      }
      if (compra === null || compra.idCompra == null) {
        this.limpiarSeleccionCompraModal();
        return;
      }
      this.seleccionarCompraModal(compra);
    });
  }

  abrirPickerUbicacion(): void {
    const items: SearchListPickerItem<UbicacionDTO>[] = this.ubicacionesList.map((u) => ({
      id: String(u.id ?? ''),
      label: this.etiquetaUbicacionModal(u),
      sublabel: [u.ciudad, u.departamento].filter(Boolean).join(' — ') || undefined,
      iconClass: 'fa-map-marker-alt',
      data: u
    }));
    const raw = this.activoForm.get('idUbicacion')?.value;
    const selectedId = raw !== '' && raw != null ? String(raw) : null;
    this.openSearchListPicker<UbicacionDTO>({
      title: 'Seleccionar ubicación',
      searchPlaceholder: 'Buscar por gerencia, oficina, ciudad…',
      items,
      allowClear: true,
      clearLabel: 'Sin ubicación',
      selectedId
    }).then((ubicacion) => {
      if (ubicacion === undefined) {
        return;
      }
      if (ubicacion === null) {
        this.limpiarSeleccionUbicacionModal();
        return;
      }
      this.seleccionarUbicacionModal(ubicacion);
    });
  }

  abrirPickerServicioGarantia(): void {
    const items: SearchListPickerItem<ServicioGarantiaDTO>[] = this.serviciosGarantiaList.map((sg) => ({
      id: String(sg.idServicioGarantia ?? ''),
      label: this.etiquetaServicioGarantiaModal(sg),
      sublabel: sg.ruc?.trim() ? `RUC ${sg.ruc.trim()}` : undefined,
      iconClass: 'fa-shield-alt',
      data: sg
    }));
    const raw = this.activoForm.get('idServicioGarantia')?.value;
    const selectedId = raw !== '' && raw != null ? String(raw) : null;
    this.openSearchListPicker<ServicioGarantiaDTO>({
      title: 'Seleccionar servicio de garantía',
      searchPlaceholder: 'Buscar por nombre comercial, razón social o RUC…',
      items,
      selectedId
    }).then((sg) => {
      if (sg === undefined) {
        return;
      }
      if (sg === null || sg.idServicioGarantia == null) {
        this.limpiarSeleccionServicioGarantiaModal();
        return;
      }
      this.seleccionarServicioGarantiaModal(sg);
    });
  }

  private activosElegiblesParaRelacionModal(): ActivoDTO[] {
    const selfId =
      this.modoEdicion && this.activoSeleccionado?.idActivo != null
        ? this.activoSeleccionado.idActivo
        : null;
    return this.activos
      .filter(
        (a) =>
          !this.selectedRelatedAssets.includes(a.idActivo) &&
          (selfId == null || a.idActivo !== selfId)
      )
      .sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'es', { numeric: true, sensitivity: 'base' })
      );
  }

  private etiquetaActivoRelacionadoPicker(activo: ActivoDTO): string {
    const partes: string[] = [`ID ${activo.idActivo}`];
    if (activo.idSecundario?.trim()) {
      partes.push(`Sec. ${activo.idSecundario.trim()}`);
    }
    return partes.join(' · ');
  }

  abrirPickerRelacionado(): void {
    const elegibles = this.activosElegiblesParaRelacionModal();
    if (elegibles.length === 0) {
      this.notificationService.showWarning(
        'Activos relacionados',
        'No hay más activos disponibles para vincular.'
      );
      return;
    }
    const items: SearchListPickerItem<ActivoDTO>[] = elegibles.map((activo) => ({
      id: String(activo.idActivo),
      label: activo.name?.trim() || `Activo #${activo.idActivo}`,
      sublabel: this.etiquetaActivoRelacionadoPicker(activo),
      iconClass: 'fa-link',
      data: activo
    }));
    this.openSearchListPicker<ActivoDTO>({
      title: 'Agregar activo relacionado',
      searchPlaceholder: 'Buscar por número de equipo, ID o ID secundario…',
      items,
      selectedId: null
    }).then((activo) => {
      if (activo === undefined || activo === null || activo.idActivo == null) {
        return;
      }
      this.addRelatedAsset(activo.idActivo);
    });
  }

  private resolverIdTipoActivoDesktop(): number | null {
    for (const tipo of this.tiposActivoList) {
      const desc = (tipo.descripcion || '').toLowerCase();
      const nom = (tipo.nombre || '').toLowerCase();
      if (/\bdesktop\b/i.test(desc) || /\bdesktop\b/i.test(nom)) {
        return tipo.idActivo;
      }
    }
    return null;
  }

  private resolverIdUsuarioCarlosMorey(): number | null {
    for (const u of this.usuarios.values()) {
      const nom = (u.nombre || '').toLowerCase().trim();
      const ape = (u.apellido || '').toLowerCase().trim();
      if (nom.includes('carlos') && ape.includes('morey')) {
        return u.idUsuario;
      }
    }
    return null;
  }

  /** Solo creación nueva: valores por defecto (no editables en el modal de alta). */
  private aplicarValoresPorDefectoNuevoActivo(): void {
    this.activoForm.patchValue(
      {
        clasificacionDeINFO: 'CONFIDENCIAL',
        criticidad: 'MEDIA',
        estado: 'INACTIVO',
        idSecundario: '0'
      },
      { emitEvent: false }
    );

    const idDesktop = this.resolverIdTipoActivoDesktop();
    if (idDesktop != null) {
      this.activoForm.patchValue({ idTipoActivo: idDesktop }, { emitEvent: true });
    } else {
      this.onTipoActivoChange(this.activoForm.get('idTipoActivo')?.value);
    }
  }

  /** Datos del formulario incluyendo controles deshabilitados (p. ej. responsable en alta). */
  private getActivoFormData(): ActivoFormRaw {
    const raw = this.activoForm.getRawValue() as ActivoFormRaw;
    if (!this.modoEdicion) {
      if (!raw.clasificacionDeINFO) {
        raw.clasificacionDeINFO = 'CONFIDENCIAL';
      }
      if (!raw.criticidad) {
        raw.criticidad = 'MEDIA';
      }
      if (!raw.idSecundario) {
        raw.idSecundario = '0';
      }
    }
    return raw;
  }

  private parseFormInt(value: string | number | null | undefined): number {
    if (typeof value === 'number') {
      return value;
    }
    return Number.parseInt(String(value ?? ''), 10);
  }

  verDetallesCompra(idCompra: number, compraModal: any) {
    const compra = this.compras.get(idCompra);
    if (compra) {
      this.compraSeleccionada = compra;
      
      // Cargar lotes de la compra
      this.lotesService.getLotesByCompra(idCompra).subscribe({
        next: (lotes) => {
          this.lotesDetalles = lotes;
          
          // Cargar entregas de todos los lotes
          const entregasObservables = lotes.map(lote => 
            this.entregasService.getEntregasByItem(lote.idItem).toPromise()
          );
          
          Promise.all(entregasObservables).then(entregasPorLote => {
            this.entregasDetalles = entregasPorLote.flat().filter(e => !!e);
            this.changeDetectorRef.detectChanges();
          });
        },
        error: (error) => {
          console.error('Error al cargar los detalles de la compra:', error);
          this.lotesDetalles = [];
          this.entregasDetalles = [];
        }
      });
      
      this.modalService.open(compraModal, { 
        size: 'xl', 
        backdrop: 'static',
        keyboard: false,
        centered: true
      });
    }
  }

  // Métodos auxiliares para el modal de detalles de compra
  formatearMoneda(monto: number, moneda: string): string {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto);
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return 'No disponible';
    const date = new Date(fecha);
    const dia = date.getDate().toString().padStart(2, '0');
    const mes = (date.getMonth() + 1).toString().padStart(2, '0');
    const año = date.getFullYear();
    return `${dia}/${mes}/${año}`;
  }

  getTipoCompraDescripcion(idTipoCompra: number): string {
    // Por ahora retornamos el ID, pero podrías implementar la lógica completa
    return `Tipo ${idTipoCompra}`;
  }

  getProveedorNombre(idProveedor: number): string {
    // Por ahora retornamos el ID, pero podrías implementar la lógica completa
    return `Proveedor ${idProveedor}`;
  }

  getServicioGarantiaNombre(idServicio: number): string {
    // Por ahora retornamos el ID, pero podrías implementar la lógica completa
    return `Servicio ${idServicio}`;
  }

  getLoteNombre(idItem: number): string {
    const lote = this.lotesDetalles.find(l => l.idItem === idItem);
    return lote ? lote.nombreItem : 'No disponible';
  }

  cargarActivos() {
    this.loading = true;
    this.error = null;
    this.activosService.getActivos().subscribe({
      next: (activos) => {
        console.log('Activos cargados:', activos);
        this.activos = activos;
        this.aplicarTodosLosFiltros();
        this.updateSummary();
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Error al cargar los activos';
        this.loading = false;
        console.error('Error al cargar activos:', error);
      }
    });
  }

  verDetalles(activo: ActivoDTO): void {
    if (activo?.idActivo == null) {
      return;
    }
    const modalRef = this.modalService.open(ActivoViewModalComponent, {
      size: 'xl',
      scrollable: true,
      centered: true,
      backdrop: true,
      windowClass: 'activo-view-modal-window'
    });
    modalRef.componentInstance.idActivo = activo.idActivo;
  }

  private async actualizarRelaciones(idActivo: number) {
    try {
      // Obtener relaciones actuales
      const relacionesActuales = await firstValueFrom(
        this.activosService.getActivosRelacionados(idActivo)
      );

      // Eliminar relaciones que ya no existen
      for (const idRelacionado of relacionesActuales) {
        if (!this.selectedRelatedAssets.includes(idRelacionado)) {
          await firstValueFrom(
            this.activosService.eliminarRelacion(idActivo, idRelacionado)
          );
        }
      }

      // Agregar nuevas relaciones
      for (const idRelacionado of this.selectedRelatedAssets) {
        if (!relacionesActuales.includes(idRelacionado)) {
          await firstValueFrom(
            this.activosService.agregarRelacion(idActivo, idRelacionado)
          );
        }
      }
    } catch (error) {
      console.error('Error al actualizar relaciones:', error);
      throw error;
    }
  }

  async abrirModal(modal: any, activo?: any) {
    try {
      if (this.ubicacionesList.length === 0) {
        try {
          const ubicaciones = await firstValueFrom(this.ubicacionesService.getUbicaciones());
          this.setUbicacionesDesdeApi(ubicaciones ?? []);
        } catch (e) {
          console.error('Error al cargar ubicaciones:', e);
        }
      }

      this.modoEdicion = !!activo;
      this.activoSeleccionado = activo || null;
      this.errorMessage = null;
      this.successMessage = null;
      
      // Resetear la propiedad para mostrar errores de validación
      this.shouldShowValidationErrors = false;
      
      // Inicializar modo de creación
      this.creationMode = 'single';
      this.rangeStartControl = '';
      this.rangeEndControl = '';

      if (this.modoEdicion && activo) {
        console.log('Datos del activo a editar:', activo);
        console.log('clasificacionDeINFO:', activo.clasificacionDeINFO);
        console.log('estado:', activo.estado);
        
        // Normalizar valores para asegurar que coincidan con las opciones del select
        const clasificacionNormalizada = this.normalizarClasificacion(activo.clasificacionDeINFO);
        const estadoNormalizado = this.normalizarEstado(activo.estado);
        const criticidadNormalizada = this.normalizarCriticidad(activo.criticidad);
        
        console.log('Valores normalizados:', {
          clasificacion: clasificacionNormalizada,
          estado: estadoNormalizado,
          criticidad: criticidadNormalizada
        });
        
        // Cargar datos del activo en el formulario
        this.activoForm.patchValue({
          name: activo.name,
          criticidad: criticidadNormalizada,
          clasificacionDeINFO: clasificacionNormalizada,
          estado: estadoNormalizado,
          idTipoActivo: activo.idTipoActivo,
          idNumeroCompra: activo.idNumeroCompra,
          idItem: activo.idItem,
          idEntrega: activo.idEntrega,
          idUbicacion: activo.idUbicacion,
          idUsuario: activo.idUsuario,
          idSecundario: activo.idSecundario,
          idServicioGarantia: activo.idServicioGarantia,
          fechaFinGarantia: activo.fechaFinGarantia
        });

        // Cargar lotes filtrados para la compra del activo
        if (activo.idNumeroCompra) {
          this.onCompraChange(activo.idNumeroCompra);
        }

        // Cargar entregas filtradas para el item del activo
        if (activo.idItem) {
          this.onItemChange(activo.idItem);
        }

        // Cargar usuario automáticamente basado en el tipo de activo
        if (activo.idTipoActivo) {
          this.onTipoActivoChange(activo.idTipoActivo);
        }
        this.activoForm.get('idUsuario')?.enable({ emitEvent: false });

        console.log('Valores del formulario después de patchValue:', this.activoForm.value);

        this.syncCompraModalSearchFromForm();
        this.syncItemModalDisplayFromForm();
        this.syncEntregaModalDisplayFromForm();
        this.syncUbicacionModalSearchFromForm();
        this.syncServicioGarantiaModalSearchFromForm();

        // Forzar la detección de cambios
        this.changeDetectorRef.detectChanges();

        // Cargar activos relacionados
        try {
          const activosRelacionados = await firstValueFrom(
            this.activosService.getActivosRelacionados(activo.idActivo)
          );
          this.selectedRelatedAssets = activosRelacionados || [];
          console.log('Activos relacionados cargados:', this.selectedRelatedAssets);
        } catch (error) {
          console.error('Error al cargar activos relacionados:', error);
          this.selectedRelatedAssets = [];
        }
      } else {
        this.activoForm.reset();
        this.compraModalSearchTerm = '';
        this.itemModalDisplayTerm = '';
        this.entregaModalDisplayTerm = '';
        this.comprasModalFiltradas = [];
        this.mostrarDropdownComprasModal = false;
        this.ubicacionModalSearchTerm = '';
        this.ubicacionesModalFiltradas = [];
        this.mostrarDropdownUbicacionesModal = false;
        this.servicioGarantiaModalSearchTerm = '';
        this.serviciosGarantiaModalFiltrados = [];
        this.mostrarDropdownServiciosGarantiaModal = false;
        this.selectedRelatedAssets = [];
        // Deshabilitar campos dependientes al inicio
        this.activoForm.get('idItem')?.disable();
        this.activoForm.get('idEntrega')?.disable();
        this.aplicarValoresPorDefectoNuevoActivo();
      }

      const esModalActivo = modal === this.activoModalTemplate;

      if (esModalActivo) {
        if (this.activoModalBodyZoomSuspendCount++ === 0) {
          this.documentRef.body.classList.add('no-global-zoom');
        }
      }

      const modalOpts: NgbModalOptions = {
        size: 'xl',
        /** En edición no cerrar por clic fuera (evita pérdida de cambios). Alta sigue igual que antes. */
        backdrop: this.modoEdicion ? 'static' : true,
        keyboard: false,
        centered: true
      };
      if (esModalActivo) {
        modalOpts.modalDialogClass = 'activo-form-modal-dialog-layout';
        modalOpts.windowClass = 'activo-form-modal-window';
        modalOpts.scrollable = true;
      }
      const modalRef = this.modalService.open(modal, modalOpts);

      if (esModalActivo) {
        modalRef.hidden.pipe(take(1)).subscribe(() => {
          this.activoModalBodyZoomSuspendCount = Math.max(0, this.activoModalBodyZoomSuspendCount - 1);
          if (this.activoModalBodyZoomSuspendCount === 0) {
            this.documentRef.body.classList.remove('no-global-zoom');
          }
        });
      }

      modalRef.result.then(() => {
        // Modal cerrado exitosamente
        this.shouldShowValidationErrors = false;
      }).catch(() => {
        // Modal cerrado con escape o clic fuera
        this.shouldShowValidationErrors = false;
      });
    } catch (error) {
      console.error('Error al abrir el modal:', error);
      this.errorMessage = 'Error al cargar los datos necesarios. Por favor, intente nuevamente.';
    }
  }


  private normalizarClasificacion(clasificacion: string): string {
    if (!clasificacion) return '';
    
    const clasificacionUpper = clasificacion.toUpperCase().trim();
    if (clasificacionUpper.includes('CONFIDENCIAL')) return 'CONFIDENCIAL';
    if (clasificacionUpper.includes('NO CONFIDENCIAL') || clasificacionUpper.includes('NO CONFIDENCIAL')) return 'NO CONFIDENCIAL';
    if (clasificacionUpper.includes('PUBLICA') || clasificacionUpper.includes('PÚBLICA')) return 'PUBLICA';
    
    return clasificacionUpper;
  }

  private normalizarEstado(estado: string): string {
    if (!estado) return '';
    
    const estadoUpper = estado.toUpperCase().trim();
    if (estadoUpper.includes('ACTIVO')) return 'ACTIVO';
    if (estadoUpper.includes('INACTIVO')) return 'INACTIVO';
    if (estadoUpper.includes('MANTENIMIENTO')) return 'MANTENIMIENTO';
    
    return estadoUpper;
  }

  private normalizarCriticidad(criticidad: string): string {
    if (!criticidad) return '';
    
    const criticidadUpper = criticidad.toUpperCase().trim();
    if (criticidadUpper.includes('ALTA')) return 'ALTA';
    if (criticidadUpper.includes('MEDIA')) return 'MEDIA';
    if (criticidadUpper.includes('BAJA')) return 'BAJA';
    
    return criticidadUpper;
  }

  addRelatedAsset(idActivo: number | null) {
    if (!idActivo) return;

    if (!this.selectedRelatedAssets.includes(idActivo)) {
      this.selectedRelatedAssets.push(idActivo);
    }
  }

  removeRelatedAsset(idActivo: number) {
    this.selectedRelatedAssets = this.selectedRelatedAssets.filter(id => id !== idActivo);
  }

  getAssetDescription(idActivo: number): string {
    const activo = this.activos.find(a => a.idActivo === idActivo);
    if (!activo) return `Activo #${idActivo}`;
    return `#${idActivo} - ${activo.name}`;
  }

  async guardarActivo() {
    if (this.isActivoSubmitBlockedByInventoryTour()) {
      return;
    }
    console.log('Método guardarActivo llamado');
    console.log('Modo de creación:', this.creationMode);
    
    // Marcar todos los campos como touched para mostrar errores de validación
    this.markAllFieldsAsTouched();
    
    // Validar según el modo seleccionado
    if (this.creationMode === 'single') {
      // En modo individual, validar el formulario completo
      if (!this.activoForm.valid) {
        console.log('Formulario no válido, mostrando errores...');
        this.shouldShowValidationErrors = true;
        return;
      }
    } else if (this.creationMode === 'range') {
      // En modo rango, validar solo los campos relevantes (excluyendo 'name')
      const camposRequeridos = ['idTipoActivo', 'clasificacionDeINFO', 'criticidad', 'estado', 
                                'idNumeroCompra', 'idItem', 'idEntrega', 'idUsuario', 
                                'idSecundario', 'idServicioGarantia', 'fechaFinGarantia'];
      
      let formularioValido = true;
      for (const campo of camposRequeridos) {
        const control = this.activoForm.get(campo);
        if (control && control.errors?.['required']) {
          formularioValido = false;
          break;
        }
      }
      
      if (!formularioValido) {
        console.log('Formulario no válido en modo rango, mostrando errores...');
        this.shouldShowValidationErrors = true;
        return;
      }
    }
    
    // Validaciones adicionales para modo rango
    if (this.creationMode === 'range') {
      if (!this.rangeStartControl || !this.rangeEndControl) {
        this.errorMessage = 'Debe especificar el rango de nombres (inicio y fin)';
        setTimeout(() => this.errorMessage = null, 5000);
        return;
      }
      
      // Validar formato de los rangos
      const formatValidation = this.validateRangeFormat();
      if (!formatValidation.isValid) {
        this.errorMessage = formatValidation.errorMessage;
        setTimeout(() => this.errorMessage = null, 5000);
        return;
      }
      
      const rangeInfo = this.getRangeInfo();
      if (!rangeInfo.isValid || rangeInfo.count <= 0) {
        this.errorMessage = 'El nombre inicial debe ser menor al nombre final';
        setTimeout(() => this.errorMessage = null, 5000);
        return;
      }
    }
    
    if (this.creationMode === 'range') {
      await this.guardarActivosPorRango();
    } else {
      await this.guardarActivoIndividual();
    }
  }

  markAllFieldsAsTouched() {
    if (this.creationMode === 'single') {
      // En modo individual, marcar todos los campos como touched
      Object.keys(this.activoForm.controls).forEach(key => {
        const control = this.activoForm.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
    } else if (this.creationMode === 'range') {
      // En modo rango, marcar solo los campos relevantes (excluyendo 'name')
      const camposRequeridos = ['idTipoActivo', 'clasificacionDeINFO', 'criticidad', 'estado', 
                                'idNumeroCompra', 'idItem', 'idEntrega', 'idUsuario', 
                                'idSecundario', 'idServicioGarantia', 'fechaFinGarantia'];
      
      camposRequeridos.forEach(campo => {
        const control = this.activoForm.get(campo);
        if (control) {
          control.markAsTouched();
        }
      });
    }
    
    // Activar la visualización de errores de validación
    this.shouldShowValidationErrors = true;
  }

  showValidationErrors() {
    // Mostrar mensaje de error con detalles
    const erroresDetallados: string[] = [];
    Object.keys(this.activoForm.controls).forEach(key => {
      const control = this.activoForm.get(key);
      if (control?.errors) {
        console.log(`Errores en ${key}:`, control.errors);
        if (control.errors['required']) {
          // No mostrar error del campo 'name' si está en modo rango
          if (key === 'name' && this.creationMode === 'range') {
            return;
          }
          erroresDetallados.push(`El campo "${this.getFieldDisplayName(key)}" es requerido`);
        }
      }
    });
    
    if (erroresDetallados.length > 0) {
      this.errorMessage = `Por favor complete los siguientes campos requeridos:\n${erroresDetallados.join('\n')}`;
      setTimeout(() => this.errorMessage = null, 5000);
    }
  }

    async guardarActivoIndividual() {
    console.log('Formulario válido:', this.activoForm.valid);
    console.log('Valores del formulario:', this.activoForm.value);
    
    // El formulario ya fue validado en guardarActivo()
    const formData = this.getActivoFormData();
    const nombreActivoNormalizado = String(formData.name || '').trim().toUpperCase();

    const existeDuplicado = this.isNombreActivoDuplicado(nombreActivoNormalizado);

    if (existeDuplicado) {
      this.setNameDuplicateError(true);
      this.shouldShowValidationErrors = true;
      return;
    }
    
    // Obtener el idUsuario correcto
    const idUsuario = this.getUserIdFromForm(formData);
    console.log('ID Usuario a usar:', idUsuario);
    
    const activo: ActivoDTO = {
      idActivo: this.modoEdicion && this.activoSeleccionado ? this.activoSeleccionado.idActivo : 0,
      name: formData.name,
      criticidad: formData.criticidad,
      clasificacionDeINFO: formData.clasificacionDeINFO,
      estado: formData.estado,
      idTipoActivo: this.parseFormInt(formData.idTipoActivo),
      idNumeroCompra: this.parseFormInt(formData.idNumeroCompra),
      idItem: this.parseFormInt(formData.idItem),
      idEntrega: this.parseFormInt(formData.idEntrega),
      idUbicacion: formData.idUbicacion != null && formData.idUbicacion !== ''
        ? this.parseFormInt(formData.idUbicacion)
        : null,
      idUsuario: idUsuario,
      idSecundario: formData.idSecundario,
      idServicioGarantia: this.parseFormInt(formData.idServicioGarantia),
      fechaFinGarantia: formData.fechaFinGarantia
    };

    console.log('Datos a enviar:', activo);

    try {
      if (this.modoEdicion && this.activoSeleccionado) {
        console.log('Actualizando activo existente');
        await firstValueFrom(this.activosService.actualizarActivo(this.activoSeleccionado.idActivo, activo));
        await this.actualizarRelaciones(this.activoSeleccionado.idActivo);
        
        this.modalService.dismissAll();
        this.shouldShowValidationErrors = false; // Resetear visualización de errores
        this.cargarActivos();
        this.successMessage = 'Activo actualizado con éxito';
        setTimeout(() => this.successMessage = null, 3000);
      } else {
        console.log('Creando nuevo activo');
        const response = await firstValueFrom(this.activosService.crearActivo(activo));
        console.log('Respuesta del servidor:', response);
        
        if (response.idActivo) {
          await this.actualizarRelaciones(response.idActivo);
          
          this.modalService.dismissAll();
          this.shouldShowValidationErrors = false; // Resetear visualización de errores
          this.cargarActivos();
          this.successMessage = 'Activo creado con éxito';
          setTimeout(() => this.successMessage = null, 3000);
        }
      }
    } catch (error) {
      console.error('Error al guardar activo:', error);
      this.errorMessage = 'Error al guardar el activo';
      setTimeout(() => this.errorMessage = null, 3000);
    }
  }

  async guardarActivosPorRango() {
    console.log('Iniciando guardarActivosPorRango...');
    
    // Mostrar indicador de progreso
    this.loading = true;
    this.errorMessage = null;
    
    const rangeInfo = this.getRangeInfo();
    console.log('Información del rango:', rangeInfo);
    
    if (!rangeInfo.isValid) {
      console.log('Rango inválido');
      this.errorMessage = 'Rango inválido. Verifique que los nombres tengan el formato PCXXXXX y que el inicio sea menor al final.';
      setTimeout(() => this.errorMessage = null, 5000);
      this.loading = false;
      return;
    }

    if (!this.activoForm.valid) {
      console.log('Formulario inválido');
      this.errorMessage = 'Por favor complete todos los campos requeridos.';
      setTimeout(() => this.errorMessage = null, 3000);
      this.loading = false;
      return;
    }

    const formData = this.getActivoFormData();
    console.log('Datos del formulario:', formData);
    
    const assetNumbers = this.generateAssetNumbers();
    console.log('Números generados:', assetNumbers);
    
    // Verificar si hay números duplicados
    const existingNumbers = assetNumbers.filter(number => this.isAssetNumberExists(number));
    if (existingNumbers.length > 0) {
      console.log('Números duplicados encontrados:', existingNumbers);
      this.errorMessage = `Los siguientes números ya existen: ${existingNumbers.slice(0, 5).join(', ')}${existingNumbers.length > 5 ? '...' : ''}`;
      setTimeout(() => this.errorMessage = null, 5000);
      this.loading = false;
      return;
    }

    try {
      console.log('Preparando activos para crear...');
      
          // Obtener el idUsuario correcto
    const idUsuario = this.getUserIdFromForm(formData);
    console.log('ID Usuario a usar:', idUsuario);
      
      // Crear todos los activos en una sola operación usando el endpoint batch
      const activosToCreate: ActivoDTO[] = assetNumbers.map(assetNumber => ({
        idActivo: 0,
        name: assetNumber,
        criticidad: formData.criticidad,
        clasificacionDeINFO: formData.clasificacionDeINFO,
        estado: formData.estado,
        idTipoActivo: this.parseFormInt(formData.idTipoActivo),
        idNumeroCompra: this.parseFormInt(formData.idNumeroCompra),
        idItem: this.parseFormInt(formData.idItem),
        idEntrega: this.parseFormInt(formData.idEntrega),
        idUbicacion: formData.idUbicacion != null && formData.idUbicacion !== ''
          ? this.parseFormInt(formData.idUbicacion)
          : null,
        idUsuario: idUsuario,
        idSecundario: formData.idSecundario,
        idServicioGarantia: this.parseFormInt(formData.idServicioGarantia),
        fechaFinGarantia: formData.fechaFinGarantia
      }));

      console.log('Activos a crear:', activosToCreate);
      console.log('Llamando al servicio crearActivosBatch...');

      let createdActivos: ActivoDTO[] = [];
      
      try {
        // Intentar crear en batch primero
        createdActivos = await firstValueFrom(this.activosService.crearActivosBatch(activosToCreate));
        console.log('Respuesta del servicio batch:', createdActivos);
      } catch (batchError) {
        console.log('Error en batch, intentando crear uno por uno:', batchError);
        
        // Si falla el batch, crear uno por uno
        createdActivos = [];
        for (const activo of activosToCreate) {
          try {
            const createdActivo = await firstValueFrom(this.activosService.crearActivo(activo));
            createdActivos.push(createdActivo);
            console.log(`Activo creado: ${createdActivo.name}`);
          } catch (individualError) {
            console.error(`Error al crear activo ${activo.name}:`, individualError);
            // Continuar con los siguientes activos
          }
        }
      }

      this.modalService.dismissAll();
      this.shouldShowValidationErrors = false; // Resetear visualización de errores
      this.cargarActivos();
      
      if (createdActivos.length > 0) {
        this.successMessage = `Se crearon exitosamente ${createdActivos.length} de ${assetNumbers.length} activos.`;
        setTimeout(() => this.successMessage = null, 5000);
      } else {
        this.errorMessage = 'No se pudo crear ningún activo. Por favor, intente nuevamente.';
        setTimeout(() => this.successMessage = null, 5000);
      }
      
    } catch (error) {
      console.error('Error al crear activos por rango:', error);
      this.errorMessage = `Error al crear los activos: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      setTimeout(() => this.errorMessage = null, 5000);
    } finally {
      // Ocultar indicador de progreso
      this.loading = false;
    }
  }

  eliminarActivo(activo: any) {
    this.activoAEliminar = activo;
    this.showConfirmDialog = true;
  }

  cancelarEliminacion() {
    this.activoAEliminar = null;
    this.showConfirmDialog = false;
  }

  confirmarEliminacion() {
    console.log('activoAEliminar:', this.activoAEliminar);
    if (this.activoAEliminar) {
      console.log('idActivo:', this.activoAEliminar.idActivo);
      this.activosService.eliminarActivo(this.activoAEliminar.idActivo).subscribe(
        () => {
          this.cargarActivos();
          this.showConfirmDialog = false;
          this.activoAEliminar = null;
        },
        error => {
          console.error('Error al eliminar el activo:', error);
        }
      );
    }
  }



  // Método para cargar hardware
  cargarHardware() {
    this.hardwareService.getHardware().subscribe({
      next: (hardware) => {
        this.hardwareList = hardware;
        this.hardwareByName.clear();
        for (const h of hardware) {
          if (h?.name != null && String(h.name).trim() !== '') {
            this.hardwareByName.set(String(h.name).trim(), h);
          }
        }
      },
      error: (error) => {
        console.error('Error al cargar hardware:', error);
      }
    });
  }

  // Método para cargar lotes
  cargarLotes() {
    this.lotesService.getLotes().subscribe({
      next: (lotes) => {
        this.lotesList = lotes;
        this.lotesFiltrados = []; // Inicializar lotes filtrados vacíos
      },
      error: (error) => {
        console.error('Error al cargar lotes:', error);
      }
    });
  }

  onCompraChange(idCompra: number | string | null | undefined) {
    const id =
      idCompra === '' || idCompra === null || idCompra === undefined
        ? 0
        : typeof idCompra === 'number'
          ? idCompra
          : Number.parseInt(String(idCompra), 10);
    if (id && Number.isFinite(id)) {
      // Cargar lotes específicos de la compra seleccionada
      this.lotesService.getLotesByCompra(id).subscribe({
        next: (lotes) => {
          this.lotesFiltrados = lotes;
          // Limpiar el campo de item si no está en la nueva lista
          const currentItemId = this.activoForm.get('idItem')?.value;
          if (currentItemId && !this.lotesFiltrados.find(lote => lote.idItem === currentItemId)) {
            this.activoForm.get('idItem')?.setValue('');
            this.itemModalDisplayTerm = '';
            this.entregaModalDisplayTerm = '';
          }
          // Habilitar el campo de item
          this.activoForm.get('idItem')?.enable();
          this.syncItemModalDisplayFromForm();
        },
        error: (error) => {
          console.error('Error al cargar lotes de la compra:', error);
          this.lotesFiltrados = [];
          this.itemModalDisplayTerm = '';
          // Deshabilitar el campo de item
          this.activoForm.get('idItem')?.disable();
        }
      });
    } else {
      // Si no hay compra seleccionada, limpiar los lotes filtrados y entregas
      this.lotesFiltrados = [];
      this.entregasFiltradas = [];
      this.itemModalDisplayTerm = '';
      this.entregaModalDisplayTerm = '';
      this.activoForm.get('idItem')?.setValue('');
      this.activoForm.get('idEntrega')?.setValue('');
      // Deshabilitar campos dependientes
      this.activoForm.get('idItem')?.disable();
      this.activoForm.get('idEntrega')?.disable();
    }
  }

  onItemChange(idItem: number | string | null | undefined) {
    const id =
      idItem === '' || idItem == null
        ? 0
        : typeof idItem === 'number'
          ? idItem
          : Number.parseInt(String(idItem), 10);

    if (id && Number.isFinite(id)) {
      const lote =
        this.lotesFiltrados.find((l) => Number(l.idItem) === id) ??
        this.lotesList.find((l) => Number(l.idItem) === id) ??
        null;
      if (lote) {
        this.itemModalDisplayTerm = this.etiquetaItemModal(lote);
      }

      this.entregasService.getEntregasByItem(id).subscribe({
        next: (entregas) => {
          this.entregasFiltradas = entregas;
          const currentEntregaId = this.activoForm.get('idEntrega')?.value;
          if (
            currentEntregaId &&
            !this.entregasFiltradas.find((entrega) => entrega.idEntrega === currentEntregaId)
          ) {
            this.activoForm.get('idEntrega')?.setValue('');
            this.entregaModalDisplayTerm = '';
          } else {
            this.syncEntregaModalDisplayFromForm();
          }
          this.activoForm.get('idEntrega')?.enable();
        },
        error: (error) => {
          console.error('Error al cargar entregas del item:', error);
          this.entregasFiltradas = [];
          this.entregaModalDisplayTerm = '';
          this.activoForm.get('idEntrega')?.disable();
        }
      });
    } else {
      this.entregasFiltradas = [];
      this.itemModalDisplayTerm = '';
      this.entregaModalDisplayTerm = '';
      this.activoForm.get('idEntrega')?.setValue('');
      this.activoForm.get('idEntrega')?.disable();
    }
  }

  onTipoActivoChange(idTipoActivo: number | string | null | undefined) {
    const id = idTipoActivo === '' || idTipoActivo == null
      ? 0
      : typeof idTipoActivo === 'number'
        ? idTipoActivo
        : Number.parseInt(String(idTipoActivo), 10);

    const usuarioControl = this.activoForm.get('idUsuario');
    if (!usuarioControl) {
      return;
    }

    if (this.modoEdicion) {
      return;
    }

    if (id && Number.isFinite(id) && this.tiposActivoList.length > 0) {
      const tipoActivo = this.tiposActivoList.find(tipo =>
        tipo.idActivo == id || Number(tipo.idActivo) === Number(id)
      );
      if (tipoActivo?.idUsuario) {
        usuarioControl.setValue(tipoActivo.idUsuario, { emitEvent: false });
      }
      usuarioControl.disable({ emitEvent: false });
    } else {
      usuarioControl.reset('', { emitEvent: false });
      usuarioControl.disable({ emitEvent: false });
    }
  }

  isUsuarioDisabled(): boolean {
    return this.activoForm.get('idUsuario')?.disabled || false;
  }

  tieneCompraSeleccionada(): boolean {
    return this.getCompraIdFromForm() != null;
  }

  tieneItemSeleccionado(): boolean {
    return this.getItemIdFromForm() != null;
  }

  isItemDisabled(): boolean {
    return !this.tieneCompraSeleccionada();
  }

  isEntregaDisabled(): boolean {
    return !this.tieneItemSeleccionado();
  }

  // Método para cargar entregas
  cargarEntregas() {
    this.entregasService.getEntregas().subscribe({
      next: (entregas) => {
        this.entregasList = entregas;
        this.entregasFiltradas = []; // Inicializar entregas filtradas vacías
      },
      error: (error) => {
        console.error('Error al cargar entregas:', error);
      }
    });
  }

  // Método para cargar servicios de garantía
  cargarServiciosGarantia() {
    this.serviciosGarantiaService.getServiciosGarantia().subscribe({
      next: (servicios) => {
        this.serviciosGarantiaList = servicios;
      },
      error: (error) => {
        console.error('Error al cargar servicios de garantía:', error);
      }
    });
  }

  cargarTiposActivo() {
    this.tiposActivoService.getTiposActivo().subscribe({
      next: (tipos) => {
        this.tiposActivoList = tipos;
      },
      error: (error) => {
        console.error('Error al cargar tipos de activo:', error);
      }
    });
  }

  cargarTiposCompra() {
    this.tiposCompraService.getTiposCompra().subscribe({
      next: (tipos) => {
        this.tiposCompraList = tipos;
      },
      error: (error) => {
        console.error('Error al cargar tipos de compra:', error);
      }
    });
  }

  updateSummary(): void {
    this.totalActivos = this.activos.length;
    this.altaCount = this.activos.filter(a => a.criticidad?.trim().toUpperCase() === 'ALTA').length;
    this.mediaCount = this.activos.filter(a => a.criticidad?.trim().toUpperCase() === 'MEDIA').length;
    this.bajaCount = this.activos.filter(a => a.criticidad?.trim().toUpperCase() === 'BAJA').length;
    this.estadoActivoCount = this.activos.filter(
      a => a.estado?.trim().toUpperCase() === 'ACTIVO'
    ).length;
    this.estadoInactivoCount = this.activos.filter(
      a => a.estado?.trim().toUpperCase() === 'INACTIVO'
    ).length;
    this.estadoMantenimientoCount = this.activos.filter(
      a => a.estado?.trim().toUpperCase() === 'MANTENIMIENTO'
    ).length;
  }

  filterByCriticidad(criticidad: string): void {
    this.currentFilter = criticidad;
    this.page = 1;
    this.aplicarTodosLosFiltros();
  }

  filterByEstado(estado: string): void {
    this.currentEstadoFilter = estado;
    this.page = 1;
    this.aplicarTodosLosFiltros();
  }

  onSearchTermChange(): void {
    this.page = 1;
    this.aplicarTodosLosFiltros();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchTermChange();
  }

  /**
   * Criticidad + estado + texto de búsqueda aplicados en cadena sobre `activos`.
   */
  aplicarTodosLosFiltros(): void {
    let lista = [...this.activos];

    if (this.currentFilter?.trim()) {
      const cr = this.currentFilter.trim().toUpperCase();
      lista = lista.filter(
        (a) => (a.criticidad?.trim().toUpperCase() ?? '') === cr
      );
    }

    if (this.currentEstadoFilter?.trim()) {
      const es = this.currentEstadoFilter.trim().toUpperCase();
      lista = lista.filter((a) => (a.estado?.trim().toUpperCase() ?? '') === es);
    }

    const valorBusqueda = this.searchTerm.trim().toLowerCase();
    if (valorBusqueda) {
      lista = lista.filter((activo) => this.matchesSearch(activo, valorBusqueda));
    }

    this.ordenarLista(lista);
    this.activosFiltrados = lista;
    this.collectionSize = lista.length;
    const maxPage = Math.max(1, Math.ceil(this.collectionSize / this.pageSize) || 1);
    if (this.page > maxPage) {
      this.page = maxPage;
    }
  }

  private matchesSearch(activo: ActivoDTO, term: string): boolean {
    const nombreCompra = this.getNombreCompraFormateado(activo.idNumeroCompra).toLowerCase();
    const nombreActivo = (activo.name || '').toLowerCase();
    const soloDigitos = /^\d+$/.test(term);
    const coincideIdActivo = soloDigitos && String(activo.idActivo).includes(term);
    return (
      nombreCompra.includes(term) ||
      nombreActivo.includes(term) ||
      coincideIdActivo
    );
  }

  sortData(column: ActivoSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.page = 1;
    this.ordenarLista(this.activosFiltrados);
  }

  getSortIcon(column: ActivoSortColumn): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  isSortActive(column: ActivoSortColumn): boolean {
    return this.sortColumn === column;
  }

  private ordenarLista(lista: ActivoDTO[]): void {
    const col = this.sortColumn;
    const mult = this.sortDirection === 'asc' ? 1 : -1;
    lista.sort((a, b) => {
      const valA = this.getSortValue(a, col);
      const valB = this.getSortValue(b, col);
      return valA.localeCompare(valB, 'es', { sensitivity: 'base' }) * mult;
    });
  }

  private getSortValue(a: ActivoDTO, col: ActivoSortColumn): string {
    switch (col) {
      case 'numeroCompra': {
        const compra = this.compras.get(a.idNumeroCompra);
        return (compra?.numeroCompra ?? this.getNombreCompraFormateado(a.idNumeroCompra))
          .trim()
          .toLowerCase();
      }
      case 'name':
        return (a.name ?? '').trim().toLowerCase();
      case 'idUsuario':
        return this.getUsuarioInfo(a.idUsuario).toLowerCase();
      case 'idUbicacion':
        return this.getUbicacionInfo(a.idUbicacion).toLowerCase();
      case 'criticidad':
        return (a.criticidad ?? '').trim().toLowerCase();
      case 'estado':
        return (a.estado ?? '').trim().toLowerCase();
      default:
        return '';
    }
  }

  get rangoDesde(): number {
    if (this.collectionSize === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get rangoHasta(): number {
    return Math.min(this.page * this.pageSize, this.collectionSize);
  }

  get pagedActivos(): ActivoDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    return this.activosFiltrados.slice(startItem, startItem + this.pageSize);
  }

  verDetallesHardware(name: string): void {
    this.hardwareService.getHardware().subscribe({
      next: (hardwareList) => {
        const hardware = hardwareList.find((h: any) => h.name === name);
        if (hardware) {
          this.router.navigate(['/menu/asset-details', hardware.id]);
        } else {
          this.notificationService.showNotFoundError('No se encontró el hardware correspondiente.');
        }
      },
      error: () => {
        this.notificationService.showError(
          'Error al Buscar Hardware',
          'No se pudo buscar el hardware correspondiente.'
        );
      }
    });
  }

  getNumeroCompraString(idCompra: number): string {
    const compra = this.compras.get(idCompra);
    return compra && compra.numeroCompra ? compra.numeroCompra : 'No asignado';
  }

  reiniciarSeleccionPdfColumnas(): void {
    for (const col of this.pdfColumnsFlat) {
      this.pdfColumnSelected[col.key] = this.pdfDefaultOnKeys.has(col.key);
    }
  }

  pdfToggleSection(sectionId: string, value: boolean): void {
    const sec = this.pdfExportSections.find((s) => s.id === sectionId);
    if (!sec) return;
    for (const c of sec.cols) {
      this.pdfColumnSelected[c.key] = value;
    }
  }

  pdfSeleccionSoloTabla(): void {
    const solo = new Set([
      'compra',
      'numeroActivo',
      'responsable',
      'ubicacion',
      'criticidad',
      'estado'
    ]);
    for (const col of this.pdfColumnsFlat) {
      this.pdfColumnSelected[col.key] = solo.has(col.key);
    }
  }

  pdfSeleccionTodasLasColumnas(): void {
    for (const col of this.pdfColumnsFlat) {
      this.pdfColumnSelected[col.key] = true;
    }
  }

  pdfSeleccionNingunaColumna(): void {
    for (const col of this.pdfColumnsFlat) {
      this.pdfColumnSelected[col.key] = false;
    }
  }

  abrirModalPdfActivos(contenido: TemplateRef<unknown>): void {
    if (this.loading) {
      return;
    }
    if (this.activosFiltrados.length === 0) {
      this.notificationService.showError(
        'No hay datos para exportar',
        'No hay activos en la lista filtrada para exportar.'
      );
      return;
    }
    for (const col of this.pdfColumnsFlat) {
      if (this.pdfColumnSelected[col.key] === undefined) {
        this.pdfColumnSelected[col.key] = false;
      }
    }
    this.modalService.open(contenido, { size: 'xl', centered: true, backdrop: true });
  }

  async generarPdfActivosListado(modal: NgbActiveModal): Promise<void> {
    if (this.pdfGenerando) return;
    const keys = this.pdfColumnsFlat
      .filter((c) => this.pdfColumnSelected[c.key])
      .map((c) => c.key);
    if (keys.length === 0) {
      this.notificationService.showWarning('Columnas', 'Elegí al menos una columna para el PDF.');
      return;
    }

    this.pdfGenerando = true;
    try {
      const remoteDeps = this.gatherRemoteDeps(keys);
      let bundleCache = new Map<number, HwPdfBundle>();
      if (remoteDeps.size > 0) {
        bundleCache = await this.prefetchHwBundlesForPdf(keys);
      }

      const doc = new jsPDF('landscape');
      doc.setFontSize(18);
      doc.text('Gestión de activos', 14, 18);

      doc.setFontSize(10);
      const descFiltros: string[] = [];
      if (this.currentFilter?.trim()) {
        descFiltros.push(`Criticidad: ${this.currentFilter.trim()}`);
      }
      if (this.currentEstadoFilter?.trim()) {
        descFiltros.push(`Estado: ${this.currentEstadoFilter.trim()}`);
      }
      if (this.searchTerm.trim()) {
        descFiltros.push(`Búsqueda: ${this.searchTerm.trim()}`);
      }
      const filtroTxt = descFiltros.length ? descFiltros.join(' | ') : 'Todos';
      doc.text(filtroTxt, 14, 26);
      const fecha = new Date().toLocaleString('es-ES');
      doc.text(`Generado: ${fecha}`, 14, 32);
      doc.text(`Total activos: ${this.activosFiltrados.length}`, 14, 38);

      const head = [keys.map((k) => this.pdfLabelForKey(k))];
      const body = this.activosFiltrados.map((a) => {
        const nm = a.name != null ? String(a.name).trim() : '';
        const hw = nm ? this.hardwareByName.get(nm) ?? null : null;
        const hid = hw?.id != null ? Number(hw.id) : null;
        const bundle =
          hid != null && remoteDeps.size > 0 ? bundleCache.get(hid) ?? null : null;
        return keys.map((k) => this.getActivoValorPdf(a, k, hw, bundle));
      });

      const fontSize = keys.length > 10 ? 6 : keys.length > 7 ? 7 : 8;

      autoTable(doc, {
        head,
        body,
        startY: 44,
        styles: { fontSize, cellPadding: 1.5, overflow: 'linebreak' },
        headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        margin: { left: 14, right: 14 }
      });

      const nombreArchivo = `activos_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(nombreArchivo);
      modal.close('ok');
      this.notificationService.showSuccessMessage(`PDF generado: ${nombreArchivo}`);
    } finally {
      this.pdfGenerando = false;
    }
  }

  private pdfLabelForKey(key: string): string {
    return this.pdfColumnsFlat.find((c) => c.key === key)?.label ?? key;
  }

  private gatherRemoteDeps(keys: readonly string[]): Set<PdfHardwareRemoteDep> {
    const s = new Set<PdfHardwareRemoteDep>();
    for (const k of keys) {
      const d = ActivosComponent.PDF_KEY_REMOTE_DEP[k];
      if (d) s.add(d);
    }
    return s;
  }

  private async prefetchHwBundlesForPdf(
    keys: readonly string[]
  ): Promise<Map<number, HwPdfBundle>> {
    const result = new Map<number, HwPdfBundle>();
    const remoteDeps = this.gatherRemoteDeps(keys);
    if (remoteDeps.size === 0) return result;

    const ids = new Set<number>();
    for (const a of this.activosFiltrados) {
      const name = a.name != null ? String(a.name).trim() : '';
      if (!name) continue;
      const h = this.hardwareByName.get(name);
      if (h?.id != null) ids.add(Number(h.id));
    }
    if (ids.size === 0) return result;

    if (this.activosFiltrados.length > 60) {
      this.notificationService.showWarning(
        'Exportación con inventario',
        'Se consultarán datos de inventario en Cerbero por equipo. Con muchas filas la generación puede tardar unos segundos.'
      );
    }

    const idList = [...ids];
    const batchSize = 6;
    for (let i = 0; i < idList.length; i += batchSize) {
      const slice = idList.slice(i, i + batchSize);
      const loaded = await Promise.all(
        slice.map((hid) => this.loadRemoteBundle(hid, remoteDeps))
      );
      slice.forEach((hid, idx) => result.set(hid, loaded[idx]));
    }
    return result;
  }

  private async loadRemoteBundle(
    hwId: number,
    deps: ReadonlySet<PdfHardwareRemoteDep>
  ): Promise<HwPdfBundle> {
    const b: HwPdfBundle = {};
    const tasks: Promise<void>[] = [];

    if (deps.has('bios')) {
      tasks.push(
        firstValueFrom(
          this.biosService.getByHardwareId(hwId).pipe(catchError(() => of(null)))
        ).then((data) => {
          if (Array.isArray(data)) b.bios = data[0] ?? null;
          else b.bios = data ?? null;
        })
      );
    }
    if (deps.has('cpu')) {
      tasks.push(
        firstValueFrom(
          this.cpuService.getByHardwareId(hwId).pipe(catchError(() => of(null)))
        ).then((data) => {
          if (Array.isArray(data)) b.cpu = data[0] ?? null;
          else b.cpu = data ?? null;
        })
      );
    }
    if (deps.has('drive')) {
      tasks.push(
        firstValueFrom(
          this.driveService.getByHardwareId(hwId).pipe(catchError(() => of(null)))
        ).then((data) => {
          b.drive = this.normPdfArray(data);
        })
      );
    }
    if (deps.has('memory')) {
      tasks.push(
        firstValueFrom(
          this.memoryService.getByHardwareId(hwId).pipe(catchError(() => of(null)))
        ).then((data) => {
          b.memory = this.normPdfArray(data);
        })
      );
    }
    if (deps.has('monitor')) {
      tasks.push(
        firstValueFrom(
          this.monitorService.getByHardwareId(hwId).pipe(catchError(() => of(null)))
        ).then((data) => {
          b.monitor = this.normPdfArray(data);
        })
      );
    }
    if (deps.has('storage')) {
      tasks.push(
        firstValueFrom(
          this.storageService.getByHardwareId(hwId).pipe(catchError(() => of(null)))
        ).then((data) => {
          b.storage = this.normPdfArray(data);
        })
      );
    }
    if (deps.has('video')) {
      tasks.push(
        firstValueFrom(
          this.videoService.getByHardwareId(hwId).pipe(catchError(() => of(null)))
        ).then((data) => {
          b.video = this.normPdfArray(data);
        })
      );
    }
    if (deps.has('software')) {
      tasks.push(
        firstValueFrom(
          this.softwareByHardwareService.getByHardwareId(hwId).pipe(catchError(() => of(null)))
        ).then((data) => {
          if (data == null) b.software = [];
          else b.software = Array.isArray(data) ? data : [];
        })
      );
    }

    await Promise.all(tasks);
    return b;
  }

  private normPdfArray(data: unknown): unknown[] {
    if (data == null) return [];
    return Array.isArray(data) ? data : [data];
  }

  private strPdf(v: unknown): string {
    if (v === null || v === undefined) return '—';
    const s = String(v).trim();
    return s === '' ? '—' : s;
  }

  private pdfFmtDateTime(val: unknown): string {
    if (val == null || val === '') return '—';
    try {
      const d = val instanceof Date ? val : new Date(val as string);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '—';
    }
  }

  private pdfDrivesSummary(drives: unknown[] | null | undefined): string {
    if (!drives?.length) return '—';
    return drives
      .map((raw) => {
        const d = raw as Record<string, unknown>;
        const letter = d['letter'];
        const fs = d['filesystem'];
        const t = d['type'];
        const bits = [letter, t, fs].map((x) => (x != null ? String(x).trim() : '')).filter(Boolean);
        return bits.length ? bits.join(' ') : '—';
      })
      .join('; ');
  }

  private pdfMemorySummary(mem: unknown[] | null | undefined): string {
    if (!mem?.length) return '—';
    return mem
      .map((raw) => {
        const m = raw as Record<string, unknown>;
        const cap = m['capacity'];
        const capStr = cap != null ? `${cap}` : '';
        const capLabel = capStr ? `${capStr} B` : '';
        return [m['slotNumber'], m['caption'], capLabel, m['type']]
          .map((x) => (x != null ? String(x).trim() : ''))
          .filter(Boolean)
          .join(' · ');
      })
      .join('; ');
  }

  private pdfMonitorsSummary(mon: unknown[] | null | undefined): string {
    if (!mon?.length) return '—';
    return mon
      .map((raw) => {
        const x = raw as Record<string, unknown>;
        return [x['caption'], x['manufacturer'], x['serial']]
          .map((v) => (v != null ? String(v).trim() : ''))
          .filter(Boolean)
          .join(' · ');
      })
      .join('; ');
  }

  private pdfStorageSummary(list: unknown[] | null | undefined): string {
    if (!list?.length) return '—';
    return list
      .map((raw) => {
        const s = raw as Record<string, unknown>;
        const gb = s['diskSize'];
        const gbStr = gb != null ? `${gb} GB` : '';
        return [s['manufacturer'], s['model'], s['serialNumber'], gbStr, s['type']]
          .map((v) => (v != null ? String(v).trim() : ''))
          .filter(Boolean)
          .join(' · ');
      })
      .join('; ');
  }

  private pdfVideosSummary(list: unknown[] | null | undefined): string {
    if (!list?.length) return '—';
    return list
      .map((raw) => {
        const v = raw as Record<string, unknown>;
        return [v['name'], v['chipset'], v['resolution'], v['memory']]
          .map((x) => (x != null ? String(x).trim() : ''))
          .filter(Boolean)
          .join(' · ');
      })
      .join('; ');
  }

  private pdfSoftwareSummarySoft(list: SoftwareDTO[] | null | undefined): string {
    if (!list?.length) return '—';
    const shown = list.slice(0, 14).map((s) => s.nombre?.trim() || '(sin nombre)');
    const tail = list.length > 14 ? ` … (+${list.length - 14} más)` : '';
    return `${list.length}: ${shown.join(', ')}${tail}`;
  }

  private cpuPdf(bundle: HwPdfBundle | null): Record<string, unknown> | null {
    if (!bundle?.cpu || typeof bundle.cpu !== 'object') return null;
    return bundle.cpu as Record<string, unknown>;
  }

  private biosPdf(bundle: HwPdfBundle | null): Record<string, unknown> | null {
    if (!bundle?.bios || typeof bundle.bios !== 'object') return null;
    return bundle.bios as Record<string, unknown>;
  }

  private getActivoValorPdf(
    activo: ActivoDTO,
    key: string,
    hw: Record<string, unknown> | null,
    bundle: HwPdfBundle | null
  ): string {
    const bios = this.biosPdf(bundle);
    const cpu = this.cpuPdf(bundle);

    switch (key) {
      case 'idActivo':
        return String(activo.idActivo ?? '');
      case 'numeroActivo':
        return activo.name || '—';
      case 'compra':
        return this.getNombreCompraFormateado(activo.idNumeroCompra);
      case 'tipoActivo':
        return this.getTipoActivoNombrePdf(activo.idTipoActivo);
      case 'clasificacion':
        return activo.clasificacionDeINFO || '—';
      case 'responsable':
        return this.getUsuarioInfo(activo.idUsuario);
      case 'ubicacion':
        return this.getUbicacionInfo(activo.idUbicacion);
      case 'criticidad':
        return activo.criticidad || '—';
      case 'estado':
        return activo.estado || '—';
      case 'itemLote':
        return this.getItemLotePdfTexto(activo.idItem);
      case 'entrega':
        return this.getEntregaPdfTexto(activo);
      case 'idSecundario':
        return activo.idSecundario ?? '—';
      case 'servicioGarantia':
        return this.getServicioGarantiaNombrePdf(activo.idServicioGarantia);
      case 'fechaFinGarantia':
        return activo.fechaFinGarantia ? this.formatearFecha(activo.fechaFinGarantia) : '—';

      case 'hwIdInventario':
        return hw?.['id'] != null ? String(hw['id']) : '—';
      case 'hwWorkgroup':
        return this.strPdf(hw?.['workgroup']);
      case 'hwIpAddr':
        return this.strPdf(hw?.['ipAddr']);
      case 'hwIpSrc':
        return this.strPdf(hw?.['ipSrc']);
      case 'hwDns':
        return this.strPdf(hw?.['dns']);
      case 'hwDefaultGateway':
        return this.strPdf(hw?.['defaultGateway']);
      case 'hwOsName':
        return this.strPdf(hw?.['osName']);
      case 'hwOsVersion':
        return this.strPdf(hw?.['osVersion']);
      case 'hwOsComments':
        return this.strPdf(hw?.['osComments']);
      case 'hwDescription':
        return this.strPdf(hw?.['description']);
      case 'hwProcessorsLabel':
        return this.strPdf(hw?.['processors']);
      case 'hwProcessorType':
        return this.strPdf(hw?.['processorType']);
      case 'hwProcessorCores':
        return this.strPdf(hw?.['processorN']);
      case 'hwMemoryMb':
        return this.strPdf(hw?.['memory']);
      case 'hwSwapMb':
        return this.strPdf(hw?.['swap']);
      case 'hwWinCompany':
        return this.strPdf(hw?.['winCompany']);
      case 'hwWinUser':
        return this.strPdf(hw?.['userid']);
      case 'hwLastDate':
        return this.pdfFmtDateTime(hw?.['lastDate']);
      case 'hwLastCome':
        return this.pdfFmtDateTime(hw?.['lastCome']);

      case 'biosSmanufacturer':
        return this.strPdf(bios?.['smanufacturer']);
      case 'biosSmodel':
        return this.strPdf(bios?.['smodel']);
      case 'biosSsn':
        return this.strPdf(bios?.['ssn']);
      case 'biosAssettag':
        return this.strPdf(bios?.['assettag']);
      case 'biosType':
        return this.strPdf(bios?.['type']);
      case 'biosBmanufacturer':
        return this.strPdf(bios?.['bmanufacturer']);
      case 'biosBversion':
        return this.strPdf(bios?.['bversion']);
      case 'biosBdate':
        return this.strPdf(bios?.['bdate']);

      case 'cpuManufacturer':
        return this.strPdf(cpu?.['manufacturer']);
      case 'cpuType':
        return this.strPdf(cpu?.['type']);
      case 'cpuSerial':
        return this.strPdf(cpu?.['serialNumber']);
      case 'cpuSpeed':
        return this.strPdf(cpu?.['speed']);
      case 'cpuCores':
        return this.strPdf(cpu?.['cores']);
      case 'cpuSocket':
        return this.strPdf(cpu?.['socket']);
      case 'cpuArch':
        return this.strPdf(cpu?.['cpuArch']);
      case 'cpuLogicalCpus':
        return this.strPdf(cpu?.['logicalCpus']);
      case 'cpuVoltage':
        return this.strPdf(cpu?.['voltage']);

      case 'drivesSummary':
        return this.pdfDrivesSummary(bundle?.drive ?? null);
      case 'memorySummary':
        return this.pdfMemorySummary(bundle?.memory ?? null);
      case 'monitorsSummary':
        return this.pdfMonitorsSummary(bundle?.monitor ?? null);
      case 'storageSummary':
        return this.pdfStorageSummary(bundle?.storage ?? null);
      case 'videosSummary':
        return this.pdfVideosSummary(bundle?.video ?? null);
      case 'softwareSummary':
        return this.pdfSoftwareSummarySoft(bundle?.software ?? null);

      default:
        return '—';
    }
  }

  private getTipoActivoNombrePdf(idTipo: number): string {
    const t = this.tiposActivoList.find(
      (tipo) => Number(tipo.idActivo) === Number(idTipo)
    );
    return t?.nombre ?? (idTipo ? `Tipo #${idTipo}` : '—');
  }

  private getItemLotePdfTexto(idItem: number): string {
    if (!idItem) return '—';
    const l = this.lotesList.find((lo) => lo.idItem === idItem);
    return l?.nombreItem ?? `Item #${idItem}`;
  }

  private getEntregaPdfTexto(activo: ActivoDTO): string {
    const id = activo.idEntrega;
    if (id == null) return '—';
    const e = this.entregasList.find((ent) => ent.idEntrega === id);
    if (!e) return `Entrega #${id}`;
    const partes: string[] = [];
    if (e.descripcion?.trim()) {
      partes.push(e.descripcion.trim());
    }
    if (e.cantidad != null) {
      partes.push(`Cant.: ${e.cantidad}`);
    }
    return partes.length ? partes.join(' · ') : `Entrega #${id}`;
  }

  private getServicioGarantiaNombrePdf(idServicio: number): string {
    const s = this.serviciosGarantiaList.find(
      (sg) => sg.idServicioGarantia === idServicio
    );
    return (
      s?.nombreComercial ||
      s?.nombre ||
      (idServicio ? `Servicio #${idServicio}` : '—')
    );
  }

  getNombreCompraFormateado(idCompra: number): string {
    const compra = this.compras.get(idCompra);
    if (!compra) return 'No asignado';
    
    // Obtener el tipo de compra para el abreviado
    let abreviado = '';
    if (compra.idTipoCompra) {
      // Buscar en la lista de tipos de compra
      const tipoCompra = this.tiposCompraList.find(t => t.idTipoCompra === compra.idTipoCompra);
      if (tipoCompra) {
        abreviado = tipoCompra.abreviado || '';
      }
    }
    
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

  /**
   * Obtiene información del rango de activos a crear
   */
  getRangeInfo(): { start: string; end: string; count: number; isValid: boolean; isPcFormat: boolean } {
    if (!this.rangeStartControl || !this.rangeEndControl) {
      return { start: '', end: '', count: 0, isValid: false, isPcFormat: false };
    }

    // Detectar si es formato PC (PC + dígitos)
    const startPcMatch = this.rangeStartControl.match(/^PC(\d+)$/);
    const endPcMatch = this.rangeEndControl.match(/^PC(\d+)$/);
    
    if (startPcMatch && endPcMatch) {
      // Formato PC
      const startNum = parseInt(startPcMatch[1]);
      const endNum = parseInt(endPcMatch[1]);
      
      if (startNum > endNum) {
        return { start: '', end: '', count: 0, isValid: false, isPcFormat: true };
      }
      
      const count = endNum - startNum + 1;
      return {
        start: this.rangeStartControl,
        end: this.rangeEndControl,
        count: count,
        isValid: true,
        isPcFormat: true
      };
    } else {
      // Formato numérico simple
      const startNum = parseInt(this.rangeStartControl);
      const endNum = parseInt(this.rangeEndControl);
      
      if (isNaN(startNum) || isNaN(endNum)) {
        return { start: '', end: '', count: 0, isValid: false, isPcFormat: false };
      }
      
      if (startNum > endNum) {
        return { start: '', end: '', count: 0, isValid: false, isPcFormat: false };
      }
      
      const count = endNum - startNum + 1;
      return {
        start: this.rangeStartControl,
        end: this.rangeEndControl,
        count: count,
        isValid: true,
        isPcFormat: false
      };
    }
  }

  /**
   * Genera la lista de nombres de activo en el rango especificado
   */
  generateAssetNumbers(): string[] {
    const rangeInfo = this.getRangeInfo();
    if (!rangeInfo.isValid) return [];

          if (rangeInfo.isPcFormat) {
        // Formato PC: generar PC + número
        const startMatch = this.rangeStartControl.match(/^PC(\d+)$/);
        const endMatch = this.rangeEndControl.match(/^PC(\d+)$/);
      
      if (!startMatch || !endMatch) return [];
      
      const startNum = parseInt(startMatch[1]);
      const endNum = parseInt(endMatch[1]);
      const names: string[] = [];

      for (let i = startNum; i <= endNum; i++) {
        names.push(`PC${i.toString()}`);
      }
      return names;
    } else {
      // Formato numérico simple
      const startNum = parseInt(this.rangeStartControl);
      const endNum = parseInt(this.rangeEndControl);
      const names: string[] = [];

      for (let i = startNum; i <= endNum; i++) {
        names.push(i.toString());
      }
      return names;
    }
  }

  /**
   * Verifica si un nombre de activo ya existe
   */
  isAssetNumberExists(number: string): boolean {
    return this.activos.some(activo => activo.name === number);
  }

  /**
   * Valida el formato del nombre de activo (PC o numérico)
   */
  validateAssetName(name: string): boolean {
    // Formato PC: PC + dígitos
    if (name.match(/^PC\d+$/)) {
      return true;
    }
    
    // Formato numérico: solo números
    if (name.match(/^\d+$/)) {
      return true;
    }
    
    return false;
  }

  onAssetNameInputChange(): void {
    if (this.creationMode !== 'single') {
      this.setNameDuplicateError(false);
      return;
    }

    const control = this.activoForm.get('name');
    const rawValue = control?.value;
    const normalized = String(rawValue || '').trim().toUpperCase();

    if (!normalized) {
      this.setNameDuplicateError(false);
      return;
    }

    this.setNameDuplicateError(this.isNombreActivoDuplicado(normalized));
  }

  private isNombreActivoDuplicado(nombreNormalizado: string): boolean {
    return this.activos.some((a) => {
      const nombreExistente = String(a.name || '').trim().toUpperCase();
      if (this.modoEdicion && this.activoSeleccionado) {
        return a.idActivo !== this.activoSeleccionado.idActivo && nombreExistente === nombreNormalizado;
      }
      return nombreExistente === nombreNormalizado;
    });
  }

  private setNameDuplicateError(hasDuplicate: boolean): void {
    const control = this.activoForm.get('name');
    if (!control) return;

    const currentErrors = { ...(control.errors || {}) };
    if (hasDuplicate) {
      currentErrors['duplicate'] = true;
      control.setErrors(currentErrors);
      return;
    }

    if ('duplicate' in currentErrors) {
      delete currentErrors['duplicate'];
      control.setErrors(Object.keys(currentErrors).length ? currentErrors : null);
    }
  }

  /**
   * Valida que ambos rangos tengan el mismo formato
   */
  validateRangeFormat(): { isValid: boolean; isPcFormat: boolean; errorMessage: string } {
    if (!this.rangeStartControl || !this.rangeEndControl) {
      return { isValid: false, isPcFormat: false, errorMessage: 'Debe especificar ambos rangos' };
    }

    const startIsPc = this.rangeStartControl.match(/^PC\d+$/) !== null;
    const endIsPc = this.rangeEndControl.match(/^PC\d+$/) !== null;
    const startIsNumeric = this.rangeStartControl.match(/^\d+$/) !== null;
    const endIsNumeric = this.rangeEndControl.match(/^\d+$/) !== null;

    // Ambos deben ser del mismo formato
    if (startIsPc && endIsPc) {
      return { isValid: true, isPcFormat: true, errorMessage: '' };
    } else if (startIsNumeric && endIsNumeric) {
      return { isValid: true, isPcFormat: false, errorMessage: '' };
    } else {
      return { 
        isValid: false, 
        isPcFormat: false, 
        errorMessage: 'Ambos rangos deben tener el mismo formato (PC + números o solo números)' 
      };
    }
  }

  getFieldDisplayName(fieldName: string): string {
    const fieldNames: { [key: string]: string } = {
      'name': 'Número de Activo',
      'idTipoActivo': 'Tipo de Activo',
      'clasificacionDeINFO': 'Clasificación de INFO',
      'criticidad': 'Criticidad',
      'estado': 'Estado',
      'idNumeroCompra': 'Número de Compra',
      'idItem': 'Item',
      'idEntrega': 'Entrega',
      'idUsuario': 'Usuario',
      'idSecundario': 'ID Secundario',
      'idServicioGarantia': 'Servicio de Garantía',
      'fechaFinGarantia': 'Fecha Fin Garantía'
    };
    return fieldNames[fieldName] || fieldName;
  }

  updateValidationRules() {
    const nameControl = this.activoForm.get('name');
    if (nameControl) {
      if (this.creationMode === 'range') {
        // En modo rango, el nombre no es requerido porque se genera automáticamente
        nameControl.clearValidators();
        nameControl.setValue(''); // Limpiar el valor
        nameControl.markAsUntouched(); // Marcar como no touched para no mostrar errores
      } else {
        // En modo individual, el nombre es requerido
        nameControl.setValidators(Validators.required);
        nameControl.setValue(''); // Limpiar el valor
      }
      nameControl.updateValueAndValidity();
    }
  }

  /**
   * Resetea la visualización de errores cuando se cambian los campos del formulario
   */
  resetValidationDisplay() {
    this.shouldShowValidationErrors = false;
  }

  /**
   * Maneja el cambio de pestañas en el modal
   */
  onTabChange(tabId: string) {
    this.activeTab = tabId;
    this.resetValidationDisplay();
  }

  /**
   * Cierra el modal y resetea la visualización de errores
   */
  cerrarModal(modal: any) {
    this.shouldShowValidationErrors = false;
    if (this.inventoryTour?.isActive()) {
      this.inventoryTourOpenedActivoModal = false;
    }
    modal.dismiss();
  }

  /**
   * Obtiene el idUsuario correcto basado en el estado del formulario
   */
  private getUserIdFromForm(formData: ActivoFormRaw): number {
    if (formData.idUsuario) {
      // Si el campo está habilitado, usar el valor del formulario
      return this.parseFormInt(formData.idUsuario);
    } else {
      // Si el campo está deshabilitado, obtener el idUsuario del tipo de activo
      const idTipo = this.parseFormInt(formData.idTipoActivo);
      const tipoActivo = this.tiposActivoList.find(tipo => tipo.idActivo === idTipo);
      if (tipoActivo && tipoActivo.idUsuario) {
        return tipoActivo.idUsuario;
      } else {
        throw new Error('No se pudo determinar el usuario responsable del tipo de activo');
      }
    }
  }
} 