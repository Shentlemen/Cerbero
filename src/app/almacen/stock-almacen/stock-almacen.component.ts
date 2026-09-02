import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener, ElementRef, ViewChild, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { StockAlmacenService, StockAlmacen } from '../../services/stock-almacen.service';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';
import { TransferirEquipoModalComponent } from '../../components/transferir-equipo-modal/transferir-equipo-modal.component';
import { TransferirMasaModalComponent } from '../../components/transferir-masa-modal/transferir-masa-modal.component';
import { ReactivarMasaModalComponent } from '../../components/reactivar-masa-modal/reactivar-masa-modal.component';
import { RegistrarStockModalComponent } from '../../components/registrar-stock-modal/registrar-stock-modal.component';
import { ModificarCantidadModalComponent } from '../../components/modificar-cantidad-modal/modificar-cantidad-modal.component';
import { EditarRegistroStockModalComponent } from '../../components/editar-registro-stock-modal/editar-registro-stock-modal.component';
import { EstadoEquipoService, CambioEstadoRequest } from '../../services/estado-equipo.service';
import { EstadoDispositivoService, CambioEstadoDispositivoRequest } from '../../services/estado-dispositivo.service';
import { AuthService } from '../../services/auth.service';
import { AlmacenConfigService } from '../../services/almacen-config.service';
import {
  AlmacenConfig,
  defEstanteria,
  estanteriasOrdenadas,
} from '../../interfaces/almacen-config.interface';
import { HardwareService } from '../../services/hardware.service';
import { BiosService } from '../../services/bios.service';
import { NetworkInfoService } from '../../services/network-info.service';
import { forkJoin, firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TourRegistryService } from '../../services/tour-registry.service';
import { AlmacenPlantaService } from '../../services/almacen-planta.service';
import { AlmacenPlantaCanvasComponent } from '../planta-almacen/almacen-planta-canvas.component';
import { AlmacenPlanta, AlmacenPlantaObjeto, ocupacionDe } from '../../interfaces/almacen-planta.interface';
import {
  esAlmacenOficinaLaboratorio,
  findAlmacenCementerio,
  findAlmacenLaboratorio,
  findAlmacenOficinaLaboratorio
} from '../../utils/almacen-especial';

@Component({
  selector: 'app-stock-almacen',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    FormsModule,
    EditarRegistroStockModalComponent,
    AlmacenPlantaCanvasComponent,
    NgbModule,
    NotificationContainerComponent
  ],
  templateUrl: './stock-almacen.component.html',
  styleUrls: ['./stock-almacen.component.css']
})
export class StockAlmacenComponent implements OnInit, OnDestroy, OnChanges {
  /**
   * Cuando true, el ID viene de `embeddedAlmacenId` (p. ej. embebido en Almacenes) y no de la ruta.
   */
  @Input() embedStock = false;
  @Input() embeddedAlmacenId: number | null = null;
  /** Título de la pantalla: ancla para subir “hasta arriba del todo” al paginar. */
  @ViewChild('stockPaginaInicio', { read: ElementRef }) stockPaginaInicioRef?: ElementRef<HTMLElement>;
  /** Área con scroll interno de la tabla; la ventana suele quedar en 0 mientras esto sí hace scroll. */
  @ViewChild('listadoTableScroll', { read: ElementRef }) listadoTableScrollRef?: ElementRef<HTMLElement>;

  stock: StockAlmacen[] = [];
  almacenes: Almacen[] = [];
  almacenSeleccionado: Almacen | null = null;
  almacenId: number | null = null;
  loading: boolean = false;
  error: string | null = null;

  // Organización del stock por almacén y estantería
  stockOrganizado: { [key: string]: { [key: string]: any[] } } = {};

  // Almacenes especiales
  almacenCementerio: Almacen | null = null; // alm01 subsuelo
  almacenLaboratorio: Almacen | null = null; // alm05 pañol 3
  almacenOficinaLaboratorio: Almacen | null = null;

  // Estado de exportación
  isExporting: boolean = false;
  isExportingEstanteria: { [key: string]: boolean } = {};

  // Estado de transferencia
  transferiendoItemId: string | number | null = null;
  
  // Estado de reactivación
  reactivandoItemId: string | number | null = null;
  transfiriendoMasa = false;
  reactivandoMasa = false;

  /** Eliminación de fila ítem en curso (`stock_almacen.id`). */
  eliminandoStockId: number | null = null;

  /** Confirmación visual (mismo patrón que assets / `styles.css` `.confirm-dialog-*`). */
  showConfirmEliminarStock = false;
  private stockRegistroParaEliminar: any = null;
  stockEliminarEtiqueta = '';
  
  // Estado del dropdown de acciones
  dropdownAbiertoId: string | number | null = null;

  // Buscador con resaltado (no filtra, solo resalta)
  searchTerm: string = '';

  // Estado de selección para layout híbrido (izquierda árbol, derecha listado)
  selectedAlmacenKey: string | null = null;
  selectedEstanteriaKey: string | null = null;
  selectedEstanteKey: string | null = null;

  /** Listado derecho ordenado (se recalcula al cambiar búsqueda, selección o datos; evita reordenar 300+ filas en cada CD) */
  private itemsListadoOrdenados: any[] = [];

  private tourCleanup?: () => void;

  /** Paginación del listado (mejora rendimiento con muchos equipos) */
  listadoPage = 1;
  /** Filas por página en la tabla (menos DOM = scroll más fluido) */
  listadoPageSize = 25;

  planta: AlmacenPlanta | null = null;
  mostrarPlanta = true;
  plantaObjetoActivo: AlmacenPlantaObjeto | null = null;


  // Configuraciones de almacenes (estanterías, estantes, secciones desde AlmacenConfig)
  almacenConfigs: Map<number, AlmacenConfig> = new Map();

  constructor(
    private stockAlmacenService: StockAlmacenService,
    private almacenService: AlmacenService,
    private almacenConfigService: AlmacenConfigService,
    private route: ActivatedRoute,
    private router: Router,
    private modalService: NgbModal,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private estadoEquipoService: EstadoEquipoService,
    private estadoDispositivoService: EstadoDispositivoService,
    private authService: AuthService,
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private networkInfoService: NetworkInfoService,
    private tourRegistry: TourRegistryService,
    private plantaService: AlmacenPlantaService
  ) {}

  ngOnInit(): void {
    if (this.embedStock) {
      return;
    }
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      this.almacenId = id ? parseInt(id, 10) : null;
      this.cargarDatos();
    });
    this.tourCleanup = this.tourRegistry.register('stock-almacen', [{
      id: 'stock-almacen-overview',
      title: 'Tour de stock del almacén',
      icon: 'fa-route',
      steps: [
        { selector: '#tour-stock-almacen-title', title: 'Stock del almacén', description: 'Vista detallada por almacén: métricas, planta 2D, árbol de ubicaciones y tabla de ítems.', side: 'bottom' },
        { selector: '#tour-stock-almacen-toolbar', title: 'Herramientas', description: 'Buscador, registro de stock, transferir/reactivar en masa e impresión/PDF de la <strong>vista filtrada</strong> (incluye ítems de stock).', side: 'bottom' },
        { selector: '#tour-stock-almacen-planta', title: 'Planta', description: 'Mapa de solo lectura. Clic en una estantería filtra el listado y muestra el contenido en el panel.', side: 'bottom' },
        { selector: '#tour-stock-almacen-kpis', title: 'Resumen', description: 'Contadores de la vista actual (unidades, ítems visibles, estanterías y estantes).', side: 'bottom' },
        { selector: '#tour-stock-almacen-tree', title: 'Ubicaciones', description: 'Navegá por estantería y estante para filtrar el listado de la derecha.', side: 'right' },
        { selector: '#tour-stock-almacen-listado', title: 'Listado', description: 'Filas paginadas con acciones de edición, transferencia o reactivación según el tipo de registro.', side: 'top' }
      ]
    }, {
      id: 'stock-almacen-planta',
      title: 'Tour de la planta',
      icon: 'fa-th',
      beforeStart: () => { this.mostrarPlanta = true; },
      steps: [
        { selector: '#tour-stock-almacen-planta', title: 'Mapa del almacén', description: 'La planta es de solo lectura. El color indica si la estantería tiene stock. Arrastrá el mapa y usá la rueda para zoom.', side: 'bottom' },
        { selector: '#tour-stock-almacen-tree', title: 'Clic en estantería', description: 'Al hacer clic en una estantería se filtra el árbol y el listado, y se abre un panel con el contenido.', side: 'right' },
        { selector: '#tour-stock-almacen-listado', title: 'Contenido', description: 'Ítems y equipos de la estantería elegida. Las zonas (pasillo, muelle) no tienen stock.', side: 'top' }
      ]
    }]);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.embedStock) {
      return;
    }
    if (!changes['embeddedAlmacenId']) {
      return;
    }
    this.mostrarPlanta = false;
    this.plantaObjetoActivo = null;
    const id = this.embeddedAlmacenId;
    this.almacenId = id != null ? Number(id) : null;
    if (this.almacenId != null) {
      this.cargarDatos();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Cerrar dropdown si se hace clic fuera
    const target = event.target as HTMLElement;
    if (!target.closest('.position-relative')) {
      this.cerrarDropdown();
    }
  }

  ngOnDestroy(): void {
    this.cerrarDropdown();
    this.tourCleanup?.();
    this.tourCleanup = undefined;
  }

  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    Promise.all([
      firstValueFrom(this.stockAlmacenService.getAllStock()),
      firstValueFrom(this.almacenService.getAllAlmacenes()),
      firstValueFrom(this.almacenConfigService.getAllConfigs())
    ]).then(([stock, almacenes, configs]: [any, any, any]) => {
      if (stock) {
        this.stock = stock;
      }

      if (almacenes) {
        this.almacenes = almacenes;
        
        // Encontrar los almacenes especiales (búsqueda case-insensitive y flexible)
        this.almacenCementerio = findAlmacenCementerio(almacenes) || null;
        this.almacenLaboratorio = findAlmacenLaboratorio(almacenes) || null;
        this.almacenOficinaLaboratorio = findAlmacenOficinaLaboratorio(almacenes) || null;
        
        // Encontrar el almacén seleccionado (comparar como número)
        if (this.almacenId != null) {
          const idNum = Number(this.almacenId);
          this.almacenSeleccionado = this.almacenes.find(a => Number(a.id) === idNum) || null;
        }
      }

      // Mapa de configuraciones por almacén
      this.almacenConfigs = new Map();
      if (Array.isArray(configs)) {
        configs.forEach((c: AlmacenConfig) => {
          if (c.almacen?.id) this.almacenConfigs.set(c.almacen.id, c);
        });
      }

      this.cargarEquiposEspeciales();
      this.cargarPlanta();
    }).catch(async error => {
      console.error('Error al cargar datos:', error);
      this.error = 'Error al cargar los datos';
      this.loading = false;
      try {
        const [stock, almacenes] = await Promise.all([
          firstValueFrom(this.stockAlmacenService.getAllStock()),
          firstValueFrom(this.almacenService.getAllAlmacenes())
        ]);
        if (stock) this.stock = stock;
        if (almacenes) {
          this.almacenes = almacenes;
          this.almacenCementerio = findAlmacenCementerio(almacenes) || null;
          this.almacenLaboratorio = findAlmacenLaboratorio(almacenes) || null;
          this.almacenOficinaLaboratorio = findAlmacenOficinaLaboratorio(almacenes) || null;
          if (this.almacenId != null) {
            this.almacenSeleccionado = almacenes.find((a: Almacen) => Number(a.id) === Number(this.almacenId)) || null;
          }
        }
        this.almacenConfigs = new Map();
        this.cargarEquiposEspeciales();
        this.cargarPlanta();
        this.error = null;
      } catch (e) {
        console.error('Fallback de carga falló:', e);
        this.loading = false;
      }
    });
  }

  cargarPlanta(): void {
    this.plantaObjetoActivo = null;
    if (this.almacenId == null) {
      this.planta = null;
      return;
    }
    const id = Number(this.almacenId);
    this.plantaService.getByAlmacenId(id).pipe(catchError(() => of(null))).subscribe(doc => {
      this.planta = doc;
      if (this.embedStock) {
        return;
      }
      this.mostrarPlanta = !!(doc && doc.objetos && doc.objetos.length > 0);
    });
  }

  onPlantaObjectClick(obj: AlmacenPlantaObjeto): void {
    this.plantaObjetoActivo = obj;
    if (obj.tipo !== 'ESTANTERIA' || !obj.estanteriaCodigo) {
      return;
    }
    const key = this.matchEstanteriaKey(obj.estanteriaCodigo);
    this.seleccionarEstanteria(key || obj.estanteriaCodigo);
  }

  plantaOcupacion(): Record<string, { registros: number; unidades: number }> {
    return this.planta?.ocupacionPorEstanteria ?? {};
  }

  plantaDrawerItems(): any[] {
    if (!this.plantaObjetoActivo || this.plantaObjetoActivo.tipo !== 'ESTANTERIA') {
      return [];
    }
    const almacenKey = this.getAlmacenActivoKey();
    const codigo = this.plantaObjetoActivo.estanteriaCodigo;
    if (!almacenKey || !codigo) {
      return [];
    }
    const key = this.matchEstanteriaKey(codigo) || codigo;
    return this.getItemsPorEstanteria(almacenKey, key);
  }

  plantaDrawerUnidades(): number {
    return this.plantaDrawerItems().reduce((sum, item) => sum + (item?.cantidad || 1), 0);
  }

  ocupacionEtiqueta(codigo: string | null | undefined): string {
    const o = ocupacionDe(this.plantaOcupacion(), codigo);
    if (o.unidades <= 0 && o.registros <= 0) {
      return 'Vacía';
    }
    return `${o.unidades} unid. · ${o.registros} ítems`;
  }

  private matchEstanteriaKey(codigo: string): string | null {
    const almacenKey = this.getAlmacenActivoKey();
    if (!almacenKey) {
      return null;
    }
    const target = this.normalizeCodigoEstanteria(codigo);
    const keys = Object.keys(this.stockOrganizado[almacenKey] || {});
    return keys.find(k => this.normalizeCodigoEstanteria(k) === target) ?? null;
  }

  private normalizeCodigoEstanteria(raw: string): string {
    const t = (raw ?? '').trim().toUpperCase();
    if (!t) {
      return '';
    }
    return t.startsWith('E') ? `E${t.slice(1).trim()}` : `E${t}`;
  }

  cargarEquiposEspeciales(): void {
    // Si estamos viendo un almacén concreto, cargar también equipos/dispositivos en almacén o en baja
    // para que coincida con la cuenta de la lista y se puedan transferir los que faltan en stock_almacen
    const esVistaCementerio = this.almacenCementerio != null && this.almacenId != null &&
      Number(this.almacenId) === Number(this.almacenCementerio.id);
    const esVistaAlmacenConcreto = this.almacenId != null && this.almacenSeleccionado != null;

    const observables: any = {
      hardware: this.hardwareService.getHardware(),
      networkInfo: this.networkInfoService.getNetworkInfo()
    };
    if (esVistaCementerio) {
      observables.equiposEnBaja = this.estadoEquipoService.getEquiposEnBaja();
      observables.dispositivosEnBaja = this.estadoDispositivoService.getDispositivosEnBaja();
      observables.bios = this.biosService.getAllBios();
    }
    if (esVistaAlmacenConcreto) {
      observables.equiposEnAlmacen = this.estadoEquipoService.getEquiposEnAlmacen();
      observables.dispositivosEnAlmacen = this.estadoDispositivoService.getDispositivosEnAlmacen();
      if (!observables.bios) observables.bios = this.biosService.getAllBios();
    }

    forkJoin(observables).subscribe({
      next: (response: any) => {
        let stockActual = [...this.stock];
        const hardware = Array.isArray(response.hardware) ? response.hardware : [];
        const networkInfoData = response.networkInfo?.success && Array.isArray(response.networkInfo.data)
          ? response.networkInfo.data : [];
        const bios = Array.isArray(response.bios) ? response.bios : [];

        if (esVistaCementerio && this.almacenCementerio && response.equiposEnBaja != null) {
          const itemsCementerio = this.convertirEnBajaAStockCementerio(
            response.equiposEnBaja,
            response.dispositivosEnBaja || { success: false, data: [] },
            hardware,
            bios,
            { success: true, data: networkInfoData }
          );
          stockActual = this.mergeSinDuplicadosPorNumero(stockActual, itemsCementerio, this.almacenCementerio.id);
        }

        // Para cualquier almacén: añadir equipos que están "en almacén" según estado pero no en stock_almacen
        if (esVistaAlmacenConcreto && this.almacenSeleccionado && response.equiposEnAlmacen != null) {
          const itemsEnAlmacen = this.convertirEquiposEnAlmacenAStock(
            response.equiposEnAlmacen,
            response.dispositivosEnAlmacen || { success: false, data: [] },
            hardware,
            bios,
            { success: true, data: networkInfoData },
            this.almacenSeleccionado
          );
          stockActual = this.mergeSinDuplicadosPorNumero(stockActual, itemsEnAlmacen, this.almacenSeleccionado.id);
        }

        // Enriquecer stock: marcar equipos/dispositivos (item_id null) con esEquipoEspecial
        const stockEnriquecido = this.enriquecerStockConEquipos(stockActual, hardware, networkInfoData);

        // Filtrar por almacén si hay un ID específico
        let stockCompleto = [...stockEnriquecido];
        if (this.almacenId != null) {
          const idBuscado = Number(this.almacenId);
          stockCompleto = stockCompleto.filter(item => item.almacen != null && Number(item.almacen.id) === idBuscado);
        }

        this.organizarStock(stockCompleto);
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error al enriquecer stock:', error);
        let stockCompleto = [...this.stock];
        if (this.almacenId != null) {
          const idBuscado = Number(this.almacenId);
          stockCompleto = stockCompleto.filter(item => item.almacen != null && Number(item.almacen.id) === idBuscado);
        }
        this.organizarStock(stockCompleto);
        this.loading = false;
      }
    });
  }

  /**
   * Para filas sin ítem de catálogo (item_id null): marca como equipo/dispositivo solo si el `numero`
   * coincide con inventario (hardware o red) o si la fila ya viene de APIs de equipos con `estadoInfo`.
   * El resto (insumos manuales, etc.) queda como ítem y no muestra Transferir/Reactivar.
   */
  enriquecerStockConEquipos(stock: any[], hardware: any[], networkInfoData: any[]): any[] {
    const networkByMac = new Map<string, any>(networkInfoData.map((d: any) => [d.mac, d]));
    const networkByName = new Map<string, any>();
    networkInfoData.forEach((d: any) => {
      if (d.name) networkByName.set(d.name, d);
    });

    return stock.map(item => {
      const idItem = item.item?.idItem ?? item.item?.id;
      if (idItem != null) {
        return item; // Item de compra (lote) - no es equipo transferido
      }

      const numero = item.numero || item.item?.nombreItem || '';
      if (!numero) return item;

      // Buscar como EQUIPO (hardware por nombre, case-insensitive)
      const numeroNorm = (numero || '').trim().toLowerCase();
      const hw = hardware.find((h: any) => (h.name || '').trim().toLowerCase() === numeroNorm);
      if (hw) {
        return {
          ...item,
          itemId: hw.id,
          esEquipoEspecial: true,
          tipoEquipo: 'EQUIPO',
          estadoInfo: { hardwareId: hw.id }
        };
      }

      // Buscar como DISPOSITIVO (por mac o name - numero en stock puede ser la MAC)
      const device = networkByMac.get(numero) || networkByName.get(numero.trim()) ||
        networkInfoData.find((d: any) => (d.mac || '') === numero || (d.name || '').toLowerCase() === numeroNorm);
      if (device) {
        return {
          ...item,
          itemId: null,
          esEquipoEspecial: true,
          tipoEquipo: 'DISPOSITIVO',
          estadoInfo: { mac: device.mac }
        };
      }

      // Sin coincidencia en hardware/red: solo "PC transferido" si ya viene de APIs de equipos/estado
      if (item.esEquipoEspecial === true && item.estadoInfo != null) {
        return item;
      }

      // Stock manual (p. ej. insumos sin compra) u homónimo no inventariado → columna Tipo: Ítem; botones editar
      return item;
    });
  }

  /**
   * Convierte equipos/dispositivos en baja a formato stock (misma fuente que /menu/cementerio).
   */
  private convertirEnBajaAStockCementerio(
    equiposEnBaja: any,
    dispositivosEnBaja: any,
    hardware: any[],
    bios: any[],
    networkInfo: any
  ): any[] {
    if (!this.almacenCementerio) return [];
    const almacenNorm = {
      id: this.almacenCementerio.id,
      numero: this.almacenCementerio.numero,
      nombre: this.almacenCementerio.nombre
    };
    const items: any[] = [];
    const biosMap = new Map((bios || []).map((b: any) => [b.hardwareId, b]));

    if (equiposEnBaja?.success && Array.isArray(equiposEnBaja.data)) {
      equiposEnBaja.data.forEach((estado: any) => {
        const hw = (hardware || []).find((h: any) => h.id === estado.hardwareId);
        if (hw) {
          const ubic = this.extraerUbicacionDeObservaciones(estado.observaciones);
          const biosData = biosMap.get(estado.hardwareId);
          items.push({
            id: `equipo-cementerio-${estado.hardwareId}`,
            item: { idItem: null, nombreItem: hw.name || `Equipo ${estado.hardwareId}` },
            almacen: almacenNorm,
            estanteria: ubic.estanteria || 'Sin ubicación',
            estante: ubic.estante || 'Sin ubicación',
            cantidad: 1,
            numero: hw.name || `EQ-${estado.hardwareId}`,
            descripcion: `Equipo transferido: ${hw.name || estado.hardwareId}`,
            esEquipoEspecial: true,
            tipoEquipo: 'EQUIPO',
            estadoInfo: { ...estado, hardwareId: estado.hardwareId }
          });
        }
      });
    }

    if (dispositivosEnBaja?.success && Array.isArray(dispositivosEnBaja.data) &&
        networkInfo?.success && Array.isArray(networkInfo.data)) {
      const netMap = new Map(networkInfo.data.map((d: any) => [d.mac, d]));
      dispositivosEnBaja.data.forEach((estado: any) => {
        const device = netMap.get(estado.mac) as any;
        if (device) {
          const ubic = this.extraerUbicacionDeObservaciones(estado.observaciones);
          items.push({
            id: `dispositivo-cementerio-${estado.mac}`,
            item: { idItem: null, nombreItem: device?.name || estado.mac },
            almacen: almacenNorm,
            estanteria: ubic.estanteria || 'Sin ubicación',
            estante: ubic.estante || 'Sin ubicación',
            cantidad: 1,
            numero: device?.mac ?? estado.mac,
            descripcion: `Dispositivo transferido: ${device?.name || estado.mac}`,
            esEquipoEspecial: true,
            tipoEquipo: 'DISPOSITIVO',
            estadoInfo: { ...estado, mac: estado.mac }
          });
        }
      });
    }
    return items;
  }

  /**
   * Une ítems del cementerio desde "en baja" sin duplicar con los que ya vienen de stock_almacen.
   */
  private mergeCementerioSinDuplicados(stockActual: any[], itemsCementerio: any[]): any[] {
    return this.mergeSinDuplicadosPorNumero(
      stockActual,
      itemsCementerio,
      this.almacenCementerio != null ? this.almacenCementerio.id : 0
    );
  }

  /**
   * Añade ítems nuevos sin duplicar por numero respecto al stock ya existente en el almacén.
   */
  private mergeSinDuplicadosPorNumero(
    stockActual: any[],
    nuevosItems: any[],
    almacenId: number
  ): any[] {
    const numerosExistentes = new Set<string>();
    stockActual
      .filter(item => item.almacen && Number(item.almacen.id) === Number(almacenId))
      .forEach(item => {
        const num = (item.numero || '').toString().trim().toLowerCase();
        if (num) numerosExistentes.add(num);
      });
    const añadidos = nuevosItems.filter(item => {
      const num = (item.numero || '').toString().trim().toLowerCase();
      return num && !numerosExistentes.has(num);
    });
    return [...stockActual, ...añadidos];
  }

  /**
   * Extrae estantería, estante y sección del texto de observaciones guardado al transferir
   * (formato backend: "Estantería: E1, Estante: 2, Sección: A").
   */
  private extraerUbicacionDeObservaciones(observaciones: string | null | undefined): {
    estanteria: string | null;
    estante: string | null;
    seccion: string | null;
  } {
    const result = { estanteria: null as string | null, estante: null as string | null, seccion: null as string | null };
    if (!observaciones || typeof observaciones !== 'string') return result;
    const text = observaciones.trim();
    const estanteriaMatch = text.match(/Estantería:\s*([^,|]+)/i);
    const estanteMatch = text.match(/Estante:\s*([^,|]+)/i);
    const seccionMatch = text.match(/Sección:\s*([^,|]+)/i);
    if (estanteriaMatch) result.estanteria = estanteriaMatch[1].trim();
    if (estanteMatch) result.estante = estanteMatch[1].trim();
    if (seccionMatch) result.seccion = seccionMatch[1].trim();
    return result;
  }

  /**
   * Convierte equipos/dispositivos "en almacén" (estado) a formato stock para el almacén actual.
   * Solo incluye los que tienen estado.almacenId === almacen.id.
   * Usa la ubicación guardada en observaciones (Estantería/Estante/Sección) para mostrarlos en la card correcta.
   */
  private convertirEquiposEnAlmacenAStock(
    equiposResponse: any,
    dispositivosResponse: any,
    hardware: any[],
    bios: any[],
    networkInfo: any,
    almacen: { id: number; numero?: string; nombre?: string }
  ): any[] {
    const items: any[] = [];
    const idAlmacen = Number(almacen.id);
    if (!Array.isArray(hardware)) hardware = [];
    if (!Array.isArray(bios)) bios = [];
    const biosMap = new Map(bios.map((b: any) => [b.hardwareId, b]));
    const almacenNormalizado = {
      id: almacen.id,
      numero: almacen.numero,
      nombre: almacen.nombre
    };

    if (equiposResponse?.success && Array.isArray(equiposResponse.data)) {
      const equiposDelAlmacen = equiposResponse.data.filter(
        (estado: any) => estado.almacenId != null && Number(estado.almacenId) === idAlmacen
      );
      equiposDelAlmacen.forEach((estado: any) => {
        const hw = hardware.find((h: any) => h.id === estado.hardwareId);
        if (hw) {
          const ubic = this.extraerUbicacionDeObservaciones(estado.observaciones);
          const estanteria = ubic.estanteria || 'Sin ubicación';
          const estante = ubic.estante || 'Sin ubicación';
          const biosData = biosMap.get(estado.hardwareId);
          const item: any = {
            id: `equipo-${estado.hardwareId}-almacen-${idAlmacen}`,
            itemId: estado.hardwareId,
            idCompra: null,
            almacen: almacenNormalizado,
            estanteria,
            estante,
            cantidad: 1,
            numero: hw.name || `EQ-${estado.hardwareId}`,
            descripcion: `${hw.name || 'Equipo'} - ${biosData?.type || 'N/A'} | ${hw.osName || 'N/A'}`,
            fechaRegistro: estado.fechaCambio,
            item: {
              nombreItem: hw.name || `Equipo ${estado.hardwareId}`,
              descripcion: `${biosData?.type || 'N/A'} | ${hw.osName || 'N/A'}`
            },
            esEquipoEspecial: true,
            tipoEquipo: 'EQUIPO',
            estadoInfo: estado
          };
          if (ubic.seccion) item.seccion = ubic.seccion;
          items.push(item);
        }
      });
    }

    if (
      dispositivosResponse?.success &&
      Array.isArray(dispositivosResponse.data) &&
      networkInfo?.success &&
      Array.isArray(networkInfo.data)
    ) {
      const networkInfoMap = new Map(networkInfo.data.map((device: any) => [device.mac, device]));
      const dispositivosDelAlmacen = (dispositivosResponse.data as any[]).filter(
        (estado: any) => estado.almacenId != null && Number(estado.almacenId) === idAlmacen
      );
      dispositivosDelAlmacen.forEach((estado: any) => {
        const device: any = networkInfoMap.get(estado.mac);
        if (device) {
          const ubic = this.extraerUbicacionDeObservaciones(estado.observaciones);
          const estanteria = ubic.estanteria || 'Sin ubicación';
          const estante = ubic.estante || 'Sin ubicación';
          const item: any = {
            id: `dispositivo-${estado.mac}-almacen-${idAlmacen}`,
            itemId: null,
            idCompra: null,
            almacen: almacenNormalizado,
            estanteria,
            estante,
            cantidad: 1,
            numero: device.mac,
            descripcion: `${device.name || device.mac} - ${device.type || 'N/A'}`,
            fechaRegistro: estado.fechaCambio,
            item: {
              nombreItem: device.name || device.mac,
              descripcion: `${device.type || 'N/A'} | ${device.description || 'Sin descripción'}`
            },
            esEquipoEspecial: true,
            tipoEquipo: 'DISPOSITIVO',
            estadoInfo: estado
          };
          if (ubic.seccion) item.seccion = ubic.seccion;
          items.push(item);
        }
      });
    }
    return items;
  }

  organizarStock(stock: any[]): void {
    // Organizar stock por almacén y estantería (equipos cementerio pueden tener estantería/estante null)
    const grupos: { [key: string]: { [key: string]: any[] } } = {};

    stock.forEach(item => {
      const almacen = item.almacen;
      const almacenKey = almacen
        ? `${almacen.numero ?? 'Sin número'} - ${almacen.nombre ?? 'Sin nombre'}`
        : 'Sin almacén';
      const estanteriaKey = item.estanteria != null && item.estanteria !== ''
        ? String(item.estanteria)
        : 'Sin ubicación';

      if (!grupos[almacenKey]) {
        grupos[almacenKey] = {};
      }
      if (!grupos[almacenKey][estanteriaKey]) {
        grupos[almacenKey][estanteriaKey] = [];
      }

      grupos[almacenKey][estanteriaKey].push(item);
    });

    // Para cada almacén con AlmacenConfig, asegurar que las estanterías definidas en config estén presentes
    this.almacenes.forEach(almacen => {
      const config = this.almacenConfigs.get(almacen.id);
      if (!config) return;
      const almacenKey = Object.keys(grupos).find(k => 
        k.includes(almacen.numero || '') && k.includes(almacen.nombre || '')
      );
      if (!almacenKey) return;
      for (const d of estanteriasOrdenadas(config)) {
        const estanteria = d.codigo;
        if (!grupos[almacenKey][estanteria]) {
          grupos[almacenKey][estanteria] = [];
        }
      }
    });

    this.stockOrganizado = grupos;
    this.ensureSelectedHierarchy();
  }

  onSearchTermChange(): void {
    this.ensureSelectedHierarchy();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.ensureSelectedHierarchy();
  }

  getAlmacenActivoKey(): string | null {
    const almacenes = this.getAlmacenes();
    if (almacenes.length === 0) return null;
    if (this.selectedAlmacenKey && almacenes.includes(this.selectedAlmacenKey)) {
      return this.selectedAlmacenKey;
    }
    return almacenes[0];
  }

  seleccionarEstanteria(estanteria: string): void {
    const almacenKey = this.getAlmacenActivoKey();
    if (!almacenKey) return;
    this.selectedAlmacenKey = almacenKey;
    this.selectedEstanteriaKey = estanteria;
    this.selectedEstanteKey = null;
    this.syncListadoOrdenado(true);
  }

  seleccionarEstante(estanteria: string, estante: string): void {
    const almacenKey = this.getAlmacenActivoKey();
    if (!almacenKey) return;
    this.selectedAlmacenKey = almacenKey;
    this.selectedEstanteriaKey = estanteria;
    this.selectedEstanteKey = estante;
    this.syncListadoOrdenado(true);
  }

  limpiarSeleccionUbicacion(): void {
    this.selectedEstanteriaKey = null;
    this.selectedEstanteKey = null;
    this.syncListadoOrdenado(true);
  }

  /**
   * Recalcula el listado ordenado y opcionalmente vuelve a la página 1.
   * Llamar al cambiar datos, búsqueda o selección de ubicación.
   */
  private syncListadoOrdenado(resetPage: boolean): void {
    const almacenKey = this.getAlmacenActivoKey();
    if (!almacenKey) {
      this.itemsListadoOrdenados = [];
      if (resetPage) this.listadoPage = 1;
      return;
    }

    let items: any[] = [];
    if (this.selectedEstanteriaKey && this.selectedEstanteKey) {
      items = this.getItemsPorEstante(almacenKey, this.selectedEstanteriaKey, this.selectedEstanteKey);
    } else if (this.selectedEstanteriaKey) {
      items = this.getItemsPorEstanteria(almacenKey, this.selectedEstanteriaKey);
    } else {
      const estanterias = this.getEstanterias(almacenKey);
      items = estanterias.flatMap(est => this.getItemsPorEstanteria(almacenKey, est));
    }

    this.itemsListadoOrdenados = [...items].sort((a, b) => {
      const estA = this.normalizarClaveOrden(a?.estanteria);
      const estB = this.normalizarClaveOrden(b?.estanteria);
      if (estA !== estB) return estA.localeCompare(estB, undefined, { numeric: true });

      const estanteA = this.normalizarClaveOrden(a?.estante);
      const estanteB = this.normalizarClaveOrden(b?.estante);
      if (estanteA !== estanteB) return estanteA.localeCompare(estanteB, undefined, { numeric: true });

      const nombreA = this.normalizarClaveOrden(a?.item?.nombreItem || a?.numero);
      const nombreB = this.normalizarClaveOrden(b?.item?.nombreItem || b?.numero);
      return nombreA.localeCompare(nombreB, undefined, { numeric: true });
    });

    if (resetPage) {
      this.listadoPage = 1;
    }
    this.clampListadoPage();
  }

  private clampListadoPage(): void {
    const total = this.itemsListadoOrdenados.length;
    const maxPage = Math.max(1, Math.ceil(total / this.listadoPageSize) || 1);
    if (this.listadoPage > maxPage) {
      this.listadoPage = maxPage;
    }
  }

  /** Total de filas del listado actual (sin paginar) */
  getItemsVistaActual(): any[] {
    return this.itemsListadoOrdenados;
  }

  /** Filas visibles en la página actual del listado */
  getPagedListadoItems(): any[] {
    const start = (this.listadoPage - 1) * this.listadoPageSize;
    return this.itemsListadoOrdenados.slice(start, start + this.listadoPageSize);
  }

  getListadoCollectionSize(): number {
    return this.itemsListadoOrdenados.length;
  }

  /** Primera fila visible en la página actual (1-based), 0 si no hay ítems */
  getListadoMostrandoDesde(): number {
    const total = this.getListadoCollectionSize();
    if (total === 0) return 0;
    return (this.listadoPage - 1) * this.listadoPageSize + 1;
  }

  /** Última fila visible en la página actual */
  getListadoMostrandoHasta(): number {
    const total = this.getListadoCollectionSize();
    if (total === 0) return 0;
    return Math.min(this.listadoPage * this.listadoPageSize, total);
  }

  /**
   * Al paginar: poner a cero tabla interna, cadena de padres, main, documento y ventana;
   * luego `scrollIntoView` en el título (con scroll-margin por el header fijo del menú).
   */
  onListadoPageChange(_page: number): void {
    const scrollTodoAlInicio = (): void => {
      const tableWrap = this.listadoTableScrollRef?.nativeElement;
      if (tableWrap) {
        tableWrap.scrollTop = 0;
      }

      let node: HTMLElement | null = this.stockPaginaInicioRef?.nativeElement ?? null;
      while (node) {
        if (node.scrollTop) {
          node.scrollTop = 0;
        }
        node = node.parentElement;
      }

      const main = document.querySelector('.main-content') as HTMLElement | null;
      if (main) {
        main.scrollTop = 0;
      }

      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);

      this.stockPaginaInicioRef?.nativeElement?.scrollIntoView({
        behavior: 'auto',
        block: 'start',
        inline: 'nearest'
      });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollTodoAlInicio();
        requestAnimationFrame(scrollTodoAlInicio);
      });
    });
  }

  trackByListadoItem(_index: number, item: any): string | number {
    if (item?.id != null) return item.id;
    const num = item?.numero ?? '';
    const est = `${item?.estanteria ?? ''}|${item?.estante ?? ''}|${item?.seccion ?? ''}`;
    return `${est}:${num}`;
  }

  getTotalUnidadesVistaActual(): number {
    return this.getItemsVistaActual().reduce((acc, item) => acc + Number(item?.cantidad || 1), 0);
  }

  getTotalEstanteriasVisibles(): number {
    const almacenKey = this.getAlmacenActivoKey();
    return almacenKey ? this.getEstanterias(almacenKey).length : 0;
  }

  getTotalEstantesVisibles(): number {
    const almacenKey = this.getAlmacenActivoKey();
    if (!almacenKey) return 0;
    return this.getEstanterias(almacenKey)
      .reduce((acc, estanteriaKey) => acc + this.getEstantesPorEstanteria(almacenKey, estanteriaKey).length, 0);
  }

  getEtiquetaSeleccionActual(): string {
    if (this.selectedEstanteriaKey && this.selectedEstanteKey) {
      return `${this.selectedEstanteriaKey} / Estante ${this.selectedEstanteKey}`;
    }
    if (this.selectedEstanteriaKey) {
      return `${this.selectedEstanteriaKey} (todos los estantes)`;
    }
    return 'Todas las ubicaciones';
  }

  etiquetaItemStock(item: any): string {
    return (item?.item?.nombreItem || item?.descripcion || item?.numero || 'Sin nombre').toString();
  }

  tipoItemStock(item: any): string {
    if (this.esEquipoEspecial(item)) {
      return this.getTipoEquipo(item) === 'DISPOSITIVO' ? 'Dispositivo' : 'Equipo';
    }
    return 'Ítem';
  }

  ubicacionItemStock(item: any): string {
    const partes = [item?.estanteria, item?.estante, item?.seccion]
      .map((p) => (p == null ? '' : String(p).trim()))
      .filter((p) => p && p !== '-');
    return partes.length ? partes.join(' / ') : 'Sin ubicación';
  }

  private filaPdfStock(item: any): string[] {
    return [
      this.tipoItemStock(item),
      this.etiquetaItemStock(item),
      String(item?.cantidad ?? 1),
      this.ubicacionItemStock(item),
      item?.numero || '-',
      item?.descripcion || item?.item?.descripcion || '-'
    ];
  }

  private ensureSelectedHierarchy(): void {
    const almacenes = this.getAlmacenes();
    if (almacenes.length === 0) {
      this.selectedAlmacenKey = null;
      this.selectedEstanteriaKey = null;
      this.selectedEstanteKey = null;
      this.syncListadoOrdenado(true);
      return;
    }

    if (!this.selectedAlmacenKey || !almacenes.includes(this.selectedAlmacenKey)) {
      this.selectedAlmacenKey = almacenes[0];
      this.selectedEstanteriaKey = null;
      this.selectedEstanteKey = null;
      this.syncListadoOrdenado(true);
      return;
    }

    if (this.selectedEstanteriaKey) {
      const estanterias = this.getEstanterias(this.selectedAlmacenKey);
      if (!estanterias.includes(this.selectedEstanteriaKey)) {
        this.selectedEstanteriaKey = null;
        this.selectedEstanteKey = null;
        this.syncListadoOrdenado(true);
        return;
      }
    }

    if (this.selectedEstanteriaKey && this.selectedEstanteKey) {
      const estantes = this.getEstantesPorEstanteria(this.selectedAlmacenKey, this.selectedEstanteriaKey);
      if (!estantes.includes(this.selectedEstanteKey)) {
        this.selectedEstanteKey = null;
      }
    }

    this.syncListadoOrdenado(true);
  }

  private normalizarClaveOrden(value: any): string {
    return String(value ?? '').trim().toLowerCase();
  }

  getAlmacenes(): string[] {
    const almacenes = Object.keys(this.stockOrganizado);
    if (!this.searchTerm?.trim()) return almacenes;
    return almacenes.filter(alm => this.almacenTieneItemsCoincidentes(alm));
  }

  private almacenTieneItemsCoincidentes(almacen: string): boolean {
    const estanterias = Object.keys(this.stockOrganizado[almacen] || {});
    return estanterias.some(est => this.estanteriaTieneItemsCoincidentes(almacen, est));
  }

  private estanteriaTieneItemsCoincidentes(almacen: string, estanteria: string): boolean {
    const items = this.getStockPorEstanteria(almacen, estanteria);
    return items.some((item: any) => this.itemCoincideConBusqueda(item));
  }

  /** Indica si el almacén tiene AlmacenConfig con estructura (estanterías/estantes definidos) */
  tieneConfigConEstructura(almacenKey: string): boolean {
    const almacenMatch = this.almacenes.find(a =>
      almacenKey.includes(a.numero || '') && almacenKey.includes(a.nombre || '')
    );
    return almacenMatch ? this.almacenConfigs.has(almacenMatch.id) : false;
  }

  /**
   * Usar layout simplificado (una card con todo el contenido, sin estantes) cuando NO hay AlmacenConfig.
   * Con config definido → grid de estanterías y estantes. Sin config (ej. cementerio) → una sola card.
   */
  usarLayoutSimplificado(almacenKey: string): boolean {
    return !this.tieneConfigConEstructura(almacenKey);
  }

  /** Indica si el almacén es cementerio, laboratorio u oficina lab — para estilos de items, no para layout */
  esAlmacenCementerioOLaboratorio(almacenKey: string): boolean {
    const k = (almacenKey || '').toLowerCase();
    return k.includes('alm01') || k.includes('alm 01') || k.includes('cementerio') || k.includes('subsuelo') ||
           k.includes('alm05') || k.includes('alm 05') || k.includes('pañol 3') ||
           k.includes('ofilab') || k.includes('oficina laboratorio') ||
           (k.includes('laboratorio') && !k.includes('oficina'));
  }

  getEstanterias(almacen: string): string[] {
    const keys = Object.keys(this.stockOrganizado[almacen] || {});
    const ordenadas = this.ordenarClavesNumericas(keys);
    if (!this.searchTerm?.trim()) return ordenadas;
    return ordenadas.filter(est => this.estanteriaTieneItemsCoincidentes(almacen, est));
  }

  /**
   * Ordena claves que pueden ser numéricas (1,2,3) o alfanuméricas (E1,E2,E3)
   * para mantener orden consistente independientemente del orden de inserción.
   */
  private ordenarClavesNumericas(keys: string[]): string[] {
    return [...keys].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      const aTieneNumero = !isNaN(numA) && a.match(/\d/);
      const bTieneNumero = !isNaN(numB) && b.match(/\d/);
      if (aTieneNumero && bTieneNumero) {
        return numA - numB;
      }
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }

  getStockPorEstanteria(almacen: string, estanteria: string): any[] {
    return this.stockOrganizado[almacen]?.[estanteria] || [];
  }

  getTotalStockPorAlmacen(almacen: string): number {
    const estanterias = this.getEstanterias(almacen);
    if (!this.searchTerm?.trim()) {
      return estanterias.reduce((total, estanteria) => {
        const stock = this.getStockPorEstanteria(almacen, estanteria);
        return total + stock.reduce((sum, item) => sum + (item.cantidad || 1), 0);
      }, 0);
    }
    return estanterias.reduce((total, estanteria) => {
      const stock = this.getStockPorEstanteria(almacen, estanteria);
      return total + stock
        .filter((item: any) => this.itemCoincideConBusqueda(item))
        .reduce((sum, item) => sum + (item.cantidad || 1), 0);
    }, 0);
  }

  getTotalStockPorEstanteria(almacen: string, estanteria: string): number {
    const stock = this.getStockPorEstanteria(almacen, estanteria);
    if (!this.searchTerm?.trim()) {
      return stock.reduce((total, item) => total + (item.cantidad || 1), 0);
    }
    return stock
      .filter((item: any) => this.itemCoincideConBusqueda(item))
      .reduce((total, item) => total + (item.cantidad || 1), 0);
  }

  getTotalAlmacenes(): number {
    return this.getAlmacenes().length;
  }

  /** Clave normalizada para estante (null/vacío → 'Sin ubicación') */
  private normalizarClaveEstante(estante: any): string {
    return estante != null && estante !== '' ? String(estante) : 'Sin ubicación';
  }

  // Nuevos métodos para la estructura de estantes
  getEstantesPorEstanteria(almacen: string, estanteria: string): string[] {
    const stockItems = this.getStockPorEstanteria(almacen, estanteria);
    const estantes = new Set<string>();
    stockItems.forEach(item => {
      if (!this.searchTerm?.trim() || this.itemCoincideConBusqueda(item)) {
        estantes.add(this.normalizarClaveEstante(item.estante));
      }
    });

    // Para almacenes con AlmacenConfig, mostrar todos los estantes aunque estén vacíos (solo sin filtro)
    const almacenMatch = this.almacenes.find(a => 
      almacen.includes(a.numero || '') && almacen.includes(a.nombre || '')
    );
    const config = almacenMatch ? this.almacenConfigs.get(almacenMatch.id) : null;
    const definicion = config ? defEstanteria(config, estanteria) : undefined;
    const esEstanteriaValida = !!definicion;

    if (!this.searchTerm?.trim() && config && esEstanteriaValida && definicion) {
      for (let i = 1; i <= definicion.cantidadEstantes; i++) {
        estantes.add(i.toString());
      }
    }

    return this.ordenarClavesNumericas(Array.from(estantes));
  }
  
  /**
   * Verifica si un estante está vacío
   */
  estaEstanteVacio(almacen: string, estanteria: string, estante: string): boolean {
    const items = this.getItemsPorEstante(almacen, estanteria, estante);
    return items.length === 0;
  }

  /** Items por estante sin filtrar por búsqueda (para uso interno) */
  private getItemsPorEstanteSinFiltrar(almacen: string, estanteria: string, estante: string): any[] {
    const stockItems = this.getStockPorEstanteria(almacen, estanteria);
    return stockItems.filter(item => this.normalizarClaveEstante(item.estante) === estante);
  }

  getItemsPorEstante(almacen: string, estanteria: string, estante: string): any[] {
    const items = this.getItemsPorEstanteSinFiltrar(almacen, estanteria, estante);
    if (!this.searchTerm?.trim()) return items;
    return items.filter(item => this.itemCoincideConBusqueda(item));
  }

  /** Items de toda la estantería (para cementerio/laboratorio sin cards de estante) */
  getItemsPorEstanteria(almacen: string, estanteria: string): any[] {
    const stock = this.getStockPorEstanteria(almacen, estanteria);
    if (!this.searchTerm?.trim()) return stock;
    return stock.filter((item: any) => this.itemCoincideConBusqueda(item));
  }

  /**
   * Abre el modal para modificar la cantidad de un item
   */
  /**
   * Edita ubicación y datos del registro en stock_almacen (ítems de compra / insumos registrados).
   * No aplica a equipos/dispositivos transferidos (esEquipoEspecial).
   */
  /**
   * ID numérico en `stock_almacen`; `null` para equipos/dispositivos o filas sintéticas.
   */
  getStockAlmacenNumericId(item: any): number | null {
    if (!item || item.esEquipoEspecial === true) return null;
    const raw = item.id;
    const stockId =
      raw == null ? NaN : typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    if (!Number.isFinite(stockId) || stockId <= 0) return null;
    return stockId;
  }

  abrirModalEditarRegistro(item: any): void {
    if (item?.esEquipoEspecial) {
      return;
    }
    if (this.permissionsService.denyUnless(this.canManageStock(), 'modificar el stock')) {
      return;
    }
    const stockId = this.getStockAlmacenNumericId(item);
    if (stockId == null) {
      this.notificationService.showError(
        'No editable',
        'Este ítem no tiene un registro de stock válido para editar (p. ej. filas solo de visualización).'
      );
      return;
    }

    const modalRef = this.modalService.open(EditarRegistroStockModalComponent, { size: 'lg', backdrop: true });
    modalRef.componentInstance.item = item;
    modalRef.result
      .then((result: { success?: boolean }) => {
        if (result?.success) {
          this.cargarDatos();
        }
      })
      .catch(() => {});
  }

  abrirModalCantidad(item: any, _modal?: any): void {
    if (item.esEquipoEspecial) {
      this.notificationService.showError(
        'No se puede modificar',
        'Los equipos del cementerio y almacén laboratorio no se pueden modificar desde aquí. Use las secciones correspondientes.'
      );
      return;
    }

    if (this.permissionsService.denyUnless(this.canManageStock(), 'modificar el stock')) {
      return;
    }

    const modalRef = this.modalService.open(ModificarCantidadModalComponent, { size: 'md' });
    modalRef.componentInstance.item = item;
    modalRef.result.then((result: { success?: boolean }) => {
      if (result?.success) this.cargarDatos();
    }).catch(() => {});
  }

  eliminarRegistroStock(item: any): void {
    if (item?.esEquipoEspecial) {
      return;
    }
    if (this.permissionsService.denyUnless(this.canDeleteStock(), 'eliminar stock')) {
      return;
    }
    const stockId = this.getStockAlmacenNumericId(item);
    if (stockId == null) {
      this.notificationService.showError(
        'No eliminable',
        'Este ítem no tiene un registro de stock válido para eliminar.'
      );
      return;
    }
    const numTxt = item?.numero != null ? String(item.numero).trim() : '';
    const descTxt = item?.descripcion != null ? String(item.descripcion).trim() : '';
    this.stockEliminarEtiqueta = item?.item?.nombreItem || numTxt || descTxt || `#${stockId}`;
    this.stockRegistroParaEliminar = item;
    this.showConfirmEliminarStock = true;
  }

  cancelarConfirmacionEliminarStock(): void {
    this.showConfirmEliminarStock = false;
    this.stockRegistroParaEliminar = null;
  }

  confirmarEliminacionRegistroStock(): void {
    const item = this.stockRegistroParaEliminar;
    if (!item) return;
    const stockId = this.getStockAlmacenNumericId(item);

    this.showConfirmEliminarStock = false;
    this.stockRegistroParaEliminar = null;

    if (stockId == null) return;

    this.eliminandoStockId = stockId;
    this.stockAlmacenService.deleteStock(stockId).subscribe({
      next: () => {
        this.eliminandoStockId = null;
        this.cargarDatos();
      },
      error: () => {
        this.eliminandoStockId = null;
      },
    });
  }

  /**
   * Verifica si el usuario puede gestionar stock
   */
  canManageStock(): boolean {
    return this.permissionsService.canManageWarehouseAssets();
  }

  canDeleteStock(): boolean {
    return this.permissionsService.canDeleteStock();
  }

  canTransferStock(): boolean {
    return this.permissionsService.canTransferOrReactivateInCemeteryOrLabWarehouse();
  }

  /** Abre el modal de registrar stock sin cambiar de pantalla, con el almacén actual pre-seleccionado */
  irARegistrarStock(): void {
    if (this.permissionsService.denyUnless(this.canManageStock(), 'registrar stock')) {
      return;
    }
    if (this.almacenId == null) return;
    const modalRef = this.modalService.open(RegistrarStockModalComponent, { size: 'lg', backdrop: true });
    modalRef.componentInstance.almacenIdPreseleccionado = this.almacenId;
    modalRef.result.then((result: { success?: boolean }) => {
      if (result?.success) {
        this.cargarDatos();
      }
    }).catch(() => {});
  }

  /**
   * Helper para verificar si un item es equipo especial
   */
  esEquipoEspecial(item: any): boolean {
    return item?.esEquipoEspecial === true;
  }

  /**
   * Helper para obtener el tipo de equipo
   */
  getTipoEquipo(item: any): string {
    return item?.tipoEquipo || '';
  }

  /**
   * Helper para obtener la descripción del equipo especial
   */
  getDescripcionEquipo(item: any): string {
    return item?.descripcion || '';
  }

  /**
   * Identifica el tipo de almacén de un item: 'cementerio', 'laboratorio', o 'regular'
   */
  getTipoAlmacen(item: any): 'cementerio' | 'laboratorio' | 'oficina_laboratorio' | 'regular' | null {
    if (!this.esEquipoEspecial(item)) {
      return 'regular';
    }

    // Verificar si el item tiene estadoInfo con almacenId
    const almacenId = item?.estadoInfo?.almacenId || item?.almacen?.id;
    
    // Si no tiene almacenId pero está en baja, es cementerio
    if (item?.estadoInfo?.baja === true) {
      return 'cementerio';
    }

    // Comparar con almacenes especiales
    if (almacenId) {
      if (this.almacenCementerio && almacenId === this.almacenCementerio.id) {
        return 'cementerio';
      }
      if (this.almacenOficinaLaboratorio && almacenId === this.almacenOficinaLaboratorio.id) {
        return 'oficina_laboratorio';
      }
      if (this.almacenLaboratorio && almacenId === this.almacenLaboratorio.id) {
        return 'laboratorio';
      }
      if (item?.almacen && esAlmacenOficinaLaboratorio(item.almacen)) {
        return 'oficina_laboratorio';
      }
      // Si tiene almacenId pero no es cementerio ni laboratorio, es regular
      return 'regular';
    }

    // Verificar por nombre de almacén como fallback
    const almacenNombre = item?.almacen?.nombre?.toLowerCase() || '';
    const almacenNumero = item?.almacen?.numero?.toLowerCase() || '';
    
    if (almacenNumero.includes('alm01') || almacenNombre.includes('subsuelo') || almacenNombre.includes('cementerio')) {
      return 'cementerio';
    }

    if (almacenNumero.includes('ofilab') || almacenNombre.includes('oficina laboratorio')) {
      return 'oficina_laboratorio';
    }
    
    if (almacenNumero.includes('alm05') || almacenNombre.includes('pañol 3') ||
        (almacenNombre.includes('laboratorio') && !almacenNombre.includes('oficina'))) {
      return 'laboratorio';
    }

    return 'regular';
  }

  /**
   * Obtiene el icono según el tipo de almacén
   */
  getIconoAlmacen(item: any): string {
    if (!this.esEquipoEspecial(item)) {
      return 'fa-warehouse'; // Almacén regular
    }

    const tipoAlmacen = this.getTipoAlmacen(item);
    
    switch (tipoAlmacen) {
      case 'cementerio':
        return 'fa-skull-crossbones'; // Icono de cementerio
      case 'oficina_laboratorio':
        return 'fa-tools';
      case 'laboratorio':
        return 'fa-flask'; // Icono de laboratorio
      case 'regular':
        return 'fa-warehouse'; // Icono de almacén regular
      default:
        return 'fa-box';
    }
  }

  /**
   * Obtiene el color de fondo del badge según el tipo de almacén
   */
  getBadgeColorAlmacen(item: any): string {
    const tipoAlmacen = this.getTipoAlmacen(item);
    
    switch (tipoAlmacen) {
      case 'cementerio':
        return 'bg-danger';
      case 'oficina_laboratorio':
        return 'bg-warning';
      case 'laboratorio':
        return 'bg-info';
      case 'regular':
        return 'bg-secondary';
      default:
        return 'bg-secondary';
    }
  }

  /**
   * Exporta el contenido de una estantería a PDF (vista filtrada de esa estantería).
   */
  exportarPDFEstanteria(almacenKey: string, estanteriaKey: string): void {
    const items = this.getItemsPorEstanteria(almacenKey, estanteriaKey);

    if (items.length === 0) {
      this.notificationService.showInfo('Sin items', 'No hay items para exportar en esta estantería con el filtro actual.');
      return;
    }

    const estanteriaId = `${almacenKey}-${estanteriaKey}`;
    this.isExportingEstanteria[estanteriaId] = true;
    this.notificationService.showInfo('Generando PDF', 'Generando PDF de estantería...');

    const doc = new jsPDF('landscape');
    const fechaGeneracion = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    doc.setFontSize(18);
    doc.text(`Estantería ${estanteriaKey} - ${almacenKey}`, 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Almacén: ${almacenKey}`, 14, 30);
    doc.text(`Total de items: ${items.length}`, 14, 35);
    doc.text(`Fecha de generación: ${fechaGeneracion}`, 14, 40);
    if (this.searchTerm.trim()) {
      doc.text(`Búsqueda: ${this.searchTerm.trim()}`, 14, 45);
    }

    const itemsPorEstante: { [key: string]: any[] } = {};
    items.forEach(item => {
      const estante = item.estante || 'Sin ubicación';
      if (!itemsPorEstante[estante]) {
        itemsPorEstante[estante] = [];
      }
      itemsPorEstante[estante].push(item);
    });

    let startY = this.searchTerm.trim() ? 55 : 50;
    const estantes = Object.keys(itemsPorEstante).sort();
    const head = [['Tipo', 'Item', 'Cantidad', 'Ubicación', 'Número', 'Descripción']];

    estantes.forEach((estante) => {
      if (startY > 180) {
        doc.addPage();
        startY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`Estante ${estante}`, 14, startY);
      startY += 8;

      autoTable(doc, {
        head,
        body: itemsPorEstante[estante].map((item) => this.filaPdfStock(item)),
        startY: startY,
        theme: 'striped',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          halign: 'left',
          valign: 'middle'
        },
        headStyles: {
          fillColor: [52, 152, 219],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240]
        }
      });

      startY = (doc as any).lastAutoTable.finalY + 10;
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Página ${i} de ${totalPages}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }

    const nombreArchivo = `estanteria_${estanteriaKey.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(nombreArchivo);
    this.notificationService.showSuccess('PDF Generado', 'PDF de estantería generado exitosamente.');
    this.isExportingEstanteria[estanteriaId] = false;
  }

  /**
   * Exporta todo el contenido del almacén seleccionado o el primero disponible
   */
  exportarPDFAlmacenCompleto(): void {
    const almacenes = this.getAlmacenes();
    if (almacenes.length === 0) {
      this.notificationService.showInfo('Sin almacenes', 'No hay almacenes para exportar.');
      return;
    }

    // Si hay un almacén seleccionado, exportar ese; si no, exportar el primero
    let almacenKey: string;
    if (this.almacenSeleccionado) {
      almacenKey = `${this.almacenSeleccionado.numero} - ${this.almacenSeleccionado.nombre}`;
    } else {
      almacenKey = almacenes[0];
    }

    this.exportarPDFAlmacen(almacenKey);
  }

  /**
   * Exporta la vista actual del almacén (ubicación + búsqueda), incluyendo ítems de stock.
   */
  exportarPDFAlmacen(almacenKey: string): void {
    const items = this.getItemsVistaActual();
    if (items.length === 0) {
      this.notificationService.showInfo(
        'Sin items',
        'No hay items en la vista filtrada para exportar.'
      );
      return;
    }

    this.isExporting = true;
    this.notificationService.showInfo('Generando PDF', 'Generando PDF de la vista filtrada...');

    const doc = new jsPDF('landscape');
    const fechaGeneracion = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    const unidades = this.getTotalUnidadesVistaActual();
    const busqueda = this.searchTerm.trim();

    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text(`Stock - ${almacenKey}`, 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    let yInfo = 30;
    doc.text(`Almacén: ${almacenKey}`, 14, yInfo);
    yInfo += 5;
    doc.text(`Vista: ${this.getEtiquetaSeleccionActual()}`, 14, yInfo);
    yInfo += 5;
    if (busqueda) {
      doc.text(`Búsqueda: ${busqueda}`, 14, yInfo);
      yInfo += 5;
    }
    doc.text(`Items: ${items.length}  ·  Unidades: ${unidades}  ·  ${fechaGeneracion}`, 14, yInfo);
    yInfo += 8;

    const porEstanteria: { [key: string]: { [key: string]: any[] } } = {};
    items.forEach((item) => {
      const estanteria = (item?.estanteria && String(item.estanteria).trim() && item.estanteria !== '-')
        ? String(item.estanteria)
        : 'Sin ubicación';
      const estante = (item?.estante && String(item.estante).trim() && item.estante !== '-')
        ? String(item.estante)
        : 'Sin estante';
      if (!porEstanteria[estanteria]) {
        porEstanteria[estanteria] = {};
      }
      if (!porEstanteria[estanteria][estante]) {
        porEstanteria[estanteria][estante] = [];
      }
      porEstanteria[estanteria][estante].push(item);
    });

    let startY = yInfo;
    const head = [['Tipo', 'Item', 'Cantidad', 'Ubicación', 'Número', 'Descripción']];
    const estanterias = Object.keys(porEstanteria).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );

    estanterias.forEach((estanteria, estanteriaIndex) => {
      if (startY > 170) {
        doc.addPage();
        startY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`Estantería ${estanteria}`, 14, startY);
      startY += 8;

      const estantes = Object.keys(porEstanteria[estanteria]).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );

      estantes.forEach((estante) => {
        if (startY > 180) {
          doc.addPage();
          startY = 20;
        }

        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text(`Estante ${estante}`, 14, startY);
        startY += 6;

        autoTable(doc, {
          head,
          body: porEstanteria[estanteria][estante].map((item) => this.filaPdfStock(item)),
          startY,
          theme: 'striped',
          styles: {
            fontSize: 7,
            cellPadding: 1.5,
            halign: 'left',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [52, 152, 219],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          }
        });

        startY = (doc as any).lastAutoTable.finalY + 8;
      });

      if (estanteriaIndex < estanterias.length - 1) {
        startY += 4;
      }
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Página ${i} de ${totalPages}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }

    const nombreArchivo = `almacen_${almacenKey.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(nombreArchivo);
    this.notificationService.showSuccess('PDF Generado', 'PDF de la vista filtrada generado exitosamente.');
    this.isExporting = false;
  }

  /**
   * Helper para verificar si se está exportando una estantería
   */
  isExportingEstanteriaKey(almacenKey: string, estanteriaKey: string): boolean {
    const estanteriaId = `${almacenKey}-${estanteriaKey}`;
    return this.isExportingEstanteria[estanteriaId] || false;
  }

  /**
   * Equipos y dispositivos especiales del almacén que se está viendo.
   */
  private itemsEspecialesDelAlmacen(): any[] {
    const key = this.getAlmacenActivoKey();
    if (!key) {
      return [];
    }
    const porEstanteria = this.stockOrganizado[key] || {};
    const items: any[] = [];
    const vistos = new Set<string>();
    for (const lista of Object.values(porEstanteria)) {
      for (const item of lista || []) {
        if (!this.esEquipoEspecial(item)) {
          continue;
        }
        const dedupe = `${this.getTipoEquipo(item)}:${item.itemId || item.estadoInfo?.hardwareId || item.numero || item.estadoInfo?.mac || item.id}`;
        if (vistos.has(dedupe)) {
          continue;
        }
        vistos.add(dedupe);
        items.push(item);
      }
    }
    return items;
  }

  hardwareIdDeItem(item: any): number | null {
    const id = item?.itemId || item?.estadoInfo?.hardwareId;
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  macDeItem(item: any): string | null {
    const mac = (item?.numero || item?.estadoInfo?.mac || '').toString().trim();
    return mac || null;
  }

  get equiposParaTransferirMasa(): any[] {
    return this.itemsEspecialesDelAlmacen().filter(
      (item) => this.getTipoEquipo(item) === 'EQUIPO' && this.hardwareIdDeItem(item) != null
    );
  }

  get itemsParaReactivarMasa(): any[] {
    return this.itemsEspecialesDelAlmacen().filter((item) => {
      const tipo = this.getTipoEquipo(item);
      if (tipo === 'EQUIPO') {
        return this.hardwareIdDeItem(item) != null;
      }
      if (tipo === 'DISPOSITIVO') {
        return !!this.macDeItem(item);
      }
      return false;
    });
  }

  abrirTransferenciaMasiva(event?: Event): void {
    event?.stopPropagation();
    if (this.permissionsService.denyUnless(this.canTransferStock(), 'transferir equipos en masa', event)) {
      return;
    }
    if (this.transfiriendoMasa) {
      return;
    }
    const equipos = this.equiposParaTransferirMasa;
    if (!equipos.length) {
      this.notificationService.showError(
        'Sin equipos para transferir',
        'No hay equipos (PCs) en este almacén. Los insumos y dispositivos no se transfieren desde acá.'
      );
      return;
    }
    const modalRef = this.modalService.open(TransferirMasaModalComponent, {
      size: 'xl',
      centered: true,
      backdrop: 'static',
      windowClass: 'transferir-masa-modal-window'
    });
    modalRef.componentInstance.titulo = 'Transferir en masa';
    modalRef.componentInstance.tituloLista = 'Equipos del almacén';
    const excluir: string[] = [];
    if (this.almacenLaboratorio && Number(this.almacenId) === Number(this.almacenLaboratorio.id)) {
      excluir.push('laboratorio');
    }
    if (this.almacenOficinaLaboratorio && Number(this.almacenId) === Number(this.almacenOficinaLaboratorio.id)) {
      excluir.push('oficina_laboratorio');
    }
    modalRef.componentInstance.excluirDestinos = excluir;
    modalRef.componentInstance.equipos = equipos
      .slice()
      .sort((a, b) =>
        (a.numero || a.item?.nombreItem || '').localeCompare(b.numero || b.item?.nombreItem || '', 'es', { sensitivity: 'base' })
      )
      .map((item) => ({
        id: this.hardwareIdDeItem(item),
        name: item.numero || item.item?.nombreItem,
        ipAddr: item.ipAddr || '',
        userid: item.userid || '',
        biosType: item.item?.descripcion || item.descripcion || ''
      }));

    modalRef.result.then((transferData: any) => {
      if (transferData?.hardwareIds?.length) {
        this.procesarTransferenciaMasiva(transferData);
      }
    }).catch(() => {});
  }

  private procesarTransferenciaMasiva(transferData: any): void {
    this.transfiriendoMasa = true;
    const requestData: any = {
      hardwareIds: transferData.hardwareIds,
      almacenId: transferData.almacenId,
      tipoAlmacen: transferData.tipoAlmacen,
      observaciones: transferData.observaciones || '',
      usuario: this.authService.getUsuarioParaAuditoria()
    };
    if (transferData.tipoAlmacen === 'regular' || transferData.tipoAlmacen === 'laboratorio') {
      requestData.estanteria = transferData.estanteria || '';
      requestData.estante = transferData.estante || '';
      requestData.seccion = transferData.seccion != null ? transferData.seccion : '';
    }

    this.estadoEquipoService.transferirEquiposEnMasa(requestData).subscribe({
      next: (response) => {
        const ok = response?.data?.ok ?? 0;
        const fallidos = Array.isArray(response?.data?.fallidos) ? response.data.fallidos : [];
        this.cargarDatos();
        if (fallidos.length === 0) {
          this.notificationService.showSuccessMessage(
            response?.message || `${ok} equipo(s) transferido(s) exitosamente.`
          );
        } else {
          this.notificationService.showError(
            'Transferencia masiva incompleta',
            `${ok} transferido(s), ${fallidos.length} con error.`
          );
        }
      },
      error: (error) => {
        this.notificationService.showError(
          'Error al transferir en masa',
          error?.message || 'No se pudieron transferir los equipos.'
        );
      },
      complete: () => {
        this.transfiriendoMasa = false;
      }
    });
  }

  abrirReactivacionMasiva(event?: Event): void {
    event?.stopPropagation();
    if (this.permissionsService.denyUnless(this.canTransferStock(), 'reactivar en masa', event)) {
      return;
    }
    if (this.reactivandoMasa) {
      return;
    }
    const items = this.itemsParaReactivarMasa;
    if (!items.length) {
      this.notificationService.showError(
        'Sin items para reactivar',
        'No hay equipos ni dispositivos en este almacén.'
      );
      return;
    }
    const modalRef = this.modalService.open(ReactivarMasaModalComponent, {
      size: 'xl',
      centered: true,
      backdrop: 'static',
      windowClass: 'transferir-masa-modal-window'
    });
    modalRef.componentInstance.titulo = 'Reactivar en masa';
    modalRef.componentInstance.tituloLista = 'Equipos y dispositivos del almacén';
    modalRef.componentInstance.items = items
      .slice()
      .sort((a, b) =>
        (a.numero || a.item?.nombreItem || a.mac || '').localeCompare(
          b.numero || b.item?.nombreItem || b.mac || '',
          'es',
          { sensitivity: 'base' }
        )
      )
      .map((item, index) => {
        const tipo = this.getTipoEquipo(item) === 'DISPOSITIVO' ? 'DISPOSITIVO' : 'EQUIPO';
        const id = this.hardwareIdDeItem(item);
        const mac = tipo === 'DISPOSITIVO' ? this.macDeItem(item) : null;
        const name = item.numero || item.item?.nombreItem || mac || (id != null ? `ID ${id}` : `Item ${index + 1}`);
        return {
          key: `${tipo === 'EQUIPO' ? 'e' : 'd'}:${id ?? mac ?? 'x'}:${index}`,
          tipo,
          id,
          mac,
          name,
          ipAddr: item.ipAddr || ''
        };
      });

    modalRef.result.then((data: { hardwareIds?: number[]; macs?: string[] }) => {
      if (data?.hardwareIds?.length || data?.macs?.length) {
        this.procesarReactivacionMasiva(data);
      }
    }).catch(() => {});
  }

  private procesarReactivacionMasiva(data: { hardwareIds?: number[]; macs?: string[] }): void {
    this.reactivandoMasa = true;
    const usuario = this.authService.getUsuarioParaAuditoria();
    const llamadas = [];
    if (data.hardwareIds?.length) {
      llamadas.push(this.estadoEquipoService.reactivarEquiposEnMasa({
        hardwareIds: data.hardwareIds,
        observaciones: '',
        usuario
      }));
    }
    if (data.macs?.length) {
      llamadas.push(this.estadoDispositivoService.reactivarDispositivosEnMasa({
        macs: data.macs,
        observaciones: '',
        usuario
      }));
    }
    if (!llamadas.length) {
      this.reactivandoMasa = false;
      return;
    }
    forkJoin(llamadas).subscribe({
      next: (responses) => {
        let ok = 0;
        let fallidos = 0;
        for (const response of responses as any[]) {
          ok += response?.data?.ok ?? 0;
          fallidos += Array.isArray(response?.data?.fallidos) ? response.data.fallidos.length : 0;
        }
        this.cargarDatos();
        if (fallidos === 0) {
          this.notificationService.showSuccessMessage(
            `${ok} item(s) reactivado(s) exitosamente.`
          );
        } else {
          this.notificationService.showError(
            'Reactivación masiva incompleta',
            `${ok} reactivado(s), ${fallidos} con error.`
          );
        }
      },
      error: (error) => {
        this.notificationService.showError(
          'Error al reactivar en masa',
          error?.message || 'No se pudieron reactivar los items.'
        );
      },
      complete: () => {
        this.reactivandoMasa = false;
      }
    });
  }

  /**
   * Método para transferir equipo o dispositivo (solo para equipos especiales)
   */
  transferirEquipo(item: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (this.permissionsService.denyUnless(this.canTransferStock(), 'transferir este equipo', event)) {
      return;
    }
    this.cerrarDropdown();

    // Solo permitir transferir equipos o dispositivos especiales
    if (!this.esEquipoEspecial(item)) {
      this.notificationService.showError(
        'Operación no permitida',
        'Solo se pueden transferir equipos o dispositivos del sistema.'
      );
      return;
    }

    const tipoEquipo = this.getTipoEquipo(item);
    
    if (tipoEquipo === 'EQUIPO') {
      // Obtener el hardwareId del item (enriquecido o desde estadoInfo)
      let hardwareId = item.itemId || item.estadoInfo?.hardwareId;
      if (!hardwareId && item.numero) {
        // Fallback: buscar hardware por nombre (p.ej. cuando el enriquecimiento no encontró match)
        this.hardwareService.getHardware().subscribe({
          next: (hwList) => {
            const hw = (hwList || []).find((h: any) =>
              (h.name || '').trim().toLowerCase() === (item.numero || '').trim().toLowerCase()
            );
            if (hw) {
              this.abrirModalTransferirEquipo(item, hw.id);
            } else {
              this.notificationService.showError('Error', 'No se pudo identificar el equipo a transferir.');
            }
          },
          error: () => this.notificationService.showError('Error', 'No se pudo cargar el hardware.')
        });
        return;
      }
      if (!hardwareId) {
        this.notificationService.showError('Error', 'No se pudo identificar el equipo a transferir.');
        return;
      }

      this.abrirModalTransferirEquipo(item, hardwareId);
    } else if (tipoEquipo === 'DISPOSITIVO') {
      // Obtener la MAC del dispositivo
      const mac = item.numero || item.estadoInfo?.mac || item.item?.nombreItem;
      if (!mac) {
        this.notificationService.showError(
          'Error',
          'No se pudo identificar el dispositivo a transferir.'
        );
        return;
      }

      // Buscar la información del dispositivo para pasar al modal
      this.networkInfoService.getNetworkInfo().subscribe({
        next: (networkInfoResponse) => {
          if (networkInfoResponse.success && Array.isArray(networkInfoResponse.data)) {
            const dispositivo = networkInfoResponse.data.find((d: any) => d.mac === mac);
            
            const modalRef = this.modalService.open(TransferirEquipoModalComponent, { size: 'lg' });
            modalRef.componentInstance.item = {
              ...(dispositivo || {}),
              tipo: 'DISPOSITIVO',
              name: dispositivo?.name || mac,
              mac: mac
            };

            modalRef.result.then((transferData: any) => {
              if (transferData) {
                this.procesarTransferenciaDispositivo(item, mac, transferData);
              }
            }).catch(() => {
              // Usuario canceló el modal
            });
          } else {
            this.notificationService.showError(
              'Error',
              'No se pudo cargar la información del dispositivo.'
            );
          }
        },
        error: (error: any) => {
          console.error('Error al cargar network info:', error);
          this.notificationService.showError(
            'Error',
            'No se pudo cargar la información del dispositivo.'
          );
        }
      });
    } else {
      this.notificationService.showError(
        'Operación no permitida',
        'Tipo de item no soportado para transferencia.'
      );
    }
  }

  private abrirModalTransferirEquipo(item: any, hardwareId: number): void {
    this.hardwareService.getHardware().subscribe({
      next: (hardwareList) => {
        const hardware = hardwareList.find((h: any) => h.id === hardwareId);
        if (!hardware) {
          this.notificationService.showError('Error', 'No se encontró la información del equipo.');
          return;
        }
        const modalRef = this.modalService.open(TransferirEquipoModalComponent, { size: 'lg' });
        modalRef.componentInstance.item = { ...hardware, tipo: 'EQUIPO', name: hardware.name };
        modalRef.result.then((transferData: any) => {
          if (transferData) {
            this.procesarTransferenciaEquipo(item, hardwareId, transferData);
          }
        }).catch(() => {});
      },
      error: (error: any) => {
        console.error('Error al cargar hardware:', error);
        this.notificationService.showError('Error', 'No se pudo cargar la información del equipo.');
      }
    });
  }

  private procesarTransferenciaEquipo(item: any, hardwareId: number, transferData: any): void {
    this.transferiendoItemId = item.id;

    // Preparar datos para el backend
    const requestData: any = {
      almacenId: transferData.almacenId,
      tipoAlmacen: transferData.tipoAlmacen,
      observaciones: transferData.observaciones || '',
      usuario: this.authService.getUsuarioParaAuditoria()
    };

    // Incluir estantería, estante y sección cuando hay AlmacenConfig (regular o laboratorio)
    if (transferData.tipoAlmacen === 'regular' || transferData.tipoAlmacen === 'laboratorio') {
      requestData.estanteria = transferData.estanteria || '';
      requestData.estante = transferData.estante || '';
      // Asegurar que seccion siempre se incluya, incluso si está vacía o es null/undefined
      // IMPORTANTE: Capturar el valor directamente del transferData
      // Si viene como string vacío '', también lo capturamos
      const seccionRaw = transferData.seccion;
      let seccionValue = '';
      
      if (seccionRaw !== undefined && seccionRaw !== null) {
        // Si es string, usar trim; si es otro tipo, convertir a string y trim
        seccionValue = typeof seccionRaw === 'string' ? seccionRaw.trim() : String(seccionRaw).trim();
      }
      
      // Forzar que seccion siempre esté presente en el objeto
      requestData.seccion = seccionValue;
      
      console.log('🔍 StockAlmacen - Procesando almacén regular:', {
        transferDataSeccion: transferData.seccion,
        transferDataSeccionType: typeof transferData.seccion,
        seccionValue: seccionValue,
        requestDataSeccion: requestData.seccion,
        requestDataKeys: Object.keys(requestData),
        requestDataJSON: JSON.stringify(requestData)
      });
    } else {
      console.log('🔍 StockAlmacen - NO es almacén regular:', {
        tipoAlmacen: transferData.tipoAlmacen,
        transferData
      });
    }
    
    // Log para debugging - ANTES de enviar
    console.log('🔍 Frontend - Datos de transferencia ANTES de enviar:', {
      hardwareId,
      requestData,
      requestDataKeys: Object.keys(requestData),
      transferDataSeccion: transferData.seccion,
      requestDataSeccion: requestData.seccion,
      requestDataSeccionType: typeof requestData.seccion,
      tieneSeccionEnRequest: 'seccion' in requestData,
      requestDataStringified: JSON.stringify(requestData)
    });

    this.estadoEquipoService.transferirEquipo(hardwareId, requestData).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.cargarDatos();
          this.notificationService.showSuccessMessage(
            `Equipo transferido exitosamente.`
          );
        } else {
          throw new Error(response.message || 'Error al transferir el equipo');
        }
      },
      error: (error: any) => {
        console.error('Error al transferir equipo:', error);
        this.notificationService.showError(
          'Error al transferir equipo',
          `No se pudo transferir el equipo: ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        this.transferiendoItemId = null;
      }
    });
  }

  private procesarTransferenciaDispositivo(item: any, mac: string, transferData: any): void {
    this.transferiendoItemId = item.id;

    // Preparar datos para el backend
    const requestData: any = {
      almacenId: transferData.almacenId,
      tipoAlmacen: transferData.tipoAlmacen,
      observaciones: transferData.observaciones || '',
      usuario: this.authService.getUsuarioParaAuditoria()
    };

    if (transferData.tipoAlmacen === 'regular' || transferData.tipoAlmacen === 'laboratorio') {
      requestData.estanteria = transferData.estanteria || '';
      requestData.estante = transferData.estante || '';
      requestData.seccion = transferData.seccion != null ? transferData.seccion : '';
    }

    this.estadoDispositivoService.transferirDispositivo(mac, requestData).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.cargarDatos();
          this.notificationService.showSuccessMessage(
            `Dispositivo transferido exitosamente.`
          );
        } else {
          throw new Error(response.message || 'Error al transferir el dispositivo');
        }
      },
      error: (error: any) => {
        console.error('Error al transferir dispositivo:', error);
        this.notificationService.showError(
          'Error al transferir dispositivo',
          `No se pudo transferir el dispositivo: ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        this.transferiendoItemId = null;
      }
    });
  }

  /**
   * Toggle del dropdown de acciones
   */
  toggleDropdown(item: any, event: Event): void {
    event.stopPropagation();
    if (this.dropdownAbiertoId === item.id) {
      this.dropdownAbiertoId = null;
    } else {
      this.dropdownAbiertoId = item.id;
    }
  }

  /**
   * Cerrar dropdown de acciones
   */
  cerrarDropdown(): void {
    this.dropdownAbiertoId = null;
  }

  /**
   * Método para reactivar equipo o dispositivo
   */
  reactivarEquipo(item: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (this.permissionsService.denyUnless(this.canTransferStock(), 'reactivar este equipo', event)) {
      return;
    }
    this.cerrarDropdown();

    // Solo permitir reactivar equipos o dispositivos especiales
    if (!this.esEquipoEspecial(item)) {
      this.notificationService.showError(
        'Operación no permitida',
        'Solo se pueden reactivar equipos o dispositivos del sistema.'
      );
      return;
    }

    const tipoEquipo = this.getTipoEquipo(item);
    
    if (tipoEquipo === 'EQUIPO') {
      const hardwareId = item.itemId || item.estadoInfo?.hardwareId;
      if (!hardwareId) {
        this.notificationService.showError(
          'Error',
          'No se pudo identificar el equipo a reactivar.'
        );
        return;
      }
      this.procesarReactivacionEquipo(item, hardwareId);
    } else if (tipoEquipo === 'DISPOSITIVO') {
      const mac = item.numero || item.estadoInfo?.mac || item.item?.nombreItem;
      if (!mac) {
        this.notificationService.showError(
          'Error',
          'No se pudo identificar el dispositivo a reactivar.'
        );
        return;
      }
      this.procesarReactivacionDispositivo(item, mac);
    } else {
      this.notificationService.showError(
        'Operación no permitida',
        'Tipo de item no soportado para reactivación.'
      );
    }
  }

  private procesarReactivacionEquipo(fila: any, hardwareId: number): void {
    this.reactivandoItemId = fila.id;
    const request: CambioEstadoRequest = {
      observaciones: 'Reactivado desde almacén',
      usuario: this.authService.getUsuarioParaAuditoria()
    };
    this.estadoEquipoService.reactivarEquipo(hardwareId, request).subscribe({
      next: (response: any) => {
        if (!response?.success) {
          throw new Error(response?.message || 'Error al reactivar el equipo');
        }
        this.quitarFilaStockTrasReactivar(fila);
        this.notificationService.showSuccessMessage('Equipo reactivado exitosamente.');
      },
      error: (err: any) => {
        console.error('Error al reactivar equipo:', err);
        this.notificationService.showError(
          'Error al reactivar equipo',
          'No se pudo reactivar el equipo: ' + (err?.message || 'Error desconocido')
        );
      },
      complete: () => {
        this.reactivandoItemId = null;
      }
    });
  }

  private procesarReactivacionDispositivo(fila: any, mac: string): void {
    this.reactivandoItemId = fila.id;
    const request: CambioEstadoDispositivoRequest = {
      observaciones: 'Reactivado desde almacén',
      usuario: this.authService.getUsuarioParaAuditoria()
    };
    this.estadoDispositivoService.reactivarDispositivo(mac, request).subscribe({
      next: (response: any) => {
        if (!response?.success) {
          throw new Error(response?.message || 'Error al reactivar el dispositivo');
        }
        this.quitarFilaStockTrasReactivar(fila);
        this.notificationService.showSuccessMessage('Dispositivo reactivado exitosamente.');
      },
      error: (err: any) => {
        console.error('Error al reactivar dispositivo:', err);
        this.notificationService.showError(
          'Error al reactivar dispositivo',
          'No se pudo reactivar el dispositivo: ' + (err?.message || 'Error desconocido')
        );
      },
      complete: () => {
        this.reactivandoItemId = null;
      }
    });
  }

  private quitarFilaStockTrasReactivar(fila: any): void {
    const stockId = this.getStockAlmacenNumericId(fila);
    if (stockId == null) {
      this.cargarDatos();
      return;
    }
    this.stockAlmacenService.deleteStock(stockId).subscribe({
      next: () => this.cargarDatos(),
      error: () => this.cargarDatos()
    });
  }

  itemCoincideConBusqueda(fila: any): boolean {
    if (!this.searchTerm || !this.searchTerm.trim()) {
      return false;
    }
    const term = this.searchTerm.toLowerCase().trim();
    const catalogo = fila && fila.item ? fila.item : {};
    const almacen = fila && fila.almacen ? fila.almacen : {};
    const compra = fila && fila.compra ? fila.compra : {};
    const campos = [
      catalogo.nombreItem,
      catalogo.descripcion,
      fila && fila.numero,
      fila && fila.descripcion,
      almacen.nombre,
      almacen.numero,
      fila && fila.estanteria,
      fila && fila.estante,
      compra.numeroCompra
    ];
    return campos.some((campo) => String(campo || '').toLowerCase().includes(term));
  }
} 