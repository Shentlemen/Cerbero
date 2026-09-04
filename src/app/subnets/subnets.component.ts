import { Component, OnDestroy, OnInit, AfterViewInit, HostListener, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  SubnetService,
  SubnetDTO,
  SubnetCoordinatesDTO,
  ipv4MatchesSubnet,
  ipv4ToUint32
} from '../services/subnet.service';
import { HardwareService } from '../services/hardware.service';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import * as XLSX from 'xlsx';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { PermissionsService } from '../services/permissions.service';
import { TourRegistryService } from '../services/tour-registry.service';

/** Fila de PC o dispositivo de red en el modal / exportación por subred. */
interface SubnetHardwareRow {
  kind: 'pc' | 'device';
  id?: number;
  name: string;
  ipAddr: string;
  osName: string;
  type: string;
  userid: string;
  mac?: string;
  lastcome: string | null;
}

// Extendemos la interfaz SubnetDTO para incluir las propiedades adicionales
interface ExtendedSubnet extends SubnetDTO {
  latitud?: number;
  longitud?: number;
  hasCoordinates: boolean;
  editing: boolean;
  [key: string]: any;
}

/** Marcador del mapa con la subred asociada (para sumar equipos en clusters). */
interface SubnetMapMarker extends L.Marker {
  subnetRef: ExtendedSubnet;
  subnetEquipmentCount: number;
  collocatedPeers?: ExtendedSubnet[];
  /** Coincide con el filtro de búsqueda actual (para clusters). */
  subnetSearchMatch?: boolean;
}

interface MarkerPlacement {
  lat: number;
  lng: number;
  peers: ExtendedSubnet[];
}

/** Subred con net/máscara ya parseados para indexar inventario sin bloquear la UI. */
interface PreparedSubnet {
  subnet: ExtendedSubnet;
  net: number;
  mask: number;
  order: number;
}

/** Cluster de Leaflet MarkerCluster (métodos usados en el mapa). */
interface SubnetMapCluster {
  getLatLng: () => L.LatLng;
  getAllChildMarkers: () => L.Marker[];
  getBounds: () => L.LatLngBounds;
  spiderfy?: () => void;
}

/** Arrastre pendiente de confirmación en el mapa. */
interface MapEditPending {
  subnet: ExtendedSubnet;
  marker: SubnetMapMarker;
  displayLat: number;
  displayLng: number;
  lat: number;
  lng: number;
}

// Añade esta declaración después de las importaciones
declare module 'leaflet' {
  interface Map {
    markerClusterGroup: () => L.MarkerClusterGroup;
  }
}

@Component({
  selector: 'app-subnets',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbPaginationModule],
  templateUrl: './subnets.component.html',
  styleUrls: ['./subnets.component.css']
})
export class SubnetsComponent implements OnInit, AfterViewInit, OnDestroy {
  subnets: ExtendedSubnet[] = [];
  private map: L.Map | undefined;
  private markerClusterGroup: L.MarkerClusterGroup | undefined;
  private editMarkersLayer: L.LayerGroup | undefined;
  /** Modo edición: arrastrar pins en el mapa para corregir coordenadas. */
  public mapEditMode = false;
  public mapEditSaving = false;
  public mapEditPending: MapEditPending | null = null;
  public sortColumn: string = '';
  /** Subredes con coordenadas guardadas (para leyenda del mapa). */
  public subnetsOnMapCount = 0;
  public sortDirection: 'asc' | 'desc' = 'asc';
  public loading: boolean = false;
  public errorMessage: string | null = null;
  
  // Propiedades para paginación
  public page: number = 1;
  /** Filas por página en la lista de subredes. */
  public pageSize: number = 10;
  public collectionSize: number = 0;

  /** Búsqueda en la tabla por nombre, id o netId. */
  public searchTerm: string = '';
  /** Búsqueda por nombre o IP de PC / dispositivo de red. */
  public equipmentSearchTerm: string = '';

  /** Esquinas aproximadas de Uruguay (sur-oeste y norte-este). */
  private readonly uruguaySouthWest: L.LatLngTuple = [-35.19, -58.45];
  private readonly uruguayNorthEast: L.LatLngTuple = [-30.08, -53.07];
  private tourCleanup?: () => void;

  // Modal "Ver equipos de la subred"
  public hardwareModalOpen = false;
  public hardwareModalSubnet: ExtendedSubnet | null = null;
  public hardwareModalRows: SubnetHardwareRow[] = [];
  public hardwareModalLoading = false;
  public hardwareModalError: string | null = null;
  public hardwareModalSearch = '';
  /** Selector cuando varias subredes comparten ubicación (ej. Córdon). */
  public locationPickerOpen = false;
  public locationPickerSubnets: ExtendedSubnet[] = [];
  public locationPickerTitle = '';
  /** Cache local para no recargar el listado completo en cada apertura del modal. */
  private hardwareCache: any[] | null = null;
  private devicesCache: NetworkInfoDTO[] | null = null;
  public exportingExcel = false;
  /** Conteos precalculados por netId (evita filtrar todo el inventario en cada marcador). */
  private equipmentCountByNetId = new Map<string, number>();
  /** Índice nombre/IP → netId para buscar PCs y dispositivos sin recorrer el inventario en cada tecla. */
  private equipmentSearchIndex: { netId: string; haystack: string }[] = [];
  /** netIds cuya PC o dispositivo coincide con equipmentSearchTerm. */
  private equipmentMatchNetIds = new Set<string>();
  private hardwareCountsLoading = false;
  private inventoryRequest$: Observable<{ hardware: any[]; devices: NetworkInfoDTO[] }> | null = null;
  private inventoryIndexTimer: ReturnType<typeof setTimeout> | undefined;
  private inventoryIndexJobId = 0;
  private componentDestroyed = false;
  private mapInitialFitDone = false;
  private resizeDebounceId: ReturnType<typeof setTimeout> | undefined;
  private markersRefreshId: ReturnType<typeof setTimeout> | undefined;
  /** Modales del mapa abiertos. */
  private mapModalOpenCount = 0;
  private hardwareModalRepaintId: ReturnType<typeof setTimeout> | undefined;
  private markerPlacements = new Map<string, MarkerPlacement>();

  constructor(
    private subnetService: SubnetService,
    private permissionsService: PermissionsService,
    private tourRegistry: TourRegistryService,
    private hardwareService: HardwareService,
    private networkInfoService: NetworkInfoService,
    private ngZone: NgZone,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.tourCleanup = this.tourRegistry.register('subnets', [{
      id: 'subnets-overview',
      title: 'Tour de subredes',
      icon: 'fa-route',
      steps: [
        { selector: '#tour-subnets-header', title: 'Subredes', description: 'Definición de VLANs y datos para ubicar equipos en el plano (IP, máscara, coordenadas).', side: 'bottom' },
        { selector: '#tour-subnets-toolbar', title: 'Resumen y búsqueda', description: 'Contador de registros. Buscá por nombre de subred o por PC/dispositivo (nombre o IP): la lista y el mapa se actualizan juntos.', side: 'bottom' },
        { selector: '#tour-subnets-table', title: 'Tabla editable', description: 'In-line: nombre, IP, máscara y datos del mapa; guardá cambios desde cada fila si tenés permiso.', side: 'top' },
        { selector: '#tour-subnets-map', title: 'Mapa', description: 'Marcadores por ubicación; el número indica equipos en la subred. Clic en un marcador abre el mismo listado que el botón Equipos.', side: 'top' }
      ]
    }]);
    this.loadResources()
      .then(() => this.initMap())
      .then(() => this.loadSubnets())
      .catch(error => {
        console.error('Error en la inicialización:', error);
        this.errorMessage = 'Error al inicializar el componente: ' + error.message;
      });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.scheduleMapResize(() => {
      if (!this.mapInitialFitDone && this.map) {
        this.fitMapToUruguay();
        this.mapInitialFitDone = true;
      }
    }), 150);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.resizeDebounceId) {
      clearTimeout(this.resizeDebounceId);
    }
    this.resizeDebounceId = setTimeout(() => {
      if (this.mapModalOpenCount > 0) {
        this.repaintMapMarkers();
      } else {
        this.scheduleMapResize();
      }
    }, 150);
  }

  /** Recalcula el tamaño del mapa cuando cambia el layout o el viewport. */
  private scheduleMapResize(afterResize?: () => void): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.map?.invalidateSize();
        afterResize?.();
      });
    });
  }

  private loadSubnets(): void {
    this.loading = true;
    this.errorMessage = null;

    forkJoin({
      subnets: this.subnetService.getSubnets(),
      coordinates: this.subnetService.getAllSubnetCoordinates()
    }).subscribe({
      next: ({ subnets, coordinates }) => {
        const coordMap = new Map(coordinates.map(c => [c.netId, c]));
        
        this.subnets = subnets.map(subnet => {
          const coords = coordMap.get(subnet.netId);
          return {
            ...subnet,
            latitud: coords?.latitud,
            longitud: coords?.longitud,
            hasCoordinates: !!coords,
            editing: false
          };
        });
        
        this.collectionSize = this.subnets.length;
        this.page = 1;
        this.loading = false;

        // Mapa primero; conteos de equipos en segundo plano (no bloquea la UI).
        setTimeout(() => this.addMarkersToMap(), 0);
        this.loadHardwareCountsInBackground();
      },
      error: (error) => {
        console.error('Error al cargar datos:', error);
        this.errorMessage = 'Error al cargar las subredes: ' + error.message;
        this.loading = false;
      }
    });
  }

  /**
   * Subredes filtradas por el buscador de subred y/o de PC/dispositivo.
   * La búsqueda es case-insensitive e ignora acentos/diéresis para que
   * "limon" matchee con "Limón" y "ANIO" con "año".
   */
  get filteredSubnets(): ExtendedSubnet[] {
    if (!this.isSearchFilterActive()) {
      return this.subnets;
    }
    return this.subnets.filter((s) => this.subnetMatchesSearch(s));
  }

  /** Hay texto de búsqueda activo (subred o equipo, tras normalizar). */
  isSearchFilterActive(): boolean {
    return this.isSubnetSearchActive() || this.isEquipmentSearchActive();
  }

  isSubnetSearchActive(): boolean {
    return this.normalizeForSearch(this.searchTerm).length > 0;
  }

  isEquipmentSearchActive(): boolean {
    return this.normalizeForSearch(this.equipmentSearchTerm).length > 0;
  }

  /** Inventario de PCs/dispositivos todavía no disponible para el segundo buscador. */
  get equipmentInventoryLoading(): boolean {
    return this.hardwareCountsLoading || this.hardwareCache === null;
  }

  /** Texto del hint del mapa según qué buscadores están activos. */
  get searchHighlightHint(): string {
    const subnetQ = this.searchTerm.trim();
    const equipmentQ = this.equipmentSearchTerm.trim();
    if (subnetQ && equipmentQ) {
      return `Coincidencias de subred «${subnetQ}» y equipo/IP «${equipmentQ}»`;
    }
    if (equipmentQ) {
      return `Subredes con PC o dispositivo «${equipmentQ}»`;
    }
    return `Coincidencias con «${subnetQ}»`;
  }

  /** Misma regla que la tabla: ¿la subred coincide con los buscadores activos? */
  subnetMatchesSearch(subnet: ExtendedSubnet): boolean {
    return this.subnetMatchesNameSearch(subnet) && this.subnetMatchesEquipmentSearch(subnet);
  }

  private subnetMatchesNameSearch(subnet: ExtendedSubnet): boolean {
    const q = this.normalizeForSearch(this.searchTerm);
    if (!q) {
      return true;
    }
    const fields = [subnet.name, subnet.id, subnet.netId, subnet.mask, subnet.tag];
    return fields.some((v) => this.normalizeForSearch(v).includes(q));
  }

  private subnetMatchesEquipmentSearch(subnet: ExtendedSubnet): boolean {
    if (!this.isEquipmentSearchActive()) {
      return true;
    }
    if (this.hardwareCache === null) {
      return true;
    }
    return this.equipmentMatchNetIds.has(subnet.netId);
  }

  /**
   * Normaliza un valor para búsqueda: lo pasa a string, le quita acentos
   * (NFD + strip de marcas diacríticas), recorta espacios y baja a minúsculas.
   */
  private normalizeForSearch(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  /** Subredes visibles con paginación aplicada al resultado filtrado. */
  get pagedSubnets(): ExtendedSubnet[] {
    const filtered = this.filteredSubnets;
    const start = (this.page - 1) * this.pageSize;
    return filtered.slice(start, start + this.pageSize);
  }

  /** Reset de la página actual al cambiar la búsqueda (evita quedar en una página inexistente). */
  onSearchChange(term?: string): void {
    if (term !== undefined) {
      this.searchTerm = term;
    }
    this.applySearchFilters();
  }

  onEquipmentSearchChange(term?: string): void {
    if (term !== undefined) {
      this.equipmentSearchTerm = term;
    }
    this.rebuildEquipmentMatchNetIds();
    this.applySearchFilters();
  }

  private applySearchFilters(): void {
    this.page = 1;
    this.collectionSize = this.filteredSubnets.length;
    this.scheduleMapSearchHighlight();
  }

  /** Actualiza colores en el mapa sin reconstruir marcadores (mantiene clusters). */
  private scheduleMapSearchHighlight(): void {
    if (this.mapEditMode || !this.map || !this.markerClusterGroup) {
      return;
    }
    if (this.markersRefreshId) {
      clearTimeout(this.markersRefreshId);
    }
    this.markersRefreshId = setTimeout(() => {
      this.markersRefreshId = undefined;
      this.refreshMapMarkerLabels();
    }, 250);
  }

  private getMarkerSearchStyle(subnet: ExtendedSubnet, editable: boolean): {
    highlighted: boolean;
    dimmed: boolean;
  } {
    if (editable || !this.isSearchFilterActive()) {
      return { highlighted: false, dimmed: false };
    }
    const matches = this.subnetMatchesSearch(subnet);
    return { highlighted: matches, dimmed: !matches };
  }

  /** Precarga inventario y conteos una sola vez, fuera del camino crítico de carga. */
  private loadHardwareCountsInBackground(): void {
    if (this.hardwareCountsLoading || (this.hardwareCache && this.devicesCache)) {
      return;
    }
    this.hardwareCountsLoading = true;
    this.loadInventory().subscribe({
      next: ({ hardware, devices }) => {
        if (this.componentDestroyed) {
          return;
        }
        if (this.hardwareCache && this.devicesCache) {
          this.hardwareCountsLoading = false;
          this.refreshMapMarkerLabels();
          return;
        }
        this.scheduleInventoryIndex(hardware, devices);
      },
      error: () => {
        this.finishInventoryLoadError();
      }
    });
  }

  /** Carga PCs (hardware) y dispositivos de red (misma fuente que Dispositivos). */
  private loadInventory(): Observable<{ hardware: any[]; devices: NetworkInfoDTO[] }> {
    if (this.hardwareCache && this.devicesCache) {
      return of({ hardware: this.hardwareCache, devices: this.devicesCache });
    }
    if (!this.inventoryRequest$) {
      this.inventoryRequest$ = forkJoin({
        hardware: this.hardwareService.getHardware().pipe(catchError((err) => {
          console.warn('No se pudo cargar hardware:', err);
          return of([]);
        })),
        devices: this.networkInfoService.getNetworkInfo().pipe(
          map((response) => (response?.success && Array.isArray(response.data) ? response.data : [])),
          catchError((err) => {
            console.warn('No se pudo cargar dispositivos de red:', err);
            return of([]);
          })
        )
      }).pipe(
        map(({ hardware, devices }) => ({
          hardware: Array.isArray(hardware) ? hardware : [],
          devices: Array.isArray(devices) ? devices : []
        })),
        shareReplay(1)
      );
    }
    return this.inventoryRequest$;
  }

  private finishInventoryLoadError(): void {
    this.hardwareCountsLoading = false;
    if (this.hardwareCache === null) {
      this.hardwareCache = [];
      this.devicesCache = [];
    }
  }

  /**
   * Indexa inventario en tandas para no congelar clics, mapa ni la otra búsqueda.
   * El buscador de PC/dispositivo sigue deshabilitado hasta terminar.
   */
  private scheduleInventoryIndex(hardware: any[], devices: NetworkInfoDTO[]): void {
    if (this.inventoryIndexTimer) {
      clearTimeout(this.inventoryIndexTimer);
      this.inventoryIndexTimer = undefined;
    }
    const jobId = ++this.inventoryIndexJobId;
    const prepared = this.prepareSubnetsForLookup();
    const counts = new Map<string, number>();
    for (const s of prepared) {
      if (!counts.has(s.subnet.netId)) {
        counts.set(s.subnet.netId, 0);
      }
    }
    const index: { netId: string; haystack: string }[] = [];
    const items: { ip: string; name: string }[] = [];
    for (const h of hardware) {
      if (h?.ipAddr) {
        items.push({ ip: String(h.ipAddr), name: h.name ?? '' });
      }
    }
    for (const d of devices) {
      if (d?.ip) {
        items.push({ ip: String(d.ip), name: d.name ?? '' });
      }
    }

    let cursor = 0;
    const chunkSize = 250;
    const step = () => {
      if (this.componentDestroyed || jobId !== this.inventoryIndexJobId) {
        return;
      }
      const end = Math.min(cursor + chunkSize, items.length);
      for (; cursor < end; cursor++) {
        this.indexEquipmentItem(items[cursor], prepared, counts, index);
      }
      if (cursor < items.length) {
        this.inventoryIndexTimer = setTimeout(step, 0);
        return;
      }
      this.inventoryIndexTimer = undefined;
      this.ngZone.run(() => {
        if (this.componentDestroyed || jobId !== this.inventoryIndexJobId) {
          return;
        }
        this.hardwareCache = hardware;
        this.devicesCache = devices;
        this.equipmentCountByNetId = counts;
        this.equipmentSearchIndex = index;
        this.rebuildEquipmentMatchNetIds();
        this.hardwareCountsLoading = false;
        if (this.isEquipmentSearchActive()) {
          this.page = 1;
          this.collectionSize = this.filteredSubnets.length;
        }
        this.refreshMapMarkerLabels();
      });
    };
    this.ngZone.runOutsideAngular(() => {
      this.inventoryIndexTimer = setTimeout(step, 0);
    });
  }

  private indexEquipmentItem(
    item: { ip: string; name: string },
    prepared: PreparedSubnet[],
    counts: Map<string, number>,
    index: { netId: string; haystack: string }[]
  ): void {
    const match = this.findPreparedSubnet(item.ip, prepared);
    if (!match) {
      return;
    }
    counts.set(match.subnet.netId, (counts.get(match.subnet.netId) ?? 0) + 1);
    const haystack = `${this.normalizeForSearch(item.name)} ${this.normalizeForSearch(item.ip)}`.trim();
    if (haystack) {
      index.push({ netId: match.subnet.netId, haystack });
    }
  }

  private prepareSubnetsForLookup(): PreparedSubnet[] {
    const prepared: PreparedSubnet[] = [];
    for (const subnet of this.subnets) {
      const maskRaw = subnet.mask?.trim();
      if (!maskRaw) {
        continue;
      }
      const net = ipv4ToUint32(subnet.netId);
      const mask = ipv4ToUint32(maskRaw);
      if (net === null || mask === null) {
        continue;
      }
      let order = 0;
      let n = mask >>> 0;
      while (n) {
        order++;
        n &= n - 1;
      }
      prepared.push({ subnet, net, mask, order });
    }
    prepared.sort((a, b) => b.order - a.order);
    return prepared;
  }

  private findPreparedSubnet(ip: string, prepared: PreparedSubnet[]): PreparedSubnet | null {
    const host = ipv4ToUint32(ip);
    if (host === null) {
      return null;
    }
    for (const entry of prepared) {
      if ((host & entry.mask) === (entry.net & entry.mask)) {
        return entry;
      }
    }
    return null;
  }

  /** Guarda inventario, conteos e índice de búsqueda por PC/dispositivo. */
  private rememberInventory(hardware: any[], devices: NetworkInfoDTO[]): void {
    this.inventoryIndexJobId++;
    if (this.inventoryIndexTimer) {
      clearTimeout(this.inventoryIndexTimer);
      this.inventoryIndexTimer = undefined;
    }
    this.hardwareCache = hardware;
    this.devicesCache = devices;
    const prepared = this.prepareSubnetsForLookup();
    const counts = new Map<string, number>();
    for (const s of prepared) {
      if (!counts.has(s.subnet.netId)) {
        counts.set(s.subnet.netId, 0);
      }
    }
    const index: { netId: string; haystack: string }[] = [];
    for (const h of hardware) {
      if (h?.ipAddr) {
        this.indexEquipmentItem(
          { ip: String(h.ipAddr), name: h.name ?? '' },
          prepared,
          counts,
          index
        );
      }
    }
    for (const d of devices) {
      if (d?.ip) {
        this.indexEquipmentItem(
          { ip: String(d.ip), name: d.name ?? '' },
          prepared,
          counts,
          index
        );
      }
    }
    this.equipmentCountByNetId = counts;
    this.equipmentSearchIndex = index;
    this.rebuildEquipmentMatchNetIds();
    this.hardwareCountsLoading = false;
  }

  private rebuildEquipmentMatchNetIds(): void {
    const q = this.normalizeForSearch(this.equipmentSearchTerm);
    const ids = new Set<string>();
    if (q) {
      for (const entry of this.equipmentSearchIndex) {
        if (entry.haystack.includes(q)) {
          ids.add(entry.netId);
        }
      }
    }
    this.equipmentMatchNetIds = ids;
  }

  private getSubnetEquipmentCount(subnet: ExtendedSubnet): number | null {
    if (!subnet.mask?.trim()) {
      return null;
    }
    if (!this.equipmentCountByNetId.size && !this.hardwareCache?.length) {
      return null;
    }
    return this.equipmentCountByNetId.get(subnet.netId) ?? 0;
  }

  /** Actualiza iconos/tooltips cuando llegan los conteos o cambia la búsqueda. */
  private refreshMapMarkerLabels(): void {
    if (!this.markerClusterGroup) {
      return;
    }

    const apply = () => {
      const updatedMarkers: SubnetMapMarker[] = [];
      const updateMarker = (marker: SubnetMapMarker, editable: boolean) => {
        const subnet = marker.subnetRef;
        if (!subnet) {
          return;
        }
        const count = this.getSubnetEquipmentCount(subnet);
        marker.subnetEquipmentCount = count ?? 0;
        const style = this.getMarkerSearchStyle(subnet, editable);
        marker.subnetSearchMatch = style.highlighted;
        marker.setIcon(
          this.createSubnetMarkerIcon(count, editable, style.highlighted, style.dimmed)
        );
        marker.setZIndexOffset(style.highlighted ? 1200 : 0);
        updatedMarkers.push(marker);
        const tooltip = marker.getTooltip();
        if (tooltip) {
          const peers = marker.collocatedPeers?.length ?? 1;
          tooltip.setContent(this.buildMarkerTooltip(subnet, count, peers));
        }
      };

      const layers = this.markerClusterGroup!.getLayers() as SubnetMapMarker[];
      for (const marker of layers) {
        updateMarker(marker, false);
      }
      if (this.editMarkersLayer) {
        this.editMarkersLayer.eachLayer((layer) => {
          updateMarker(layer as SubnetMapMarker, true);
        });
      }
      if (updatedMarkers.length) {
        this.markerClusterGroup!.refreshClusters(updatedMarkers);
      } else {
        this.markerClusterGroup!.refreshClusters();
      }
    };

    this.ngZone.runOutsideAngular(apply);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchChange();
  }

  clearEquipmentSearch(): void {
    this.equipmentSearchTerm = '';
    this.onEquipmentSearchChange();
  }

  isValidCoordinates(subnet: ExtendedSubnet): boolean {
    return typeof subnet.latitud === 'number' && 
           typeof subnet.longitud === 'number' &&
           subnet.latitud >= -90 && subnet.latitud <= 90 &&
           subnet.longitud >= -180 && subnet.longitud <= 180;
  }

  saveCoordinates(subnet: ExtendedSubnet): void {
    if (this.permissionsService.denyUnless(this.canManageSubnets(), 'guardar coordenadas de subred')) {
      return;
    }
    if (!this.isValidCoordinates(subnet)) {
      this.errorMessage = 'Las coordenadas no son válidas';
      return;
    }
    
    this.loading = true;
    this.errorMessage = null;

    this.subnetService.saveSubnetCoordinates(subnet.netId, subnet.latitud!, subnet.longitud!)
      .subscribe({
        next: () => {
          subnet.hasCoordinates = true;
          this.addMarkersToMap();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al guardar coordenadas:', error);
          this.errorMessage = 'Error al guardar las coordenadas: ' + error.message;
          this.loading = false;
        }
      });
  }

  editCoordinates(subnet: ExtendedSubnet): void {
    if (this.permissionsService.denyUnless(this.canManageSubnets(), 'editar coordenadas de subred')) {
      return;
    }
    subnet.editing = true;
  }

  updateCoordinates(subnet: ExtendedSubnet): void {
    if (this.permissionsService.denyUnless(this.canManageSubnets(), 'actualizar coordenadas de subred')) {
      return;
    }
    if (!this.isValidCoordinates(subnet)) {
      this.errorMessage = 'Las coordenadas no son válidas';
      return;
    }
    
    this.loading = true;
    this.errorMessage = null;

    this.subnetService.updateSubnetCoordinates(subnet.netId, subnet.latitud!, subnet.longitud!)
      .subscribe({
        next: () => {
          subnet.editing = false;
          this.addMarkersToMap();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al actualizar coordenadas:', error);
          this.errorMessage = 'Error al actualizar las coordenadas: ' + error.message;
          this.loading = false;
        }
      });
  }

  cancelEdit(subnet: ExtendedSubnet): void {
    subnet.editing = false;
    this.errorMessage = null;
    
    this.subnetService.getSubnetCoordinates(subnet.netId).subscribe({
      next: (coords) => {
        subnet.latitud = coords.latitud;
        subnet.longitud = coords.longitud;
      },
      error: (error) => {
        console.error('Error al recuperar coordenadas:', error);
        this.errorMessage = 'Error al recuperar las coordenadas: ' + error.message;
      }
    });
  }

  private async loadResources(): Promise<void> {
    return new Promise((resolve) => {
      console.log('Iniciando carga de recursos locales...');

      // Verificar si Leaflet ya está cargado
      if (typeof L === 'undefined') {
        console.error('Leaflet no está cargado. Verifica que el script esté incluido correctamente.');
        return;
      }

      // Configurar la ruta de los iconos
      L.Icon.Default.imagePath = './assets/leaflet/images/';
      console.log('Ruta de iconos configurada:', L.Icon.Default.imagePath);

      // Verificar si MarkerCluster ya está disponible
      if (typeof L.markerClusterGroup === 'function') {
        console.log('MarkerCluster ya está disponible');
        resolve();
        return;
      }

      // Si no está disponible, intentar cargarlo
      const script = document.createElement('script');
      script.src = './assets/leaflet.markercluster/leaflet.markercluster.js';
      
      script.onload = () => {
        console.log('MarkerCluster cargado, verificando estado:', {
          leaflet: typeof L,
          markerCluster: typeof L?.markerClusterGroup,
          hasFunction: typeof L?.markerClusterGroup === 'function'
        });
        
        if (typeof L?.markerClusterGroup === 'function') {
          console.log('MarkerCluster inicializado correctamente');
          resolve();
        } else {
          console.error('Error: MarkerCluster no disponible después de cargar');
          // Intentar obtener desde window
          if (typeof window['L']?.markerClusterGroup === 'function') {
            Object.defineProperty(L, 'markerClusterGroup', {
              value: window['L'].markerClusterGroup.bind(window['L']),
              configurable: true
            });
            console.log('MarkerCluster copiado desde window.L');
            resolve();
          }
        }
      };

      script.onerror = (error) => {
        console.error('Error cargando MarkerCluster:', error);
      };

      document.body.appendChild(script);
    });
  }

  /** true si OSM falló (proxy/firewall) y quedó el fondo local de respaldo. */
  basemapFallbackActive = false;
  private basemapTileErrorCount = 0;
  private osmTileLayer: L.TileLayer | null = null;

  private async initMap(): Promise<void> {
    if (!this.map) {
      console.log('Creando mapa...');
      this.map = L.map('map', {
        center: [-32.5, -55.75],
        zoom: 7,
        minZoom: 6,
        maxZoom: 19
      });

      this.addBasemapLayer();

      this.markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: false,
        showCoverageOnHover: false,
        disableClusteringAtZoom: this.focusSubnetZoom,
        zoomToBoundsOnClick: false,
        iconCreateFunction: (cluster) => this.createClusterEquipmentIcon(cluster)
      });
      this.markerClusterGroup.on('clusterclick', (e: L.LeafletEvent) => {
        this.onMapClusterClick(e);
      });
      this.map.addLayer(this.markerClusterGroup);
      this.map.setMaxBounds(this.getUruguayBounds().pad(0.15));
      console.log('Mapa creado correctamente');
      this.scheduleMapResize();
    }
  }

  /**
   * OSM público exige Referer válido (política reforzada recientemente).
   * Si el proxy/firewall bloquea los tiles, tras varios errores se usa fondo local.
   */
  private addBasemapLayer(): void {
    if (!this.map) {
      return;
    }

    // Leaflet < 1.10 no setea esto solo; sin Referer OSM puede bloquear/timeout.
    (L.TileLayer.prototype.options as L.TileLayerOptions & { referrerPolicy?: string }).referrerPolicy =
      'strict-origin-when-cross-origin';

    this.osmTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
      referrerPolicy: 'strict-origin-when-cross-origin'
    } as L.TileLayerOptions);

    this.osmTileLayer.on('tileerror', () => {
      this.basemapTileErrorCount += 1;
      // Evitar spam de timeouts: si fallan varios, pasar a fondo local
      if (!this.basemapFallbackActive && this.basemapTileErrorCount >= 6) {
        this.ngZone.run(() => this.switchToOfflineBasemap());
      }
    });

    this.osmTileLayer.on('tileload', () => {
      // Si al menos un tile carga, resetear contador de fallos consecutivos
      this.basemapTileErrorCount = 0;
    });

    this.osmTileLayer.addTo(this.map);
  }

  private switchToOfflineBasemap(): void {
    if (!this.map || this.basemapFallbackActive) {
      return;
    }
    this.basemapFallbackActive = true;
    if (this.osmTileLayer) {
      this.map.removeLayer(this.osmTileLayer);
      this.osmTileLayer = null;
    }
    // Sin capa remota: el fondo CSS de .subnets-map alcanza para ubicar pins
    const mapEl = this.map.getContainer();
    mapEl.classList.add('subnets-map--offline-basemap');
    console.warn('OSM no alcanzable (proxy/firewall). Usando fondo local; los marcadores siguen activos.');
  }

  private getUruguayBounds(): L.LatLngBounds {
    return L.latLngBounds(this.uruguaySouthWest, this.uruguayNorthEast);
  }

  /** Encuadra todo Uruguay; prioriza que norte y sur toquen el borde vertical del mapa. */
  private fitMapToUruguay(): void {
    if (!this.map) {
      return;
    }
    const bounds = this.getUruguayBounds();
    this.map.fitBounds(bounds, {
      padding: [0, 0],
      maxZoom: 10
    });
  }

  /** Agrupa subredes con la misma coordenada y las reparte en círculo (evita pins tapados). */
  private computeMarkerPlacements(subnets: ExtendedSubnet[]): Map<string, MarkerPlacement> {
    const groups = new Map<string, ExtendedSubnet[]>();
    for (const s of subnets) {
      const key = `${s.latitud!.toFixed(5)},${s.longitud!.toFixed(5)}`;
      const list = groups.get(key) ?? [];
      list.push(s);
      groups.set(key, list);
    }

    const placements = new Map<string, MarkerPlacement>();
    for (const group of groups.values()) {
      group.sort((a, b) => (a.id ?? '').localeCompare(b.id ?? '', 'es'));
      const centerLat = group[0].latitud!;
      const centerLng = group[0].longitud!;
      const peers = group.length > 1 ? group : [];

      group.forEach((subnet, index) => {
        const [lat, lng] = this.offsetCollocated(index, group.length, centerLat, centerLng);
        placements.set(subnet.netId, { lat, lng, peers });
      });
    }
    return placements;
  }

  /** Desplaza cada subred en un anillo alrededor del punto original (~15–90 m). */
  private offsetCollocated(
    index: number,
    total: number,
    centerLat: number,
    centerLng: number
  ): L.LatLngTuple {
    if (total <= 1) {
      return [centerLat, centerLng];
    }

    const angle = (2 * Math.PI * index) / total - Math.PI / 2;
    const radiusM = Math.min(14 + total * 2.8, 95);
    const latRad = (centerLat * Math.PI) / 180;
    const latOffset = (radiusM / 111_320) * Math.cos(angle);
    const lngOffset = (radiusM / (111_320 * Math.cos(latRad))) * Math.sin(angle);
    return [centerLat + latOffset, centerLng + lngOffset];
  }

  private onMapClusterClick(e: L.LeafletEvent): void {
    L.DomEvent.stopPropagation(e);
    const cluster = (e as L.LeafletEvent & { layer: SubnetMapCluster }).layer;
    if (!cluster || !this.map) return;

    const markers = cluster.getAllChildMarkers() as SubnetMapMarker[];

    if (markers.length === 1) {
      const subnet = markers[0].subnetRef;
      this.ngZone.run(() => this.openHardwareModal(subnet));
      this.focusMapOnSubnet(subnet);
      return;
    }

    const subnets = this.extractSubnetsFromClusterMarkers(markers);
    this.ngZone.run(() =>
      this.openLocationPickerModal(subnets, 'Subredes en esta zona')
    );
    this.focusMapOnMarkers(markers);
  }

  /** Subredes únicas representadas por los marcadores del cluster. */
  private extractSubnetsFromClusterMarkers(markers: SubnetMapMarker[]): ExtendedSubnet[] {
    const seen = new Set<string>();
    const subnets: ExtendedSubnet[] = [];
    for (const marker of markers) {
      const ref = marker.subnetRef;
      if (ref && !seen.has(ref.netId)) {
        seen.add(ref.netId);
        subnets.push(ref);
      }
    }
    return subnets;
  }

  /** Igual que disableClusteringAtZoom del MarkerClusterGroup: ahí el plugin separa solo. */
  private readonly focusSubnetZoom = 17;

  /**
   * Salto de zoom sin animación: el cluster se desarma al instante (como llegar a 17 con la rueda),
   * sin estados intermedios que chocan con el modal.
   */
  private applyMapViewInstant(center: L.LatLng, zoom: number, whenDone?: () => void): void {
    if (!this.map) {
      whenDone?.();
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      this.map!.setView(center, zoom, { animate: false });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => whenDone?.());
      });
    });
  }

  private flyToNaturalUncluster(center: L.LatLng, whenDone?: () => void): void {
    if (!this.map) {
      whenDone?.();
      return;
    }
    const targetZoom = Math.max(this.map.getZoom(), this.focusSubnetZoom);
    const needsMove =
      this.map.getZoom() < targetZoom ||
      this.map.getCenter().distanceTo(center) >= 40;

    if (!needsMove) {
      whenDone?.();
      return;
    }

    this.applyMapViewInstant(center, targetZoom, whenDone);
  }

  private focusMapOnSubnet(subnet: ExtendedSubnet, whenDone?: () => void): void {
    if (!this.map) {
      whenDone?.();
      return;
    }
    const placement = this.markerPlacements.get(subnet.netId);
    const lat = placement?.lat ?? subnet.latitud;
    const lng = placement?.lng ?? subnet.longitud;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      whenDone?.();
      return;
    }
    const hasCollocated = (placement?.peers.length ?? 0) > 1;
    if (hasCollocated) {
      this.flyToNaturalUncluster(L.latLng(lat, lng), whenDone);
      return;
    }

    const target = L.latLng(lat, lng);
    const minZoom = 15;
    const targetZoom = Math.max(this.map.getZoom(), minZoom);
    const needsMove =
      this.map.getZoom() < targetZoom ||
      this.map.getCenter().distanceTo(target) >= 40;
    if (!needsMove) {
      whenDone?.();
      return;
    }
    this.applyMapViewInstant(target, targetZoom, whenDone);
  }

  private focusMapOnMarkers(markers: SubnetMapMarker[], whenDone?: () => void): void {
    if (!this.map || markers.length === 0) {
      whenDone?.();
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => m.getLatLng()));
    if (!bounds.isValid()) {
      whenDone?.();
      return;
    }
    this.flyToNaturalUncluster(bounds.getCenter(), whenDone);
  }

  /** Leaflet + MarkerCluster: refresh tras cambios de layout (modales). */
  private repaintMapMarkers(done?: () => void): void {
    const map = this.map;
    const group = this.markerClusterGroup;
    if (!map || !group) {
      done?.();
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      if (!this.mapEditMode && !map.hasLayer(group)) {
        group.addTo(map);
      }
      group.refreshClusters();
      requestAnimationFrame(() => {
        group.refreshClusters();
        done?.();
      });
    });
  }

  private cancelHardwareModalRepaint(): void {
    if (this.hardwareModalRepaintId) {
      clearTimeout(this.hardwareModalRepaintId);
      this.hardwareModalRepaintId = undefined;
    }
  }

  /** Registra modal abierto: repinta clusters. */
  private registerMapModalOpen(): void {
    this.mapModalOpenCount += 1;
  }

  private registerMapModalClose(): void {
    this.cancelHardwareModalRepaint();
    this.mapModalOpenCount = 0;
    setTimeout(() => this.scheduleMapResize(), 0);
  }

  openLocationPickerModal(subnets: ExtendedSubnet[], title?: string): void {
    this.locationPickerSubnets = [...subnets].sort((a, b) =>
      (a.id ?? a.name ?? '').localeCompare(b.id ?? b.name ?? '', 'es')
    );
    this.locationPickerTitle = title ?? 'Subredes en esta ubicación';
    this.locationPickerOpen = true;
  }

  closeLocationPickerModal(): void {
    if (!this.locationPickerOpen) {
      return;
    }
    this.locationPickerOpen = false;
    this.locationPickerSubnets = [];
    this.locationPickerTitle = '';
  }

  pickSubnetFromLocation(subnet: ExtendedSubnet): void {
    this.locationPickerOpen = false;
    this.locationPickerSubnets = [];
    this.locationPickerTitle = '';
    this.ngZone.run(() => this.openHardwareModal(subnet));
    this.focusMapOnSubnet(subnet);
  }

  equipmentCountLabel(subnet: ExtendedSubnet): string {
    const c = this.getSubnetEquipmentCount(subnet);
    if (c === null) return '·';
    return String(c);
  }

  private addMarkersToMap(): void {
    if (!this.map || !this.markerClusterGroup) {
      console.error('Mapa o markerClusterGroup no inicializados');
      return;
    }

    if (this.markersRefreshId) {
      clearTimeout(this.markersRefreshId);
      this.markersRefreshId = undefined;
    }

    this.markerClusterGroup.clearLayers();
    this.editMarkersLayer?.clearLayers();

    const subnetsWithCoordinates = this.subnets.filter(subnet =>
      subnet.hasCoordinates &&
      typeof subnet.latitud === 'number' &&
      typeof subnet.longitud === 'number'
    );
    this.subnetsOnMapCount = subnetsWithCoordinates.length;
    this.markerPlacements = this.computeMarkerPlacements(subnetsWithCoordinates);
    this.syncMapLayersForMode();

    this.ngZone.runOutsideAngular(() => {
      subnetsWithCoordinates.forEach(subnet => {
        const placement = this.markerPlacements.get(subnet.netId)!;
        const marker = this.createSubnetMarker(
          subnet,
          placement,
          this.mapEditMode
        );
        if (this.mapEditMode) {
          this.editMarkersLayer?.addLayer(marker);
        } else {
          this.markerClusterGroup?.addLayer(marker);
        }
      });

      if (!this.mapInitialFitDone) {
        this.fitMapToUruguay();
        this.mapInitialFitDone = true;
      } else {
        this.map?.invalidateSize();
      }
    });
  }

  private createSubnetMarker(
    subnet: ExtendedSubnet,
    placement: MarkerPlacement,
    editable: boolean
  ): SubnetMapMarker {
    const count = this.getSubnetEquipmentCount(subnet);
    const style = this.getMarkerSearchStyle(subnet, editable);
    const marker = L.marker([placement.lat, placement.lng], {
      icon: this.createSubnetMarkerIcon(
        count,
        editable,
        style.highlighted,
        style.dimmed
      ),
      draggable: editable,
      autoPan: editable,
      zIndexOffset: style.highlighted ? 1200 : 0
    }) as SubnetMapMarker;

    marker.subnetRef = subnet;
    marker.subnetEquipmentCount = count ?? 0;
    marker.subnetSearchMatch = style.highlighted;
    marker.collocatedPeers = placement.peers.length > 1 ? placement.peers : undefined;

    marker.bindTooltip(
      editable
        ? this.buildEditMarkerTooltip(subnet)
        : this.buildMarkerTooltip(subnet, count, placement.peers.length),
      {
        direction: 'top',
        offset: [0, -14],
        opacity: 0.95,
        sticky: false
      }
    );

    if (editable) {
      marker.on('dragstart', () => {
        this.ngZone.run(() => {
          if (this.mapEditPending && this.mapEditPending.marker !== marker) {
            this.cancelMapEditMove();
          }
          const pos = marker.getLatLng();
          this.mapEditPending = {
            subnet,
            marker,
            displayLat: pos.lat,
            displayLng: pos.lng,
            lat: pos.lat,
            lng: pos.lng
          };
        });
      });
      marker.on('drag', () => {
        const pos = marker.getLatLng();
        if (this.mapEditPending?.marker === marker) {
          this.ngZone.run(() => {
            this.mapEditPending!.lat = pos.lat;
            this.mapEditPending!.lng = pos.lng;
          });
        }
      });
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        this.ngZone.run(() => {
          if (this.mapEditPending?.marker === marker) {
            this.mapEditPending.lat = pos.lat;
            this.mapEditPending.lng = pos.lng;
          }
        });
      });
    } else {
      marker.on('click', (ev: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(ev);
        this.ngZone.run(() => this.openHardwareModal(subnet));
        this.focusMapOnSubnet(subnet);
      });
      marker.on('mouseover', () => marker.setZIndexOffset(2000));
      marker.on('mouseout', () => marker.setZIndexOffset(0));
    }

    return marker;
  }

  private buildEditMarkerTooltip(subnet: ExtendedSubnet): string {
    return `<strong>${this.escapeHtml(subnet.id || subnet.name)}</strong><br>
      Net ID ${this.escapeHtml(subnet.netId)}<br>
      <em class="subnet-map-tooltip-hint">Arrastrá el pin y confirmá la nueva ubicación</em>`;
  }

  /**
   * Icono de cluster: suma equipos usando el conteo ya guardado en cada marcador.
   */
  private createClusterEquipmentIcon(cluster: {
    getAllChildMarkers: () => L.Marker[];
  }): L.DivIcon {
    const markers = cluster.getAllChildMarkers() as SubnetMapMarker[];
    const total = markers.reduce(
      (sum, m) => sum + (m.subnetEquipmentCount ?? 0),
      0
    );
    const subnetCount = markers.length;
    const searchActive = this.isSearchFilterActive();
    const hasSearchMatch =
      searchActive && markers.some((m) => this.subnetMatchesSearch(m.subnetRef));
    const searchClass = hasSearchMatch ? ' subnet-map-cluster--search-match' : '';
    const dimClass = searchActive && !hasSearchMatch ? ' subnet-map-cluster--dimmed' : '';
    const clusterStyle = hasSearchMatch
      ? ' style="background:#ffeb3b!important;color:#5d4037!important;border:3px solid #f57f17!important;box-shadow:0 0 0 2px #fff,0 3px 14px rgba(245,127,23,0.75)!important;"'
      : searchActive && !hasSearchMatch
        ? ' style="opacity:0.22!important;filter:grayscale(0.4)!important;"'
        : '';
    const sizeClass =
      total >= 100
        ? 'subnet-map-cluster--large'
        : total >= 10
          ? 'subnet-map-cluster--medium'
          : 'subnet-map-cluster--small';
    const display = String(total);
    const dim =
      total >= 1000 ? 58 : total >= 100 ? 52 : total >= 10 ? 46 : 40;
    const wideClass = total >= 1000 ? ' subnet-map-cluster--xlarge' : '';

    return L.divIcon({
      className: 'subnet-map-cluster-wrap',
      html: `<div class="subnet-map-cluster ${sizeClass}${wideClass}${searchClass}${dimClass}"${clusterStyle} title="${total} equipos en ${subnetCount} subredes"><span>${display}</span></div>`,
      iconSize: L.point(dim, dim, true)
    });
  }

  private createSubnetMarkerIcon(
    count: number | null,
    editable = false,
    highlighted = false,
    dimmed = false
  ): L.DivIcon {
    const hasCount = count !== null;
    const display = hasCount ? String(count) : '·';
    const sizeClass =
      hasCount && count > 99
        ? 'subnet-map-pin--wide'
        : hasCount && count === 0 && !highlighted
          ? 'subnet-map-pin--empty'
          : '';
    const editClass = editable ? ' subnet-map-pin--editable' : '';
    const highlightClass = highlighted ? ' subnet-map-pin--search-match' : '';
    const dimClass = dimmed ? ' subnet-map-pin--dimmed' : '';
    const inlineStyle = highlighted
      ? ' style="background:#ffeb3b!important;color:#5d4037!important;border:3px solid #f57f17!important;box-shadow:0 0 0 2px #fff,0 3px 12px rgba(245,127,23,0.8)!important;"'
      : dimmed
        ? ' style="opacity:0.22!important;filter:grayscale(0.4)!important;"'
        : editable
          ? ' style="background:linear-gradient(180deg,#f59e0b 0%,#d97706 100%)!important;"'
          : '';
    return L.divIcon({
      className: 'subnet-map-pin-wrap',
      html: `<div class="subnet-map-pin ${sizeClass}${editClass}${highlightClass}${dimClass}"${inlineStyle} aria-hidden="true"><span>${display}</span></div>`,
      iconSize: [36, 40],
      iconAnchor: [18, 40],
      tooltipAnchor: [0, -36]
    });
  }

  private buildMarkerTooltip(
    subnet: ExtendedSubnet,
    count: number | null,
    collocatedTotal = 1
  ): string {
    const countLine =
      count !== null
        ? `${count} activo${count === 1 ? '' : 's'} (PCs + dispositivos)`
        : subnet.mask
          ? 'Clic para ver PCs y dispositivos'
          : 'Sin máscara: no se puede contar activos';
    const stackLine =
      collocatedTotal > 1
        ? `<br><em class="subnet-map-tooltip-hint">${collocatedTotal} subredes en este punto — clic para elegir</em>`
        : `<br><em class="subnet-map-tooltip-hint">Clic para abrir el listado</em>`;
    return `<strong>${this.escapeHtml(subnet.name)}</strong><br>
      ${this.escapeHtml(subnet.id || subnet.netId)}<br>
      Net ID ${this.escapeHtml(subnet.netId)}<br>
      ${countLine}${stackLine}`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.subnets.sort((a, b) => {
      let valueA = a[column];
      let valueB = b[column];

      // Manejo especial para IPs
      if (column === 'ipAddr' || column === 'mask') {
        valueA = valueA.split('.').map((num: string) => parseInt(num, 10));
        valueB = valueB.split('.').map((num: string) => parseInt(num, 10));
        
        for (let i = 0; i < 4; i++) {
          if (valueA[i] !== valueB[i]) {
            return (valueA[i] - valueB[i]) * (this.sortDirection === 'asc' ? 1 : -1);
          }
        }
        return 0;
      }

      // Manejo normal para otros campos
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

  canManageSubnets(): boolean {
    return this.permissionsService.canManageSubnets();
  }

  toggleMapEditMode(): void {
    if (this.permissionsService.denyUnless(this.canManageSubnets(), 'editar ubicaciones en el mapa')) {
      return;
    }
    if (this.mapEditMode) {
      this.exitMapEditMode();
      return;
    }
    this.mapEditMode = true;
    this.mapEditPending = null;
    this.addMarkersToMap();
  }

  exitMapEditMode(): void {
    this.cancelMapEditMove();
    this.mapEditMode = false;
    this.addMarkersToMap();
  }

  confirmMapEditMove(): void {
    const pending = this.mapEditPending;
    if (!pending || this.mapEditSaving) return;

    this.mapEditSaving = true;
    this.errorMessage = null;

    const save$ = pending.subnet.hasCoordinates
      ? this.subnetService.updateSubnetCoordinates(
          pending.subnet.netId,
          pending.lat,
          pending.lng
        )
      : this.subnetService.saveSubnetCoordinates(
          pending.subnet.netId,
          pending.lat,
          pending.lng
        );

    save$.subscribe({
      next: () => {
        pending.subnet.latitud = pending.lat;
        pending.subnet.longitud = pending.lng;
        pending.subnet.hasCoordinates = true;
        this.mapEditPending = null;
        this.mapEditSaving = false;
        this.addMarkersToMap();
      },
      error: (error) => {
        console.error('Error al guardar coordenadas del mapa:', error);
        this.errorMessage =
          'Error al guardar la nueva ubicación: ' + (error.message ?? error);
        this.mapEditSaving = false;
      }
    });
  }

  cancelMapEditMove(): void {
    if (!this.mapEditPending) return;
    this.mapEditPending.marker.setLatLng([
      this.mapEditPending.displayLat,
      this.mapEditPending.displayLng
    ]);
    this.mapEditPending = null;
  }

  formatCoord(value: number): string {
    return value.toFixed(6);
  }

  private syncMapLayersForMode(): void {
    if (!this.map || !this.markerClusterGroup) {
      return;
    }

    if (this.mapEditMode) {
      if (this.map.hasLayer(this.markerClusterGroup)) {
        this.map.removeLayer(this.markerClusterGroup);
      }
      if (!this.editMarkersLayer) {
        this.editMarkersLayer = L.layerGroup();
      }
      if (!this.map.hasLayer(this.editMarkersLayer)) {
        this.editMarkersLayer.addTo(this.map);
      }
    } else {
      this.editMarkersLayer?.clearLayers();
      if (this.editMarkersLayer && this.map.hasLayer(this.editMarkersLayer)) {
        this.map.removeLayer(this.editMarkersLayer);
      }
      if (!this.map.hasLayer(this.markerClusterGroup)) {
        this.markerClusterGroup.addTo(this.map);
      }
    }
  }

  /** Abre el modal y carga (o reusa) el listado de hardware para esta subred. */
  openHardwareModal(subnet: ExtendedSubnet): void {
    const wasOpen = this.hardwareModalOpen;
    this.hardwareModalOpen = true;
    this.hardwareModalSubnet = subnet;
    this.hardwareModalError = null;
    this.hardwareModalSearch = '';
    this.hardwareModalRows = [];
    if (!wasOpen) {
      this.registerMapModalOpen();
      this.cancelHardwareModalRepaint();
      this.hardwareModalRepaintId = setTimeout(() => {
        this.hardwareModalRepaintId = undefined;
        this.scheduleMapResize();
      }, 0);
    }

    if (this.hardwareCache && this.devicesCache) {
      this.applyHardwareFilter();
      return;
    }

    this.hardwareModalLoading = true;
    this.loadInventory().pipe(
      catchError((err) => {
        console.error('Error al cargar inventario para subred:', err);
        this.hardwareModalError = 'No se pudo cargar el listado de equipos y dispositivos.';
        this.hardwareModalLoading = false;
        return of({ hardware: [] as any[], devices: [] as NetworkInfoDTO[] });
      })
    ).subscribe({
      next: ({ hardware, devices }) => {
        this.rememberInventory(hardware, devices);
        if (this.isEquipmentSearchActive()) {
          this.collectionSize = this.filteredSubnets.length;
        }
        this.refreshMapMarkerLabels();
        this.applyHardwareFilter();
        this.hardwareModalLoading = false;
      }
    });
  }

  closeHardwareModal(): void {
    if (!this.hardwareModalOpen) {
      return;
    }
    this.cancelHardwareModalRepaint();
    this.hardwareModalOpen = false;
    this.hardwareModalSubnet = null;
    this.hardwareModalRows = [];
    this.hardwareModalError = null;
    this.hardwareModalSearch = '';
    this.registerMapModalClose();
  }

  /** Desde el modal de equipos: ir al detalle del equipo. */
  openAssetDetailsFromModal(row: SubnetHardwareRow): void {
    if (!row?.id) {
      return;
    }
    void this.router.navigate(['/menu/asset-details', row.id], {
      state: { volverSubnets: true }
    });
  }

  refreshHardwareModal(): void {
    if (!this.hardwareModalSubnet) {
      return;
    }
    this.hardwareCache = null;
    this.devicesCache = null;
    this.inventoryRequest$ = null;
    this.inventoryIndexJobId++;
    if (this.inventoryIndexTimer) {
      clearTimeout(this.inventoryIndexTimer);
      this.inventoryIndexTimer = undefined;
    }
    this.openHardwareModal(this.hardwareModalSubnet);
  }

  /** Exporta todas las subredes agrupadas por nombre con PCs y dispositivos por ID. */
  exportarExcel(): void {
    if (this.exportingExcel || this.loading) {
      return;
    }
    this.exportingExcel = true;
    this.errorMessage = null;

    this.loadInventory().subscribe({
      next: ({ hardware, devices }) => {
        this.rememberInventory(hardware, devices);
        if (this.isEquipmentSearchActive()) {
          this.collectionSize = this.filteredSubnets.length;
        }
        this.refreshMapMarkerLabels();
        try {
          const sheetRows = this.buildExcelExportRows(hardware, devices);
          const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
          worksheet['!cols'] = [
            { wch: 28 },
            { wch: 18 },
            { wch: 16 },
            { wch: 16 },
            { wch: 14 },
            { wch: 28 },
            { wch: 16 },
            { wch: 22 },
            { wch: 24 },
            { wch: 18 },
            { wch: 20 }
          ];
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Subredes');
          const stamp = new Date().toISOString().slice(0, 10);
          XLSX.writeFile(workbook, `subredes_inventario_${stamp}.xlsx`);
        } catch (err) {
          console.error('Error al exportar Excel:', err);
          this.errorMessage = 'No se pudo generar el archivo Excel.';
        } finally {
          this.exportingExcel = false;
        }
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar datos para exportar.';
        this.exportingExcel = false;
      }
    });
  }

  private buildExcelExportRows(hardware: any[], devices: NetworkInfoDTO[]): unknown[][] {
    const header = [
      'Nombre agrupación',
      'ID subred',
      'Net ID',
      'Máscara',
      'Tipo',
      'Nombre',
      'IP',
      'SO / tipo dispositivo',
      'Usuario / descripción',
      'MAC',
      'Último contacto'
    ];
    const rows: unknown[][] = [header];
    const groups = this.groupSubnetsByDisplayName();

    for (const groupName of [...groups.keys()].sort((a, b) => a.localeCompare(b, 'es'))) {
      const subnetsInGroup = groups.get(groupName)!;
      for (const subnet of subnetsInGroup) {
        const assets = this.collectAssetsForSubnet(subnet, hardware, devices);
        if (assets.length === 0) {
          rows.push([
            groupName,
            subnet.id ?? '',
            subnet.netId ?? '',
            subnet.mask ?? '',
            'Subred (sin activos)',
            '',
            '',
            '',
            '',
            '',
            ''
          ]);
          continue;
        }
        for (const asset of assets) {
          rows.push([
            groupName,
            subnet.id ?? '',
            subnet.netId ?? '',
            subnet.mask ?? '',
            asset.kind === 'pc' ? 'PC' : 'Dispositivo',
            asset.name || '—',
            asset.ipAddr || '—',
            asset.osName || asset.type || '—',
            asset.userid || '—',
            asset.mac ?? '',
            asset.lastcome ? this.formatExportDate(asset.lastcome) : ''
          ]);
        }
      }
    }
    return rows;
  }

  private groupSubnetsByDisplayName(): Map<string, ExtendedSubnet[]> {
    const groups = new Map<string, ExtendedSubnet[]>();
    for (const subnet of this.subnets) {
      const key = (subnet.name ?? '').trim() || '(Sin nombre)';
      const list = groups.get(key) ?? [];
      list.push(subnet);
      groups.set(key, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => {
        const byId = (a.id ?? '').localeCompare(b.id ?? '', 'es');
        if (byId !== 0) return byId;
        return (a.netId ?? '').localeCompare(b.netId ?? '', 'es');
      });
    }
    return groups;
  }

  private collectAssetsForSubnet(
    subnet: ExtendedSubnet,
    hardware: any[],
    devices: NetworkInfoDTO[]
  ): SubnetHardwareRow[] {
    if (!subnet.mask?.trim()) {
      return [];
    }
    const rows: SubnetHardwareRow[] = [];
    for (const h of hardware) {
      if (!ipv4MatchesSubnet(h?.ipAddr, subnet)) continue;
      rows.push(this.mapHardwareToRow(h));
    }
    for (const d of devices) {
      if (!ipv4MatchesSubnet(d?.ip, subnet)) continue;
      rows.push(this.mapDeviceToRow(d));
    }
    rows.sort((a, b) => {
      const kindOrder = a.kind === b.kind ? 0 : a.kind === 'pc' ? -1 : 1;
      if (kindOrder !== 0) return kindOrder;
      return this.compareIpv4(a.ipAddr, b.ipAddr);
    });
    return rows;
  }

  private mapHardwareToRow(h: any): SubnetHardwareRow {
    return {
      kind: 'pc',
      id: h.id,
      name: h.name ?? '',
      ipAddr: h.ipAddr ?? '',
      osName: h.osName ?? '',
      type: h.type ?? '',
      userid: h.userid ?? '',
      lastcome: h.lastCome ?? h.lastcome ?? null
    };
  }

  private mapDeviceToRow(d: NetworkInfoDTO): SubnetHardwareRow {
    return {
      kind: 'device',
      name: d.name ?? '',
      ipAddr: d.ip ?? '',
      osName: d.type ?? '',
      type: d.type ?? '',
      userid: d.description ?? '',
      mac: d.mac ?? '',
      lastcome: null
    };
  }

  private formatExportDate(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return value;
    }
    return d.toLocaleString('es-UY');
  }

  assetKindLabel(row: SubnetHardwareRow): string {
    return row.kind === 'pc' ? 'PC' : 'Dispositivo';
  }

  private applyHardwareFilter(): void {
    const subnet = this.hardwareModalSubnet;
    const hardware = this.hardwareCache ?? [];
    const devices = this.devicesCache ?? [];
    if (!subnet) {
      this.hardwareModalRows = [];
      return;
    }
    this.hardwareModalRows = this.collectAssetsForSubnet(subnet, hardware, devices);
  }

  /** Comparador IPv4 octeto a octeto; strings vacíos al final. */
  private compareIpv4(a: string, b: string): number {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
    const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < 4; i++) {
      const da = pa[i] ?? 0;
      const db = pb[i] ?? 0;
      if (da !== db) return da - db;
    }
    return 0;
  }

  /** Lista visible: aplica el buscador de texto sobre las filas ya filtradas por subred. */
  get filteredHardwareRows(): SubnetHardwareRow[] {
    const q = this.hardwareModalSearch.trim().toLowerCase();
    if (!q) return this.hardwareModalRows;
    return this.hardwareModalRows.filter((r) =>
      [r.name, r.ipAddr, r.osName, r.type, r.userid, r.mac, r.kind === 'pc' ? 'pc' : 'dispositivo']
        .filter((v): v is string => !!v)
        .some((v) => v.toLowerCase().includes(q))
    );
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.hardwareModalOpen) {
      this.closeHardwareModal();
    } else if (this.locationPickerOpen) {
      this.closeLocationPickerModal();
    } else if (this.mapEditPending) {
      this.cancelMapEditMove();
    } else if (this.mapEditMode) {
      this.exitMapEditMode();
    }
  }

  ngOnDestroy(): void {
    this.componentDestroyed = true;
    this.tourCleanup?.();
    this.tourCleanup = undefined;
    this.cancelHardwareModalRepaint();
    if (this.resizeDebounceId) clearTimeout(this.resizeDebounceId);
    if (this.markersRefreshId) clearTimeout(this.markersRefreshId);
    if (this.inventoryIndexTimer) clearTimeout(this.inventoryIndexTimer);
    if (this.hardwareModalOpen) {
      this.hardwareModalOpen = false;
    }
    this.mapModalOpenCount = 0;
    this.markerClusterGroup?.clearLayers();
    this.editMarkersLayer?.clearLayers();
    this.map?.remove();
    this.map = undefined;
    this.markerClusterGroup = undefined;
    this.editMarkersLayer = undefined;
  }
} 