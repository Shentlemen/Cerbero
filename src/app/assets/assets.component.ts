import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { RouterModule } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { BiosService } from '../services/bios.service';
import { forkJoin } from 'rxjs';
import { SoftwareService } from '../services/software.service';
import { ActivosService } from '../services/activos.service';
import { PermissionsService } from '../services/permissions.service';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { EstadoEquipoService } from '../services/estado-equipo.service';
import { AuthService } from '../services/auth.service';
import { TransferirEquipoModalComponent } from '../components/transferir-equipo-modal/transferir-equipo-modal.component';
import { catchError, of } from 'rxjs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GuidedTourHostService } from '../services/guided-tour-host.service';
import { TourRegistryService } from '../services/tour-registry.service';
import type { DriveStep } from 'driver.js';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule, NgbModule, NotificationContainerComponent],
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AssetsComponent implements OnInit, OnDestroy {

  assetsList: any[] = [];
  assetsFiltrados: any[] = [];
  activosMap: Map<string, any> = new Map(); // Ahora la clave es el nombre del PC
  filterForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 20;
  collectionSize = 0;
  loading: boolean = true; // Agregar propiedad loading
  private tourCleanup?: () => void;

  totalAssets: number = 0; // Declaración de la propiedad
  pcCount: number = 0;     // Declaración de la propiedad
  laptopCount: number = 0; // Declaración de la propiedad
  otherCount: number = 0;  // Declaración de la propiedad
  miniPcCount: number = 0; // Añadir esta nueva propiedad
  towerCount: number = 0;  // Nueva propiedad para Tower
  lowProfileCount: number = 0; // Contador para Low Profile Desktop
  miniTowerCount: number = 0;  // Contador para Mini Tower
  desconocidoCount: number = 0; // Contador para Desconocido
  currentFilter: string = '';
  originalAssetsList: any[] = []; // Para guardar la lista original
  deletingAssetId: number | null = null; // Para controlar el estado de eliminación
  showConfirmDialog: boolean = false; // Para controlar el diálogo de confirmación
  assetToDelete: any = null; // Para almacenar el asset a eliminar

  transferiendoAssetId: number | null = null;

  // Control para el filtro de nombre
  nombreEquipoControl = new FormControl('');

  /** Lista completa activa (sin filtros avanzados) para poder restaurar */
  private allAssetsCache: any[] = [];
  private biosMapCache = new Map<number, any>();
  showAdvancedFilters = false;
  advancedFiltersApplied = false;
  applyingAdvancedFilters = false;
  advancedFilterForm: FormGroup;

  constructor(
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private softwareService: SoftwareService,
    private activosService: ActivosService,
    private fb: FormBuilder,
    private router: Router,
    public route: ActivatedRoute,
    private permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private estadoEquipoService: EstadoEquipoService,
    private authService: AuthService,
    private modalService: NgbModal,
    private guidedTourHost: GuidedTourHostService,
    private tourRegistry: TourRegistryService
  ) {
    this.filterForm = this.fb.group({
      name: [''],
      osName: [''],
      ipAddr: [''],
      biosType: [''],
      smanufacturer: ['']
    });

    this.advancedFilterForm = this.fb.group({
      diskType: [''],
      osName: [''],
      processor: [''],
      minDiskUsagePercent: [null as number | null],
      ramGb: [null as number | null],
      ramOp: ['lt'],
      smanufacturer: [''],
      staleDays: [null as number | null]
    });

    // Suscribirse a cambios en el filtro de nombre
    this.nombreEquipoControl.valueChanges.subscribe(value => {
      this.aplicarFiltroNombre(value || '');
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const softwareId = params['softwareId'];
      const softwareName = params['softwareName'];
      const filterType = params['filterType'];
      const filterValue = params['filterValue'];

      if (softwareId) {
        this.loadAssetsForSoftware(softwareId);
      } else {
        this.loadAssets().then(() => {
          if (filterType && filterValue) {
            this.applyFilterFromParams(filterType, filterValue);
          }
        });
      }
    });

    // Registramos el tour en el helper-dog (menú radial). El closure mantiene
    // acceso a `this.pagedAssets` / `this.router` para el paso final.
    this.tourCleanup = this.tourRegistry.register('assets', [
      {
        id: 'terminales-overview',
        title: 'Tour de inventario',
        icon: 'fa-route',
        description: 'Recorrido general de la pantalla de terminales.',
        buildSteps: () => this.buildTourTerminales(),
        // Al cerrar/finalizar el tour la pantalla suele quedar scrolleada
        // sobre la tabla o el botón de PDF; la volvemos al inicio para que
        // la próxima interacción del usuario arranque desde arriba.
        afterEnd: () => this.resetScrollToTop(),
      },
      {
        id: 'terminales-detalle',
        title: 'Cómo entrar al detalle de un equipo',
        icon: 'fa-microchip',
        description: 'Abre la ficha del primer activo y recorre sus pestañas.',
        run: () => this.runTourDetalleEquipo(),
      },
    ]);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
  }

  private applyFilterFromParams(filterType: string, filterValue: string): void {
    switch (filterType) {
      case 'type':
        // Normalizar el valor del filtro para que coincida con los tipos esperados
        const normalizedValue = this.normalizeTypeFilter(filterValue);
        this.filterByType(normalizedValue);
        break;
      case 'marca':
        this.assetsFiltrados = this.originalAssetsList.filter(asset => 
          asset.smanufacturer?.toUpperCase() === filterValue.toUpperCase()
        );
        this.actualizarPaginacion();
        break;
      case 'osName':
        this.assetsFiltrados = this.originalAssetsList.filter(asset => 
          asset.osName?.toUpperCase() === filterValue.toUpperCase()
        );
        this.actualizarPaginacion();
        break;
    }
  }

  // Método para aplicar búsqueda rápida (nombre de equipo, IP y último usuario conectado)
  private aplicarFiltroNombre(termino: string): void {
    const t = (termino || '').trim().toLowerCase();
    if (!t) {
      this.aplicarFiltroTipoActual();
    } else {
      const assetsPorTipo = this.obtenerAssetsPorTipoActual();
      this.assetsFiltrados = assetsPorTipo.filter(asset => {
        const name = (asset.name || '').toLowerCase();
        const ip = (asset.ipAddr || '').toLowerCase();
        // `userid` en la tabla hardware (OCS) guarda el último usuario logueado al equipo.
        // Suele venir como "DOMINIO\usuario", así que comparamos sobre todo el string.
        const usuario = (asset.userid || '').toLowerCase();
        return name.includes(t) || ip.includes(t) || usuario.includes(t);
      });
      this.actualizarPaginacion();
    }
  }

  // Método para obtener assets según el filtro de tipo actual
  private obtenerAssetsPorTipoActual(): any[] {
    if (this.currentFilter === '') {
      return [...this.originalAssetsList];
    } else if (this.currentFilter === 'LAPTOP') {
      return this.originalAssetsList.filter(asset => {
        const assetType = (asset.biosType || '').trim().toUpperCase();
        return assetType === 'LAPTOP' || assetType === 'NOTEBOOK';
      });
    } else if (this.currentFilter === 'DESCONOCIDO') {
      return this.originalAssetsList.filter(asset => {
        const assetType = (asset.biosType || '').trim().toUpperCase();
        return assetType === 'DESCONOCIDO' || assetType === '';
      });
    } else {
      return this.originalAssetsList.filter(asset => 
        (asset.biosType || '').trim().toUpperCase() === this.currentFilter.trim().toUpperCase()
      );
    }
  }

  // Método para aplicar el filtro de tipo actual
  private aplicarFiltroTipoActual(): void {
    this.assetsFiltrados = this.obtenerAssetsPorTipoActual();
    this.actualizarPaginacion();
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  get advancedFiltersActiveCount(): number {
    const f = this.advancedFilterForm?.value;
    if (!f) return 0;
    let n = 0;
    if (f.diskType) n++;
    if ((f.osName || '').trim()) n++;
    if ((f.processor || '').trim()) n++;
    if (f.minDiskUsagePercent != null && f.minDiskUsagePercent !== '' && !Number.isNaN(Number(f.minDiskUsagePercent))) n++;
    if (f.ramGb != null && f.ramGb !== '' && !Number.isNaN(Number(f.ramGb)) && f.ramOp) n++;
    if ((f.smanufacturer || '').trim()) n++;
    if (f.staleDays != null && f.staleDays !== '' && !Number.isNaN(Number(f.staleDays))) n++;
    return n;
  }

  private buildAdvancedSearchParams(): {
    diskType?: string;
    osName?: string;
    processor?: string;
    minDiskUsagePercent?: number;
    ramGb?: number;
    ramOp?: string;
    smanufacturer?: string;
    staleDays?: number;
  } | null {
    const f = this.advancedFilterForm.value;
    const params: any = {};
    if (f.diskType) params.diskType = f.diskType;
    if ((f.osName || '').trim()) params.osName = f.osName.trim();
    if ((f.processor || '').trim()) params.processor = f.processor.trim();
    if (f.minDiskUsagePercent != null && f.minDiskUsagePercent !== '' && !Number.isNaN(Number(f.minDiskUsagePercent))) {
      params.minDiskUsagePercent = Number(f.minDiskUsagePercent);
    }
    if (f.ramGb != null && f.ramGb !== '' && !Number.isNaN(Number(f.ramGb)) && f.ramOp) {
      params.ramGb = Number(f.ramGb);
      params.ramOp = f.ramOp;
    }
    if ((f.smanufacturer || '').trim()) params.smanufacturer = f.smanufacturer.trim();
    if (f.staleDays != null && f.staleDays !== '' && !Number.isNaN(Number(f.staleDays))) {
      params.staleDays = Number(f.staleDays);
    }
    return Object.keys(params).length ? params : null;
  }

  aplicarFiltrosAvanzados(): void {
    const params = this.buildAdvancedSearchParams();
    if (!params) {
      this.limpiarFiltrosAvanzados();
      return;
    }

    this.applyingAdvancedFilters = true;
    this.hardwareService.advancedSearch(params).subscribe({
      next: (hardwareList) => {
        const allowedIds = new Set(this.allAssetsCache.map(a => a.id));
        const list = Array.isArray(hardwareList) ? hardwareList : [];
        this.assetsList = list
          .filter(h => allowedIds.has(h.id))
          .map(h => {
            const bios = this.biosMapCache.get(h.id);
            return {
              ...h,
              biosType: (bios?.type || 'DESCONOCIDO').trim().toUpperCase(),
              smanufacturer: bios?.smanufacturer || 'DESCONOCIDO'
            };
          });
        this.originalAssetsList = this.assetsList;
        this.advancedFiltersApplied = true;
        this.updateSummary();
        this.aplicarFiltroNombre(this.nombreEquipoControl.value || '');
        this.applyingAdvancedFilters = false;
        this.notificationService.showSuccessMessage(
          `Filtros avanzados: ${this.assetsList.length} equipo(s)`
        );
      },
      error: (error) => {
        console.error('Error en filtros avanzados', error);
        this.applyingAdvancedFilters = false;
        this.notificationService.showError(
          'No se pudieron aplicar los filtros avanzados',
          error?.message ?? 'Error desconocido'
        );
      }
    });
  }

  onAdvancedFiltersEnter(event: Event): void {
    const target = event.target as HTMLElement | null;
    // No disparar desde botones (Aplicar/Limpiar ya tienen su acción)
    if (target?.tagName === 'BUTTON') {
      return;
    }
    event.preventDefault();
    if (this.applyingAdvancedFilters || this.advancedFiltersActiveCount === 0) {
      return;
    }
    this.aplicarFiltrosAvanzados();
  }

  limpiarFiltrosAvanzados(): void {
    this.advancedFilterForm.reset({
      diskType: '',
      osName: '',
      processor: '',
      minDiskUsagePercent: null,
      ramGb: null,
      ramOp: 'lt',
      smanufacturer: '',
      staleDays: null
    });
    this.advancedFiltersApplied = false;
    this.assetsList = [...this.allAssetsCache];
    this.originalAssetsList = this.assetsList;
    this.updateSummary();
    this.aplicarFiltroNombre(this.nombreEquipoControl.value || '');
  }

  private describeAdvancedFiltersForPdf(): string {
    const f = this.advancedFilterForm.value;
    const parts: string[] = [];
    if (f.diskType) parts.push(`Disco ${f.diskType}`);
    if ((f.osName || '').trim()) parts.push(`SO: ${f.osName.trim()}`);
    if ((f.processor || '').trim()) parts.push(`CPU: ${f.processor.trim()}`);
    if (f.minDiskUsagePercent != null && f.minDiskUsagePercent !== '') {
      parts.push(`Disco ≥ ${f.minDiskUsagePercent}%`);
    }
    if (f.ramGb != null && f.ramGb !== '' && f.ramOp) {
      const opLabel = (f.ramOp === 'gt' || f.ramOp === '>') ? '>' : '<';
      parts.push(`RAM ${opLabel} ${f.ramGb} GB`);
    }
    if ((f.smanufacturer || '').trim()) parts.push(`Marca: ${f.smanufacturer.trim()}`);
    if (f.staleDays != null && f.staleDays !== '') {
      parts.push(`Sin reportar ≥ ${f.staleDays} días`);
    }
    return parts.join(' · ');
  }

  // Método para actualizar la paginación
  private actualizarPaginacion(): void {
    this.collectionSize = this.assetsFiltrados.length;
    // Resetear a la página 1 cuando se filtran los resultados
    this.page = 1;
  }

  loadAssets(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loading = true; // Activar loading
      
      forkJoin([
        this.hardwareService.getActiveHardware().pipe(
          catchError(error => {
            console.warn('⚠️ Error al obtener hardware, usando array vacío:', error);
            return of([]); // Devolver array vacío si falla
          })
        ),
        this.biosService.getAllBios().pipe(
          catchError(error => {
            console.warn('⚠️ Error al obtener BIOS, usando array vacío:', error);
            return of([]); // Devolver array vacío si falla
          })
        )
      ]).subscribe({
        next: ([hardwareList, biosList]) => {
          // Manejar el caso donde alguno de los servicios devuelve array vacío
          if (!Array.isArray(hardwareList)) {
            console.warn('⚠️ Hardware no es un array, convirtiendo...');
            hardwareList = [];
          }
          
          if (!Array.isArray(biosList)) {
            console.warn('⚠️ BIOS no es un array, convirtiendo...');
            biosList = [];
          }
          
          const biosMap = new Map(biosList.map(b => [b.hardwareId, b]));
          this.biosMapCache = biosMap;
          
          this.assetsList = hardwareList.map(h => ({
            ...h,
            biosType: (biosMap.get(h.id)?.type || 'DESCONOCIDO').trim().toUpperCase(),
            smanufacturer: biosMap.get(h.id)?.smanufacturer || 'DESCONOCIDO'
          }));
          
          this.allAssetsCache = [...this.assetsList];
          this.advancedFiltersApplied = false;
          this.originalAssetsList = this.assetsList;
          this.assetsFiltrados = [...this.originalAssetsList];
          this.actualizarPaginacion();
          this.updateSummary();
          this.cargarActivosInfo();
          this.loading = false; // Desactivar loading
          resolve();
        },
        error: (error) => {
          console.error('❌ Error crítico al cargar los assets:', error);
          // Intentar mostrar al menos algunos datos si es posible
          this.assetsList = [];
          this.allAssetsCache = [];
          this.originalAssetsList = [];
          this.assetsFiltrados = [];
          this.updateSummary();
          this.loading = false; // Desactivar loading en caso de error
          reject(error);
        }
      });
    });
  }

  cargarActivosInfo(): void {
    this.activosService.getActivos().pipe(
      catchError(() => of([]))
    ).subscribe({
      next: (activos) => {
        this.activosMap.clear();
        for (const activo of activos) {
          if (activo?.name) {
            this.activosMap.set(activo.name, activo);
          }
        }
      },
      error: (error) => {
        console.error('Error al cargar activos:', error);
      }
    });
  }

  loadAssetsForSoftware(softwareId: number): void {
    this.loading = true; // Activar loading
    this.softwareService.getHardwaresBySoftware({ idSoftware: softwareId }).subscribe({
      next: (hardwareIds) => {
        forkJoin([
          this.hardwareService.getActiveHardware(),
          this.biosService.getAllBios()
        ]).subscribe({
          next: ([hardwareList, biosList]) => {
            const biosMap = new Map(biosList.map(b => [b.hardwareId, b]));
            this.biosMapCache = biosMap;
            
            // Filtrar la lista de hardware por los IDs obtenidos
            this.assetsList = hardwareList
              .filter(h => hardwareIds.includes(h.id))
              .map(h => ({
                ...h,
                biosType: (biosMap.get(h.id)?.type || 'DESCONOCIDO').trim().toUpperCase(),
                smanufacturer: biosMap.get(h.id)?.smanufacturer || 'DESCONOCIDO'
              }));
            
            this.allAssetsCache = [...this.assetsList];
            this.advancedFiltersApplied = false;
            this.originalAssetsList = this.assetsList;
            this.assetsFiltrados = [...this.originalAssetsList];
            this.actualizarPaginacion();
            this.updateSummary();
            this.cargarActivosInfo();
            this.loading = false; // Desactivar loading
          },
          error: (error) => {
            console.error('Error al cargar los assets:', error);
            this.loading = false; // Desactivar loading en caso de error
          }
        });
      },
      error: (error) => {
        console.error('Error al obtener hardware IDs:', error);
        this.loading = false; // Desactivar loading en caso de error
        this.loadAssets();
      }
    });
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
    console.log('Aplicando filtros:', filtros);

    forkJoin({
      hardware: this.hardwareService.getActiveHardware(),
      bios: this.biosService.getAllBios()
    }).subscribe(
      ({ hardware, bios }) => {
        // Crear un mapa de BIOS por hardwareId
        const biosMap = new Map(bios.map(b => [b.hardwareId, b]));
        
        // Combinar datos de hardware con BIOS
        let filteredAssets = hardware.map(h => {
          const biosData = biosMap.get(h.id);
          return {
            ...h,
            biosType: biosData?.type || 'DESCONOCIDO',
            smanufacturer: biosData?.smanufacturer || 'DESCONOCIDO'
          };
        });

        // Aplicar filtros
        filteredAssets = filteredAssets.filter(asset => {
          let cumpleFiltros = true;

          if (filtros.name && asset.name) {
            cumpleFiltros = cumpleFiltros && 
              asset.name.toLowerCase().includes(filtros.name.toLowerCase());
          }

          if (filtros.osName && asset.osName) {
            cumpleFiltros = cumpleFiltros && 
              asset.osName.toLowerCase().includes(filtros.osName.toLowerCase());
          }

          if (filtros.ipAddr && asset.ipAddr) {
            cumpleFiltros = cumpleFiltros && 
              asset.ipAddr.toLowerCase().includes(filtros.ipAddr.toLowerCase());
          }

          if (filtros.biosType && asset.biosType) {
            cumpleFiltros = cumpleFiltros && 
              asset.biosType.toLowerCase().includes(filtros.biosType.toLowerCase());
          }

          if (filtros.smanufacturer && asset.smanufacturer) {
            cumpleFiltros = cumpleFiltros && 
              asset.smanufacturer.toLowerCase().includes(filtros.smanufacturer.toLowerCase());
          }

          return cumpleFiltros;
        });

        this.assetsFiltrados = filteredAssets;
        this.actualizarPaginacion();
        
        console.log('Assets filtrados:', this.assetsFiltrados);
      },
      (error) => {
        console.error('Error al aplicar filtros', error);
      }
    );
  }

  updateSummary(): void {
    // Inicializa los contadores
    let totalAssets = 0;
    let pcCount = 0;
    let miniPcCount = 0;
    let laptopCount = 0;
    let otherCount = 0;
    let towerCount = 0;
    let lowProfileCount = 0;
    let miniTowerCount = 0;
    let desconocidoCount = 0;

    // Recorre la lista original de assets y cuenta los tipos (no la filtrada)
    this.assetsList.forEach(asset => {
      totalAssets++;
      const type = (asset.biosType || '').toUpperCase();

      switch (type) {
        case 'DESKTOP':
          pcCount++;
          break;
        case 'MINI PC':
          miniPcCount++;
          break;
        case 'LAPTOP':
        case 'NOTEBOOK':
          laptopCount++;
          break;
        case 'TOWER':
          towerCount++;
          break;
        case 'LOW PROFILE DESKTOP':
          lowProfileCount++;
          break;
        case 'MINI TOWER':
          miniTowerCount++;
          break;
        case 'DESCONOCIDO':
          desconocidoCount++;
          break;
        default:
          otherCount++;
          break;
      }
    });

    // Actualiza las variables del resumen
    this.totalAssets = totalAssets;
    this.pcCount = pcCount;
    this.miniPcCount = miniPcCount;
    this.laptopCount = laptopCount;
    this.otherCount = otherCount;
    this.towerCount = towerCount;
    this.lowProfileCount = lowProfileCount;
    this.miniTowerCount = miniTowerCount;
    this.desconocidoCount = desconocidoCount;

    // console.log('Resumen actualizado:', {
    //   totalAssets,
    //   pcCount,
    //   miniPcCount,
    //   laptopCount,
    //   otherCount,
    //   towerCount,
    //   lowProfileCount,
    //   miniTowerCount,
    //   desconocidoCount
    // });
  }

  get pagedAssets(): any[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.assetsFiltrados.slice(startItem, endItem);
  }

  verDetallesAsset(asset: any): void {
    if (asset && asset.id) {
      this.router.navigate(['/menu/asset-details', asset.id]);
    } else {
      console.error('Asset ID is undefined or null', asset);
      // Optionally, you can show an error message to the user
    }
  }

  verDetallesActivo(name: string): void {
    const activo = this.activosMap.get(name);
    if (activo) {
      this.router.navigate(['/menu/procurement/activos', activo.idActivo]);
    }
  }

  getNumeroCompra(name: string): string {
    const activo = this.activosMap.get(name);
    return activo && activo.numeroCompra ? activo.numeroCompra : 'No asignado';
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.assetsFiltrados.sort((a, b) => {
      let valueA = a[column];
      let valueB = b[column];

      // Manejar valores nulos o undefined
      if (valueA === null || valueA === undefined) valueA = '';
      if (valueB === null || valueB === undefined) valueB = '';

      // Manejo especial para IPs
      if (column === 'ipAddr') {
        // Convertir IPs a números para comparación
        const ipToNum = (ip: string) => {
          if (!ip) return 0;
          const parts = ip.split('.');
          return parts.reduce((sum, part) => sum * 256 + parseInt(part, 10), 0);
        };
        valueA = ipToNum(valueA);
        valueB = ipToNum(valueB);
      } else {
        // Para otros campos, convertir a minúsculas si son strings
        if (typeof valueA === 'string') valueA = valueA.toLowerCase();
        if (typeof valueB === 'string') valueB = valueB.toLowerCase();
      }

      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  filterByType(type: string): void {
    this.currentFilter = type;
    // Limpiar el filtro de nombre cuando se cambia el tipo
    this.nombreEquipoControl.setValue('');
    this.aplicarFiltroTipoActual();
  }



  canManageAssets(): boolean {
    return this.permissionsService.canManageAssets();
  }

  // Verificar si el usuario puede gestionar estados de equipos
  canManageAssetStates(): boolean {
    // GM, Admin, Almacén, Inventario y Gestión de Equipos
    return this.permissionsService.canManageEquipmentStates() || this.permissionsService.isInventario();
  }

  canDeleteAssets(): boolean {
    return this.permissionsService.canDeleteAssets();
  }

  // Método de utilidad para debugging - obtener información del usuario actual
  getCurrentUserInfo(): string {
    const isGM = this.permissionsService.isGM();
    const isAdmin = this.permissionsService.isAdmin();
    const isUser = this.permissionsService.isUser();
    
    if (isGM) return 'GM';
    if (isAdmin) return 'Administrador';
    if (isUser) return 'Usuario';
    return 'Sin rol definido';
  }

  eliminarAsset(asset: any): void {
    this.assetToDelete = asset;
    this.showConfirmDialog = true;
  }

  private procesarEliminacion(asset: any): void {
    this.deletingAssetId = asset.id;

    this.hardwareService.deleteHardwareComplete(asset.id).subscribe({
      next: (response) => {
        if (response.success) {
          // Eliminar el asset de las listas locales
          this.assetsList = this.assetsList.filter(a => a.id !== asset.id);
          this.originalAssetsList = this.originalAssetsList.filter(a => a.id !== asset.id);
          this.assetsFiltrados = this.assetsFiltrados.filter(a => a.id !== asset.id);
          
          // Actualizar contadores y paginación
          this.updateSummary();
          this.actualizarPaginacion();
          
          // Mostrar mensaje de éxito usando el sistema de notificaciones
          this.notificationService.showSuccessMessage(
            `Equipo "${asset.name}" eliminado exitosamente. Se eliminaron todos los datos relacionados de la base de datos.`
          );
        } else {
          throw new Error(response.message || 'Error al eliminar el equipo');
        }
      },
      error: (error) => {
        console.error('Error al eliminar asset:', error);
        this.notificationService.showError(
          'Error al eliminar equipo',
          `No se pudo eliminar el equipo "${asset.name}": ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        this.deletingAssetId = null;
      }
    });
  }

  // Métodos para el diálogo de confirmación
  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.assetToDelete = null;
  }

  confirmarEliminacion(): void {
    if (this.assetToDelete) {
      this.procesarEliminacion(this.assetToDelete);
      this.showConfirmDialog = false;
      this.assetToDelete = null;
    }
  }

  private normalizeTypeFilter(filterValue: string): string {
    // Normalizar el valor del filtro para que coincida con los tipos esperados
    const normalizedValue = filterValue.trim().toUpperCase();
    
    // Mapeo de valores que pueden venir del dashboard a los valores esperados
    switch (normalizedValue) {
      case 'DESKTOP':
      case 'PC':
        return 'DESKTOP';
      case 'MINI PC':
      case 'MINI-PC':
        return 'MINI PC';
      case 'LAPTOP':
      case 'NOTEBOOK':
        return 'LAPTOP';
      case 'TOWER':
        return 'TOWER';
      case 'LOW PROFILE DESKTOP':
      case 'LOW PROFILE':
        return 'LOW PROFILE DESKTOP';
      case 'MINI TOWER':
        return 'MINI TOWER';
      case 'DESCONOCIDO':
        return 'DESCONOCIDO';
      default:
        // Si no coincide con ningún tipo conocido, intentar filtrar por el valor exacto
        return normalizedValue;
    }
  }

  // Método para transferir equipo
  transferirEquipo(asset: any): void {
    const modalRef = this.modalService.open(TransferirEquipoModalComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static'
    });
    modalRef.componentInstance.item = {
      ...asset,
      tipo: 'EQUIPO',
      name: asset.name
    };

    modalRef.result.then((transferData: any) => {
      if (transferData) {
        this.procesarTransferencia(asset, transferData);
      }
    }).catch(() => {
      // Usuario canceló el modal
    });
  }

  private procesarTransferencia(asset: any, transferData: any): void {
    this.transferiendoAssetId = asset.id;

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

    this.estadoEquipoService.transferirEquipo(asset.id, requestData).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadAssets();
          this.notificationService.showSuccessMessage(
            `Equipo "${asset.name}" transferido exitosamente.`
          );
        } else {
          throw new Error(response.message || 'Error al transferir el equipo');
        }
      },
      error: (error) => {
        console.error('Error al transferir equipo:', error);
        this.notificationService.showError(
          'Error al transferir equipo',
          `No se pudo transferir el equipo "${asset.name}": ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        this.transferiendoAssetId = null;
      }
    });
  }

  // Método para exportar la lista filtrada a PDF
  exportarPDF(): void {
    if (this.assetsFiltrados.length === 0) {
      this.notificationService.showError(
        'No hay datos para exportar',
        'No hay terminales filtradas para exportar a PDF.'
      );
      return;
    }

    const doc = new jsPDF('landscape'); // Orientación horizontal para más espacio
    
    // Título del documento
    doc.setFontSize(18);
    doc.text('Inventario de Terminales', 14, 20);
    
    // Información del filtro aplicado
    doc.setFontSize(10);
    let filtroTexto = 'Todos los terminales';
    if (this.currentFilter) {
      filtroTexto = `Filtro: ${this.currentFilter}`;
    }
    if (this.nombreEquipoControl.value) {
      filtroTexto += ' | Búsqueda activa (nombre/IP/usuario)';
    }
    doc.text(filtroTexto, 14, 28);

    let yInfo = 34;
    if (this.advancedFiltersApplied) {
      const adv = this.describeAdvancedFiltersForPdf();
      if (adv) {
        const advLine = `Avanzados: ${adv}`;
        const wrapped = doc.splitTextToSize(advLine, 260);
        doc.text(wrapped, 14, yInfo);
        yInfo += 6 * (Array.isArray(wrapped) ? wrapped.length : 1);
      }
    }
    
    // Fecha de generación
    const fecha = new Date().toLocaleString('es-ES');
    doc.text(`Generado el: ${fecha}`, 14, yInfo);
    yInfo += 6;
    doc.text(`Total de terminales: ${this.assetsFiltrados.length}`, 14, yInfo);
    yInfo += 6;
    
    // Preparar datos para la tabla
    const tableData = this.assetsFiltrados.map(asset => [
      asset.name || 'N/A',
      asset.osName || 'Desconocido',
      asset.ipAddr || 'No asignada',
      asset.biosType || 'Desconocido',
      this.getNumeroCompra(asset.name)
    ]);
    
    // Crear la tabla
    autoTable(doc, {
      head: [['Equipo', 'Sistema Operativo', 'IP', 'Tipo', 'Nro. Compra']],
      body: tableData,
      startY: yInfo,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: yInfo, left: 14, right: 14 },
      tableWidth: 'auto'
    });
    
    // Guardar el PDF
    const nombreArchivo = `terminales_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(nombreArchivo);
    
    this.notificationService.showSuccessMessage(
      `PDF exportado exitosamente: ${nombreArchivo}`
    );
  }

  /**
   * Arma los pasos del tour de Inventario de Terminales.
   * Se invoca desde el `TourRegistryService` cuando el usuario elige el tour
   * en el menú radial del helper-dog.
   */
  private buildTourTerminales(): DriveStep[] {
    const steps: DriveStep[] = [];

    // Abrir panel para que el paso del tour tenga contexto visible
    this.showAdvancedFilters = true;

    steps.push(
      ...this.guidedTourHost.buildSteps([
        { selector: '#tour-assets-title', title: 'Inventario de terminales', description: 'Listado de equipos detectados por inventario (OCS). Desde acá accedés al detalle de cada terminal.', side: 'bottom' },
        { selector: '#tour-assets-filters', title: 'Filtros por tipo', description: 'Pestañas para acotar la lista por forma factor: desktop, laptop, mini PC, etc.', side: 'bottom' },
        { selector: '#tour-assets-search', title: 'Búsqueda', description: 'Filtrá por nombre de equipo, dirección IP o último usuario conectado (campo USERID de OCS).', side: 'bottom' },
        { selector: '#tour-assets-advanced', title: 'Filtros avanzados', description: 'Abrí el panel para buscar por tipo de disco (HDD/SSD), SO, procesador, uso de disco ≥ %, RAM, fabricante o equipos sin reportar. Se combina con los chips y la búsqueda rápida.', side: 'bottom' },
        { selector: '#tour-assets-print', title: 'Exportar PDF', description: 'Generá un PDF con el listado filtrado actual, incluyendo los filtros avanzados activos.', side: 'left' }
      ])
    );

    if (document.querySelector('#tour-assets-actions')) {
      steps.push({
        element: '#tour-assets-actions',
        popover: {
          title: 'Acciones rápidas del equipo',
          description:
            'Transferir mueve el equipo al almacén que elijas, incluido laboratorio o cementerio (baja).',
          side: 'left',
          align: 'start'
        }
      });
    }

    if (document.querySelector('#tour-assets-table')) {
      steps.push({
        element: '#tour-assets-table',
        popover: {
          title: 'Tabla de equipos',
          description: 'Cada fila es un terminal. Para recorrer la ficha de detalle, elegí «Cómo entrar al detalle de un equipo» en el menú del perro.',
          side: 'top',
          align: 'start'
        }
      });
    }

    return steps;
  }

  private runTourDetalleEquipo(): void {
    const firstAsset = this.pagedAssets[0] || this.assetsFiltrados[0];
    if (!firstAsset?.id) {
      this.notificationService.showInfo(
        'Detalle de equipo',
        'No hay equipos disponibles para abrir el detalle. Ajustá los filtros e intentá de nuevo.'
      );
      return;
    }
    sessionStorage.setItem('cerbero:start-asset-details-tour', '1');
    sessionStorage.setItem('cerbero:return-to-assets-after-details-tour', '1');
    this.router.navigate(['/menu/asset-details', firstAsset.id]);
  }

  /**
   * Vuelve la pantalla al inicio cuando el tour finaliza.
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
}
