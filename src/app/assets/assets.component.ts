import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { RouterModule } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { BiosService } from '../services/bios.service';
import { forkJoin, from, mergeMap } from 'rxjs';
import { SoftwareService } from '../services/software.service';
import { ActivosService } from '../services/activos.service';
import { PermissionsService } from '../services/permissions.service';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule, NotificationContainerComponent],
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AssetsComponent implements OnInit {

  assetsList: any[] = [];
  assetsFiltrados: any[] = [];
  activosMap: Map<string, any> = new Map(); // Ahora la clave es el nombre del PC
  filterForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 11;
  collectionSize = 0;
  loading: boolean = true; // Agregar propiedad loading

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

  // Control para el filtro de nombre
  nombreEquipoControl = new FormControl('');

  constructor(
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private softwareService: SoftwareService,
    private activosService: ActivosService,
    private fb: FormBuilder,
    private router: Router,
    public route: ActivatedRoute,
    private permissionsService: PermissionsService,
    private notificationService: NotificationService
  ) {
    this.filterForm = this.fb.group({
      name: [''],
      osName: [''],
      ipAddr: [''],
      biosType: [''],
      smanufacturer: ['']
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

  // Método para aplicar filtro por nombre
  private aplicarFiltroNombre(nombre: string): void {
    if (!nombre.trim()) {
      // Si no hay filtro, mostrar todos los assets según el filtro de tipo actual
      this.aplicarFiltroTipoActual();
    } else {
      // Aplicar filtro de nombre sobre los assets filtrados por tipo
      const assetsPorTipo = this.obtenerAssetsPorTipoActual();
      this.assetsFiltrados = assetsPorTipo.filter(asset => 
        asset.name?.toLowerCase().includes(nombre.toLowerCase())
      );
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
        this.hardwareService.getHardware(),
        this.biosService.getAllBios()
      ]).subscribe({
        next: ([hardwareList, biosList]) => {
          const biosMap = new Map(biosList.map(b => [b.hardwareId, b]));
          
          this.assetsList = hardwareList.map(h => ({
            ...h,
            biosType: (biosMap.get(h.id)?.type || 'DESCONOCIDO').trim().toUpperCase(),
            smanufacturer: biosMap.get(h.id)?.smanufacturer || 'DESCONOCIDO'
          }));
          
          this.originalAssetsList = this.assetsList;
          this.assetsFiltrados = [...this.originalAssetsList];
          this.actualizarPaginacion();
          this.updateSummary();
          this.cargarActivosInfo();
          this.loading = false; // Desactivar loading
          resolve();
        },
        error: (error) => {
          console.error('Error al cargar los assets:', error);
          this.loading = false; // Desactivar loading en caso de error
          reject(error);
        }
      });
    });
  }

  cargarActivosInfo(): void {
    // Limitar a 5 peticiones simultáneas para evitar sobrecargar el servidor
    const CONCURRENT_REQUESTS = 5;
    
    // Crear un array de nombres de equipos
    const assetNames = this.assetsList.map(asset => asset.name);
    
    // Usar from y mergeMap para controlar la concurrencia
    from(assetNames).pipe(
      mergeMap(assetName => 
        this.activosService.getActivoByName(assetName).pipe(
          catchError(error => {
            // Retornar null en caso de error (equipos sin activos)
            return of(null);
          })
        ), 
        CONCURRENT_REQUESTS // Limitar a 5 peticiones simultáneas
      )
    ).subscribe({
      next: (activo) => {
        if (activo) {
          this.activosMap.set(activo.name, activo);
          // console.log(`Activo cargado para PC ${activo.name}:`, activo);
        }
      },
      error: (error) => {
        console.error('Error al cargar activos:', error);
      },
      complete: () => {
        // console.log(`Carga de activos completada. Total cargados: ${this.activosMap.size}`);
      }
    });
  }

  loadAssetsForSoftware(softwareId: number): void {
    this.loading = true; // Activar loading
    this.softwareService.getHardwaresBySoftware({ idSoftware: softwareId }).subscribe({
      next: (hardwareIds) => {
        forkJoin([
          this.hardwareService.getHardware(),
          this.biosService.getAllBios()
        ]).subscribe({
          next: ([hardwareList, biosList]) => {
            const biosMap = new Map(biosList.map(b => [b.hardwareId, b]));
            
            // Filtrar la lista de hardware por los IDs obtenidos
            this.assetsList = hardwareList
              .filter(h => hardwareIds.includes(h.id))
              .map(h => ({
                ...h,
                biosType: (biosMap.get(h.id)?.type || 'DESCONOCIDO').trim().toUpperCase()
              }));
            
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
      hardware: this.hardwareService.getHardware(),
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
}
