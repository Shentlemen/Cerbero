import { Component, OnDestroy, OnInit, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SubnetService,
  SubnetDTO,
  SubnetCoordinatesDTO,
  ipv4MatchesSubnet
} from '../services/subnet.service';
import { HardwareService } from '../services/hardware.service';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { forkJoin } from 'rxjs';
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
  private lines: L.Polyline[] = [];
  public sortColumn: string = '';
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

  private montevideoCenter = {
    lat: -34.9011,
    lng: -56.1645
  };
  private tourCleanup?: () => void;

  // Modal "Ver equipos de la subred"
  public hardwareModalOpen = false;
  public hardwareModalSubnet: ExtendedSubnet | null = null;
  public hardwareModalRows: SubnetHardwareRow[] = [];
  public hardwareModalLoading = false;
  public hardwareModalError: string | null = null;
  public hardwareModalSearch = '';
  /** Cache local para no recargar el listado completo en cada apertura. */
  private hardwareCache: any[] | null = null;

  constructor(
    private subnetService: SubnetService,
    private permissionsService: PermissionsService,
    private tourRegistry: TourRegistryService,
    private hardwareService: HardwareService
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
        { selector: '#tour-subnets-map', title: 'Mapa', description: 'Vista Leaflet con agregación de marcadores según coordenadas guardadas.', side: 'top' }
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
    // Tras aplicar altura responsive del contenedor, Leaflet debe recalcular tiles
    setTimeout(() => this.scheduleMapResize(), 150);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleMapResize();
  }

  /** Recalcula el tamaño del mapa cuando cambia el layout o el viewport. */
  private scheduleMapResize(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.map?.invalidateSize();
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
        
        // Configurar paginación
        this.collectionSize = this.subnets.length;
        this.page = 1;
        
        this.addMarkersToMap();
        this.loading = false;
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
    const q = this.normalizeForSearch(this.searchTerm);
    if (!q) {
      return this.subnets;
    }
    return this.subnets.filter((s) => {
      const fields = [s.name, s.id, s.netId, s.mask, s.tag];
      return fields.some((v) => this.normalizeForSearch(v).includes(q));
    });
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
    if (this.collectionSize !== filtered.length) {
      this.collectionSize = filtered.length;
    }
    const start = (this.page - 1) * this.pageSize;
    const end = this.page * this.pageSize;
    return filtered.slice(start, end);
  }

  /** Reset de la página actual al cambiar la búsqueda (evita quedar en una página inexistente). */
  onSearchChange(): void {
    this.page = 1;
    this.collectionSize = this.filteredSubnets.length;
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
        center: [this.montevideoCenter.lat, this.montevideoCenter.lng],
        zoom: 13
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      this.markerClusterGroup = L.markerClusterGroup();
      this.map.addLayer(this.markerClusterGroup);
      console.log('Mapa creado correctamente');
      this.scheduleMapResize();
    }
  }

  private addMarkersToMap(): void {
    if (!this.map || !this.markerClusterGroup) {
      console.error('Mapa o markerClusterGroup no inicializados');
      return;
    }

    // Limpiar marcadores y líneas existentes
    this.markerClusterGroup.clearLayers();
    this.lines.forEach(line => line.remove());
    this.lines = [];

    // Agregar marcadores solo para subredes con coordenadas
    const subnetsWithCoordinates = this.subnets.filter(subnet => 
      subnet.hasCoordinates && subnet.latitud && subnet.longitud
    );

    subnetsWithCoordinates.forEach(subnet => {
      const marker = L.marker([subnet.latitud!, subnet.longitud!])
        .bindPopup(`
          <b>${subnet.name}</b><br>
          Net ID: ${subnet.netId}
        `);
      this.markerClusterGroup?.addLayer(marker);
    });

    // Dibujar líneas entre subredes conectadas si lo deseas
    // (opcional, podrías querer remover las líneas si usas clusters)
    for (let i = 0; i < subnetsWithCoordinates.length - 1; i++) {
      const line = L.polyline([
        [subnetsWithCoordinates[i].latitud!, subnetsWithCoordinates[i].longitud!],
        [subnetsWithCoordinates[i + 1].latitud!, subnetsWithCoordinates[i + 1].longitud!]
      ], {
        color: '#85c1e9',
        weight: 2,
        opacity: 0.7
      }).addTo(this.map!);
      this.lines.push(line);
    }

    this.scheduleMapResize();
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

  /** Abre el modal y carga (o reusa) el listado de hardware para esta subred. */
  openHardwareModal(subnet: ExtendedSubnet): void {
    this.hardwareModalOpen = true;
    this.hardwareModalSubnet = subnet;
    this.hardwareModalError = null;
    this.hardwareModalSearch = '';
    this.hardwareModalRows = [];

    if (this.hardwareCache) {
      this.applyHardwareFilter();
      return;
    }

    this.hardwareModalLoading = true;
    this.hardwareService.getHardware().subscribe({
      next: (list) => {
        this.hardwareCache = Array.isArray(list) ? list : [];
        this.applyHardwareFilter();
        this.hardwareModalLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar hardware para subred:', err);
        this.hardwareModalError = 'No se pudo cargar el listado de equipos.';
        this.hardwareModalLoading = false;
      }
    });
  }

  closeHardwareModal(): void {
    this.hardwareModalOpen = false;
    this.hardwareModalSubnet = null;
    this.hardwareModalRows = [];
    this.hardwareModalError = null;
    this.hardwareModalSearch = '';
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
    }
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
  }
} 