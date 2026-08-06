import { Component, OnDestroy, OnInit, AfterViewInit, HostListener, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  SubnetService,
  SubnetDTO,
  SubnetCoordinatesDTO,
  ipv4MatchesSubnet,
  findSubnetForIpv4
} from '../services/subnet.service';
import { HardwareService } from '../services/hardware.service';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { PermissionsService } from '../services/permissions.service';
import { TourRegistryService } from '../services/tour-registry.service';

/** Fila reducida de hardware que mostramos en el modal de equipos por subred. */
interface SubnetHardwareRow {
  id: number;
  name: string;
  ipAddr: string;
  osName: string;
  type: string;
  userid: string;
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
  /** Conteos precalculados por netId (evita filtrar todo el inventario en cada marcador). */
  private equipmentCountByNetId = new Map<string, number>();
  private hardwareCountsLoading = false;
  private mapInitialFitDone = false;
  private resizeDebounceId: ReturnType<typeof setTimeout> | undefined;
  private markersRefreshId: ReturnType<typeof setTimeout> | undefined;
  /** Modales del mapa abiertos (sin tocar el zoom global 0.8 del body). */
  private mapModalOpenCount = 0;
  private hardwareModalRepaintId: ReturnType<typeof setTimeout> | undefined;
  private markerPlacements = new Map<string, MarkerPlacement>();

  constructor(
    private subnetService: SubnetService,
    private permissionsService: PermissionsService,
    private tourRegistry: TourRegistryService,
    private hardwareService: HardwareService,
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
        { selector: '#tour-subnets-toolbar', title: 'Resumen', description: 'Contador de registros cargados y estado de la operación.', side: 'bottom' },
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
   * Subredes filtradas por el buscador (nombre, id, netId, máscara, tag).
   * La búsqueda es case-insensitive e ignora acentos/diéresis para que
   * "limon" matchee con "Limón" y "ANIO" con "año".
   */
  get filteredSubnets(): ExtendedSubnet[] {
    if (!this.isSearchFilterActive()) {
      return this.subnets;
    }
    return this.subnets.filter((s) => this.subnetMatchesSearch(s));
  }

  /** Hay texto de búsqueda activo (tras normalizar). */
  isSearchFilterActive(): boolean {
    return this.normalizeForSearch(this.searchTerm).length > 0;
  }

  /** Misma regla que la tabla: ¿la subred coincide con el buscador? */
  subnetMatchesSearch(subnet: ExtendedSubnet): boolean {
    const q = this.normalizeForSearch(this.searchTerm);
    if (!q) {
      return true;
    }
    const fields = [subnet.name, subnet.id, subnet.netId, subnet.mask, subnet.tag];
    return fields.some((v) => this.normalizeForSearch(v).includes(q));
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
    if (this.hardwareCountsLoading || this.hardwareCache) {
      return;
    }
    this.hardwareCountsLoading = true;
    this.hardwareService.getHardware().pipe(
      catchError((err) => {
        console.warn('No se pudo precargar hardware para el mapa:', err);
        return of([]);
      })
    ).subscribe({
      next: (hardware) => {
        this.hardwareCache = Array.isArray(hardware) ? hardware : [];
        this.ngZone.runOutsideAngular(() => {
          this.equipmentCountByNetId = this.buildEquipmentCountMap(this.hardwareCache!);
          this.ngZone.run(() => {
            this.hardwareCountsLoading = false;
            this.refreshMapMarkerLabels();
          });
        });
      },
      error: () => {
        this.hardwareCountsLoading = false;
      }
    });
  }

  /** Una pasada sobre el inventario → mapa netId → cantidad de equipos. */
  private buildEquipmentCountMap(hardware: any[]): Map<string, number> {
    const counts = new Map<string, number>();
    const subnetsWithMask = this.subnets.filter((s) => s.mask?.trim());
    for (const s of subnetsWithMask) {
      counts.set(s.netId, 0);
    }
    for (const h of hardware) {
      const ip = h?.ipAddr;
      if (!ip?.trim()) continue;
      const match = findSubnetForIpv4(ip, subnetsWithMask);
      if (match) {
        counts.set(match.netId, (counts.get(match.netId) ?? 0) + 1);
      }
    }
    return counts;
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

  isValidCoordinates(subnet: ExtendedSubnet): boolean {
    return typeof subnet.latitud === 'number' && 
           typeof subnet.longitud === 'number' &&
           subnet.latitud >= -90 && subnet.latitud <= 90 &&
           subnet.longitud >= -180 && subnet.longitud <= 180;
  }

  saveCoordinates(subnet: ExtendedSubnet): void {
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
    subnet.editing = true;
  }

  updateCoordinates(subnet: ExtendedSubnet): void {
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

  private async initMap(): Promise<void> {
    if (!this.map) {
      console.log('Creando mapa...');
      this.map = L.map('map', {
        center: [-32.5, -55.75],
        zoom: 7,
        minZoom: 6,
        maxZoom: 19
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

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

  /** Registra modal abierto: repinta clusters sin cambiar zoom global de la app. */
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
        ? `${count} equipo${count === 1 ? '' : 's'} en subred`
        : subnet.mask
          ? 'Clic para ver equipos'
          : 'Sin máscara: no se puede contar equipos';
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
    if (!this.canManageSubnets()) return;
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

    if (this.hardwareCache) {
      this.applyHardwareFilter();
      return;
    }

    this.hardwareModalLoading = true;
    this.hardwareService.getHardware().pipe(
      catchError((err) => {
        console.error('Error al cargar hardware para subred:', err);
        this.hardwareModalError = 'No se pudo cargar el listado de equipos.';
        this.hardwareModalLoading = false;
        return of([]);
      })
    ).subscribe({
      next: (list) => {
        this.hardwareCache = Array.isArray(list) ? list : [];
        if (!this.equipmentCountByNetId.size) {
          this.equipmentCountByNetId = this.buildEquipmentCountMap(this.hardwareCache);
          this.refreshMapMarkerLabels();
        }
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
    this.openHardwareModal(this.hardwareModalSubnet);
  }

  private applyHardwareFilter(): void {
    const subnet = this.hardwareModalSubnet;
    const all = this.hardwareCache ?? [];
    if (!subnet) {
      this.hardwareModalRows = [];
      return;
    }
    const filtered = all.filter((h) => ipv4MatchesSubnet(h?.ipAddr, subnet));
    this.hardwareModalRows = filtered.map((h) => ({
      id: h.id,
      name: h.name ?? '',
      ipAddr: h.ipAddr ?? '',
      osName: h.osName ?? '',
      type: h.type ?? '',
      userid: h.userid ?? '',
      lastcome: h.lastCome ?? h.lastcome ?? null
    }));
    // Orden por IP ascendente para una lectura natural.
    this.hardwareModalRows.sort((a, b) => this.compareIpv4(a.ipAddr, b.ipAddr));
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
      [r.name, r.ipAddr, r.osName, r.type, r.userid]
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
    this.tourCleanup?.();
    this.tourCleanup = undefined;
    this.cancelHardwareModalRepaint();
    if (this.resizeDebounceId) clearTimeout(this.resizeDebounceId);
    if (this.markersRefreshId) clearTimeout(this.markersRefreshId);
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