import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, ViewChild, TemplateRef, inject, effect } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { BiosService } from '../services/bios.service';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { NgbPaginationModule, NgbModalModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { AlertService } from '../services/alert.service';
import { Alerta } from '../models/alerta.model';
import { finalize, catchError } from 'rxjs/operators';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { PermissionsService } from '../services/permissions.service';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { ConfigService } from '../services/config.service';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { EstadoDispositivoService } from '../services/estado-dispositivo.service';
import { MaintenanceService } from '../services/maintenance.service';
import { GuidedTourHostService } from '../services/guided-tour-host.service';
import { TourRegistryService } from '../services/tour-registry.service';
import { ThemeService } from '../services/theme.service';
import type { DriveStep } from 'driver.js';
import {
  ChartDatum,
  ChartLegendItem,
  NETWORK_COLORS,
  TERMINAL_COLORS,
  buildColumnChart,
  buildDoughnutChart,
  buildHorizontalBarChart,
  chartClickIndex,
  dashboardChartPlugins,
  doughnutLegendItems
} from './dashboard-charts';

declare var bootstrap: any;

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    BaseChartDirective,
    RouterModule,
    NgbPaginationModule,
    NgbModalModule,
    NotificationContainerComponent
  ],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('chartModal', { static: true }) chartModal!: TemplateRef<any>;
  @ViewChild('expandedChart') expandedChart?: BaseChartDirective;

  pieChartData: ChartData<'doughnut'> | undefined;
  pieChartOptions: ChartConfiguration<'doughnut'>['options'] | undefined;
  barChartData: ChartData<'bar'> | undefined;
  barChartOptions: ChartConfiguration<'bar'>['options'] | undefined;
  osChartData: ChartData<'bar'> | undefined;
  osChartOptions: ChartConfiguration<'bar'>['options'] | undefined;
  networkChartData: ChartData<'doughnut'> | undefined;
  networkChartOptions: ChartConfiguration<'doughnut'>['options'] | undefined;
  expandedChartData: ChartData | undefined;
  expandedChartOptions: ChartConfiguration['options'] | undefined;
  expandedChartType: ChartType = 'doughnut';
  private expandedFilterType: string | null = null;
  private expandedClickItems: ChartDatum[] = [];
  readonly chartPlugins = dashboardChartPlugins;
  private terminalesItems: ChartDatum[] = [];
  private fabricanteItems: ChartDatum[] = [];
  private osItems: ChartDatum[] = [];
  private redItems: ChartDatum[] = [];
  private redChartEmpty = false;
  alerts: Alerta[] = [];
  isChecking: boolean = false;
  isCleaning: boolean = false;
  isUpdatingDevices: boolean = false;
  page: number = 1;
  pageSize: number = 14;
  collectionSize: number = 0;
  currentFilter: string = 'all';
  filteredAlerts: Alerta[] = [];
  expandedChartTitle: string = '';
  expandedLegendItems: ChartLegendItem[] = [];
  private activeModalRef: any = null;
  private tourCleanup?: () => void;
  private readonly theme = inject(ThemeService);

  private typeMap: Record<string, string> = {
    '0': 'PC',
    '2': 'MINI PC',
    '3': 'LAPTOP',
    '4': 'TABLET'
  };

  constructor(
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private router: Router,
    private alertService: AlertService,
    private networkInfoService: NetworkInfoService,
    private permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private modalService: NgbModal,
    private configService: ConfigService,
    private http: HttpClient,
    private authService: AuthService,
    private estadoDispositivoService: EstadoDispositivoService,
    private maintenanceService: MaintenanceService,
    private guidedTourHost: GuidedTourHostService,
    private tourRegistry: TourRegistryService
  ) {
    effect(() => {
      this.theme.isDark();
      if (this.barChartOptions || this.osChartOptions) {
        this.buildCompactCharts();
        this.cdr.markForCheck();
      }
    });
  }

  ngOnInit(): void {
    this.registerDashboardTour();
    this.loadAlertas();
    forkJoin({
      hardware: this.hardwareService.getActiveHardware(),
      bios: this.biosService.getAllBios(),
      network: this.networkInfoService.getNetworkInfo(),
      macsInactivas: this.estadoDispositivoService.getMacsInactivas().pipe(
        catchError(error => {
          console.warn('⚠️ Error al obtener MACs inactivas, usando array vacío:', error);
          return of({ success: false, data: [] });
        })
      )
    }).subscribe(
      ({ hardware, bios, network, macsInactivas }) => {
        const biosMap = new Map(bios.map(b => [b.hardwareId, b]));
        
        // Filtrar BIOS para incluir solo los de hardware activo
        const hardwareIdsSet = new Set(hardware.map(h => h.id));
        const biosActivos = bios.filter(b => hardwareIdsSet.has(b.hardwareId));
        
        const typeData = this.prepareHardwareTypeData(hardware, biosMap);
        const brandData = this.prepareBrandData(biosActivos);
        const osData = this.prepareChartData(hardware, 'osName');

        // Procesar datos de red - filtrar dispositivos inactivos (en almacenes o cementerio)
        let networkData: NetworkInfoDTO[] = [];
        if (network && 'success' in network && network.success) {
          networkData = network.data || [];
          
          // Obtener MACs inactivas para filtrar
          const macsInactivasList = (macsInactivas?.success && Array.isArray(macsInactivas.data)) 
            ? macsInactivas.data 
            : [];
          const macsInactivasSet = new Set(macsInactivasList);
          
          // Filtrar dispositivos que NO están en almacenes o cementerio
          networkData = networkData.filter(device => !macsInactivasSet.has(device.mac));
          
        }

        this.terminalesItems = typeData;
        this.fabricanteItems = brandData;
        this.osItems = osData.map((d) => ({
          label: this.abbreviateOSName(d.label),
          originalLabel: d.label,
          y: d.y
        }));
        this.buildCompactCharts();
        this.prepareNetworkChart(networkData);
      },
      (error) => {
        console.error('Error al cargar los datos', error);
      }
    );
  }

  ngAfterViewInit() {
    // Inicializar todos los tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    Array.from(tooltipTriggerList).forEach(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
  }

  loadAlertas(): void {
    this.alertService.getAlertas().subscribe(
      (alertas: Alerta[]) => {
        this.alerts = alertas;
        this.applyCurrentFilter(); // Usar el método auxiliar
        this.page = 1;
      },
      error => {
        console.error('Error al cargar las alertas', error);
      }
    );
  }

  // Función auxiliar para recargar alertas manteniendo la página actual
  private reloadAlertasManteniendoPagina(currentPage: number): void {
    this.alertService.getAlertas().subscribe(
      (alertas: Alerta[]) => {
        this.alerts = alertas;
        
        // Aplicar el filtro actual a las nuevas alertas
        this.applyCurrentFilter();
        
        // Calcular la página correcta después de actualizar las alertas
        const totalPages = Math.ceil(this.collectionSize / this.pageSize);
        
        // Si la página actual es mayor que el total de páginas, ir a la última página
        if (currentPage > totalPages && totalPages > 0) {
          this.page = totalPages;
        } else {
          // Mantener la página actual si es válida
          this.page = currentPage;
        }
      },
      error => {
        console.error('Error al recargar las alertas', error);
        // En caso de error, mantener la página actual
        this.page = currentPage;
      }
    );
  }

  // Método auxiliar para aplicar el filtro actual
  private applyCurrentFilter(): void {
    if (this.currentFilter === 'all') {
      this.filteredAlerts = this.alerts;
    } else {
      this.filteredAlerts = this.alerts.filter(alert => {
        switch (this.currentFilter) {
          case 'new_hardware':
            return alert.new_hardware === 1;
          case 'memory':
            return alert.memory === true;
          case 'disk':
            return alert.disk === true;
          case 'ip':
            return alert.ip === true;
          case 'video':
            return alert.video === true;
          case 'monitor':
            return alert.monitor === true;
          case 'storage_hw':
            return alert.storageHw === true;
          case 'software_forbidden':
            return alert.softwareForbidden === true;
          default:
            return true;
        }
      });
    }
    
    this.collectionSize = this.filteredAlerts.length;
  }

  confirmarAlerta(alerta: Alerta): void {
    // Guardar la página actual antes de confirmar
    const currentPage = this.page;
    
    this.alertService.confirmarAlerta(alerta.id).subscribe({
      next: (response) => {
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage('Alerta confirmada exitosamente');
        
        // Recargar alertas y mantener la página actual
        this.reloadAlertasManteniendoPagina(currentPage);
      },
      error: (error) => {
        console.error('Error al confirmar alerta:', error);
        
        if (error.status === 404) {
          this.notificationService.showNotFoundError();
          // Recargar alertas para actualizar la lista
          this.reloadAlertasManteniendoPagina(currentPage);
        } else if (error.status === 409) {
          this.notificationService.showConflictError();
          // Recargar alertas para actualizar la lista
          this.reloadAlertasManteniendoPagina(currentPage);
        } else if (error.status === 400) {
          this.notificationService.showValidationError();
        } else if (error.status === 500) {
          // Verificar si es el error específico de alerta no encontrada
          if (error.error && error.error.error && error.error.error.includes('no encontrada')) {
            this.notificationService.showNotFoundError();
            // Recargar alertas para actualizar la lista
            this.reloadAlertasManteniendoPagina(currentPage);
          } else {
            this.notificationService.showServerError();
          }
        } else {
          this.notificationService.showError(
            'Error Inesperado',
            'Ocurrió un error inesperado al confirmar la alerta'
          );
        }
      }
    });
  }

  eliminarAlerta(alerta: Alerta): void {
    // Guardar la página actual antes de eliminar
    const currentPage = this.page;
    
    // Confirmar antes de eliminar
    if (!confirm(`¿Estás seguro de que deseas eliminar la alerta para ${alerta.pcName}?`)) {
      return;
    }
    
    this.alertService.eliminarAlerta(alerta.id).subscribe({
      next: (response) => {
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage('Alerta eliminada exitosamente');
        
        // Recargar alertas y mantener la página actual
        this.reloadAlertasManteniendoPagina(currentPage);
      },
      error: (error) => {
        console.error('Error al eliminar alerta:', error);
        
        if (error.status === 404) {
          this.notificationService.showError(
            'Alerta no encontrada',
            'La alerta ya fue eliminada o no existe'
          );
          // Recargar alertas para actualizar la lista
          this.reloadAlertasManteniendoPagina(currentPage);
        } else if (error.status === 500) {
          this.notificationService.showServerError();
        } else {
          this.notificationService.showError(
            'Error Inesperado',
            'Ocurrió un error inesperado al eliminar la alerta'
          );
        }
      }
    });
  }

  private prepareHardwareTypeData(hardware: any[], biosMap: Map<number, any>): any[] {
    // Verificar si hay tipos que contengan las palabras clave que buscamos
    const allTypes = new Set<string>();
    for (const [key, value] of biosMap.entries()) {
      if (value?.type) {
        allTypes.add(value.type.toUpperCase());
      }
    }
    
    const counts = hardware.reduce((acc: Record<string, number>, curr) => {
      const biosData = biosMap.get(curr.id);
      const originalType = biosData?.type || '';
      
      // Usar el tipo original sin normalización ya que llega correctamente del backend
      const type = originalType || 'DESCONOCIDO';
      

      
      if (!acc[type]) {
        acc[type] = 0;
      }
      acc[type]++;
      
      return acc;
    }, {});

    const result = Object.entries(counts).map(([label, y]) => ({ label, y }));
    return result;
  }

  private prepareChartData(array: any[], prop: string): any[] {
    const counts = this.countByProperty(array, prop);
    return Object.entries(counts).map(([label, y]) => ({ label, y }));
  }

  private prepareBrandData(biosData: any[]): any[] {
    const counts = this.countByProperty(biosData, 'smanufacturer');
    const allBrands = Object.entries(counts).map(([label, y]) => ({ 
      label: this.abbreviateManufacturerName(label), 
      y,
      originalLabel: label // Guardar el nombre original para tooltips
    }));
    
    // Ordenar por cantidad (descendente)
    allBrands.sort((a, b) => b.y - a.y);
    
    // Mostrar todos los fabricantes, pero configurar las etiquetas para mostrar solo algunos
    return allBrands;
  }

  private abbreviateManufacturerName(name: string): string {
    if (!name || name === 'Desconocido') return name;
    
    const nameUpper = name.toUpperCase().trim();
    
    // Mapeo de abreviaciones comunes para fabricantes
    const abbreviations: { [key: string]: string } = {
      'DELL INC.': 'DELL',
      'DELL INC': 'DELL',
      'DELL': 'DELL',
      'HEWLETT-PACKARD': 'HP',
      'HEWLETT PACKARD': 'HP',
      'HP INC.': 'HP',
      'HP INC': 'HP',
      'HP': 'HP',
      'LENOVO': 'LENOVO',
      'LENOVO GROUP LIMITED': 'LENOVO',
      'LENOVO GROUP LTD': 'LENOVO',
      'ASUSTEK COMPUTER INC.': 'ASUS',
      'ASUSTEK COMPUTER INC': 'ASUS',
      'ASUSTEK': 'ASUS',
      'ASUS': 'ASUS',
      'ACER INC.': 'ACER',
      'ACER INC': 'ACER',
      'ACER': 'ACER',
      'MICROSOFT CORPORATION': 'MSFT',
      'MICROSOFT CORP': 'MSFT',
      'MICROSOFT': 'MSFT',
      'APPLE INC.': 'APPLE',
      'APPLE INC': 'APPLE',
      'APPLE': 'APPLE',
      'SAMSUNG ELECTRONICS': 'SAMSUNG',
      'SAMSUNG': 'SAMSUNG',
      'TOSHIBA CORPORATION': 'TOSHIBA',
      'TOSHIBA CORP': 'TOSHIBA',
      'TOSHIBA': 'TOSHIBA',
      'FUJITSU LIMITED': 'FUJITSU',
      'FUJITSU LTD': 'FUJITSU',
      'FUJITSU': 'FUJITSU',
      'GIGABYTE TECHNOLOGY': 'GIGABYTE',
      'GIGABYTE TECH': 'GIGABYTE',
      'GIGABYTE': 'GIGABYTE',
      'MSI': 'MSI',
      'MICRO-STAR INTERNATIONAL': 'MSI',
      'ASROCK': 'ASROCK',
      'ASROCK INC.': 'ASROCK',
      'ASROCK INC': 'ASROCK',
      'INTEL CORPORATION': 'INTEL',
      'INTEL CORP': 'INTEL',
      'INTEL': 'INTEL',
      'AMD': 'AMD',
      'ADVANCED MICRO DEVICES': 'AMD',
      'NVIDIA CORPORATION': 'NVIDIA',
      'NVIDIA CORP': 'NVIDIA',
      'NVIDIA': 'NVIDIA',
      'REALTEK SEMICONDUCTOR': 'REALTEK',
      'REALTEK': 'REALTEK',
      'BROADCOM CORPORATION': 'BROADCOM',
      'BROADCOM CORP': 'BROADCOM',
      'BROADCOM': 'BROADCOM',
      'QUALCOMM': 'QUALCOMM',
      'QUALCOMM INCORPORATED': 'QUALCOMM',
      'MEDIATEK': 'MEDIATEK',
      'MEDIATEK INC.': 'MEDIATEK',
      'MEDIATEK INC': 'MEDIATEK'
    };
    
    // Buscar coincidencia exacta
    if (abbreviations[nameUpper]) {
      return abbreviations[nameUpper];
    }
    
    // Si no hay coincidencia exacta, intentar abreviar nombres largos
    if (name.length > 12) {
      // Para nombres muy largos, tomar las primeras letras de cada palabra
      const words = name.split(/\s+/);
      if (words.length > 1) {
        const abbreviation = words.map(word => word.charAt(0).toUpperCase()).join('');
        if (abbreviation.length <= 6) {
          return abbreviation;
        }
      }
      
      // Si no se puede abreviar por palabras, truncar
      return name.substring(0, 10) + '...';
    }
    
    return name;
  }

  private abbreviateOSName(name: string): string {
    if (!name || name === 'Desconocido') return name;
    
    const nameUpper = name.toUpperCase().trim();

    // Reglas específicas para mostrar la parte útil del nombre en poco espacio.
    // Objetivo: "Win 7", "Win 10", "Win XP", "Win Srv 2019", etc.
    if (nameUpper.includes('WINDOWS SERVER')) {
      const yearMatch = nameUpper.match(/(20\d{2})/);
      return yearMatch ? `Win Srv ${yearMatch[1]}` : 'Win Srv';
    }

    if (nameUpper.includes('WINDOWS')) {
      if (nameUpper.includes('XP')) return 'Win XP';
      if (nameUpper.includes('VISTA')) return 'Win Vista';
      if (nameUpper.includes('8.1')) return 'Win 8.1';

      const winVersionMatch = nameUpper.match(/\b(7|8|10|11)\b/);
      if (winVersionMatch) return `Win ${winVersionMatch[1]}`;

      return 'Windows';
    }

    if (nameUpper.includes('UBUNTU')) {
      const versionMatch = nameUpper.match(/(\d{2}\.\d{2})/);
      return versionMatch ? `Ubuntu ${versionMatch[1]}` : 'Ubuntu';
    }

    if (nameUpper.includes('DEBIAN')) return 'Debian';
    if (nameUpper.includes('CENTOS')) return 'CentOS';
    if (nameUpper.includes('RED HAT') || nameUpper.includes('RHEL')) return 'RHEL';
    if (nameUpper.includes('FEDORA')) return 'Fedora';
    if (nameUpper.includes('MAC OS') || nameUpper.includes('MACOS')) return 'macOS';

    // Fallback genérico: recortar para evitar que la barra quede ilegible.
    return name.length > 14 ? `${name.substring(0, 14)}...` : name;
  }

  private countByProperty(array: any[], prop: string): { [key: string]: number } {
    return array.reduce((acc, curr) => {
      const key = curr[prop] || 'Desconocido';
      if (!acc[key]) {
        acc[key] = 0;
      }
      acc[key]++;
      return acc;
    }, {});
  }

  onTerminalesClick(event: { active?: object[] }): void {
    this.onChartClick('terminales', event, this.terminalesItems);
  }

  onFabricanteClick(event: { active?: object[] }): void {
    this.onChartClick('marca', event, this.fabricanteItems);
  }

  onOsClick(event: { active?: object[] }): void {
    this.onChartClick('osName', event, this.osItems);
  }

  onRedClick(event: { active?: object[] }): void {
    if (this.redChartEmpty) return;
    this.onChartClick('dispositivos', event, this.redItems);
  }

  onChartClick(
    filterType: string,
    event: { active?: object[] },
    items: ChartDatum[],
    allowEmpty = false
  ): void {
    const index = chartClickIndex(event);
    if (index === null) return;
    const point = items[index];
    if (!point) return;
    if (!allowEmpty && (point.label === 'Sin datos' || point.label === 'Sin dispositivos de red')) {
      return;
    }
    this.onChartPointClick(filterType, { dataPoint: point });
  }

  onChartPointClick(filterType: string, e: any) {
    // Usar el nombre original si está disponible, sino usar el label
    const filterValue = e.dataPoint.originalLabel || e.dataPoint.label;
    
    // Cerrar el modal si está abierto
    if (this.activeModalRef) {
      this.activeModalRef.close();
      this.activeModalRef = null;
    }
    
    if (filterType === 'terminales') {
      // Si es un clic en la gráfica de terminales, navegamos a assets
      this.router.navigate(['/menu/assets'], { 
        queryParams: { 
          filterType: 'type',
          filterValue: filterValue 
        }
      });
    } else if (filterType === 'dispositivos') {
      // Si es un clic en la gráfica de dispositivos, navegamos a devices
      this.router.navigate(['/menu/devices'], { 
        queryParams: { filterType, filterValue }
      });
    } else {
      // Para otros tipos de filtros, mantenemos la navegación a assets
      this.router.navigate(['/menu/assets'], { 
        queryParams: { filterType, filterValue }
      });
    }
  }

  closeModal(modal: any): void {
    this.activeModalRef = null;
    this.expandedLegendItems = [];
    modal.close();
  }

  checkHardwareChanges(): void {
    if (this.denyUnless(this.canConfirmAlerts(), 'verificar cambios de hardware')) return;
    if (this.isChecking) return;
    
    // Guardar la página actual antes de verificar cambios
    const currentPage = this.page;
    
    this.isChecking = true;
    // Activar overlay inmediatamente (evita delay de hasta 5 seg del polling)
    this.maintenanceService.activateOptimistic('Verificación de cambios en progreso. Por favor espere...');
    // Forzar detección de cambios para asegurar que la animación se muestre
    this.cdr.detectChanges();
    
    this.alertService.checkHardwareChanges().pipe(
      finalize(() => {
        this.isChecking = false;
        // Forzar detección de cambios al finalizar
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage('Verificación de cambios completada');
        
        // Recargar alertas y mantener la página actual
        this.reloadAlertasManteniendoPagina(currentPage);
      },
      error: (error) => {
        console.error('Error al verificar cambios:', error);
        // Cancelar overlay optimista (la verificación falló)
        this.maintenanceService.cancelOptimisticActivation();
        
        // Mostrar mensaje específico para conflictos de concurrencia
        if (error.status === 409) {
          this.notificationService.showOperationInProgress('Ya hay una verificación de cambios en ejecución. Por favor, espera a que termine.');
        } else {
          this.notificationService.showError(
            'Error al Verificar Cambios',
            error.error?.error || error.message || 'Error desconocido al verificar cambios'
          );
        }
        
        // En caso de error, mantener la página actual
        this.page = currentPage;
      }
    });
  }

  cleanupOrphanedAlerts(): void {
    if (this.denyUnless(this.canConfirmAlerts(), 'limpiar alertas')) return;
    if (this.isCleaning) return;
    
    // Guardar la página actual antes de limpiar
    const currentPage = this.page;
    
    this.isCleaning = true;
    // Forzar detección de cambios para asegurar que la animación se muestre
    this.cdr.detectChanges();
    
    this.alertService.cleanupOrphanedAlerts().pipe(
      finalize(() => {
        this.isCleaning = false;
        // Forzar detección de cambios al finalizar
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage('Limpieza de alertas completada');
        
        // Recargar alertas y mantener la página actual
        this.reloadAlertasManteniendoPagina(currentPage);
      },
      error: (error) => {
        console.error('Error al limpiar alertas huérfanas:', error);
        
        // Mostrar mensaje específico para conflictos de concurrencia
        if (error.status === 409) {
          this.notificationService.showOperationInProgress('Ya hay una limpieza de alertas en ejecución. Por favor, espera a que termine.');
        } else {
          this.notificationService.showError(
            'Error al Limpiar Alertas',
            error.error?.error || error.message || 'Error desconocido al limpiar alertas'
          );
        }
        
        // En caso de error, mantener la página actual
        this.page = currentPage;
      }
    });
  }

  async actualizarDispositivos(): Promise<void> {
    if (this.denyUnless(this.canUpdateDevices(), 'actualizar dispositivos de red')) return;

    this.isUpdatingDevices = true;
    
    try {
      const response = await this.http.post<any>(`${this.configService.getApiUrl()}/sync/network-devices-reset`, {}).toPromise();
      
      if (response && response.success) {
        // Mostrar notificación de éxito con detalles
        const data = response.data;
        let message = 'Dispositivos actualizados exitosamente.';
        
        if (data) {
          const details = [];
          if (data.inserted_devices > 0) details.push(`${data.inserted_devices} insertados`);
          if (data.deleted_network_devices > 0) details.push(`${data.deleted_network_devices} eliminados`);
          if (data.error_devices > 0) details.push(`${data.error_devices} errores`);
          
          if (details.length > 0) {
            message += ` ${details.join(', ')}.`;
          }
          
          // Mostrar información adicional
          message += `\nTotal OCS: ${data.total_ocs}, Total final Cerbero: ${data.final_cerbero_count}`;
        }
        
        this.notificationService.showSuccessMessage(message);
      } else {
        const errorMsg = response?.message || 'Error al actualizar dispositivos';
        this.notificationService.showError('Error al Actualizar Dispositivos', errorMsg);
      }
    } catch (error: any) {
      console.error('Error al actualizar dispositivos:', error);
      const errorMsg = error.message || 'Error durante la actualización de dispositivos';
      this.notificationService.showError('Error al Actualizar Dispositivos', errorMsg);
    } finally {
      this.isUpdatingDevices = false;
    }
  }

  navigateToAssetDetails(hardwareId: number): void {
    this.router.navigate(['/menu/asset-details', hardwareId])
      .catch(err => {
        console.error('Error en la navegación:', err);
      });
  }

  private prepareNetworkChart(networkData: NetworkInfoDTO[]): void {
    const networkArray = Array.isArray(networkData) ? networkData : [];

    if (networkArray.length === 0) {
      this.redItems = [];
      this.redChartEmpty = true;
      const empty = buildDoughnutChart([], NETWORK_COLORS, true, 'Sin dispositivos de red');
      this.networkChartData = empty.data;
      this.networkChartOptions = empty.options;
      return;
    }

    const devicesByType = networkArray.reduce((acc: Record<string, any[]>, device: NetworkInfoDTO) => {
      const type = device.type || 'Desconocido';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(device);
      return acc;
    }, {});

    this.redItems = Object.entries(devicesByType).map(([type, devices]) => ({
      label: type,
      y: devices.length
    }));
    this.redChartEmpty = false;
    const chart = buildDoughnutChart(this.redItems, NETWORK_COLORS, true);
    this.networkChartData = chart.data;
    this.networkChartOptions = chart.options;
  }

  private buildCompactCharts(): void {
    const terminales = buildDoughnutChart(this.terminalesItems, TERMINAL_COLORS, true);
    this.pieChartData = terminales.data;
    this.pieChartOptions = terminales.options;

    const fabricante = buildColumnChart(this.fabricanteItems, true);
    this.barChartData = fabricante.data;
    this.barChartOptions = fabricante.options;

    const os = buildHorizontalBarChart(this.osItems, true, false);
    this.osChartData = os.data;
    this.osChartOptions = os.options;
  }

  showNewHardwareMessage(): void {
    this.notificationService.showInfo(
      'Equipo Nuevo',
      'Este equipo es nuevo y aún no está registrado en la base de datos. Por favor, confirme la alerta para procesar su registro.'
    );
  }

  get pagedAlerts(): Alerta[] {
    const start = (this.page - 1) * this.pageSize;
    const end = this.page * this.pageSize;
    return this.filteredAlerts.slice(start, end);
  }

  canConfirmAlerts(): boolean {
    return this.permissionsService.canConfirmAlerts();
  }

  canUpdateDevices(): boolean {
    return this.permissionsService.canUpdateNetworkDevices();
  }

  private denyUnless(allowed: boolean, accion: string): boolean {
    if (allowed) return false;
    this.notificationService.showError(
      'Sin permisos suficientes',
      `No tenés permisos para ${accion}. Hace falta rol de administrador o Game Master.`
    );
    return true;
  }

  expandChart(chartType: string): void {
    let title = '';
    let type: ChartType = 'doughnut';
    let data: ChartData | undefined;
    let options: ChartConfiguration['options'] | undefined;
    let filterType: string | null = null;
    let clickItems: ChartDatum[] = [];
    let legend: ChartLegendItem[] = [];

    switch (chartType) {
      case 'terminales': {
        title = 'Distribución de Terminales';
        const chart = buildDoughnutChart(this.terminalesItems, TERMINAL_COLORS, false);
        type = 'doughnut';
        data = chart.data;
        options = chart.options;
        filterType = 'terminales';
        clickItems = this.terminalesItems;
        legend = doughnutLegendItems(this.terminalesItems, TERMINAL_COLORS);
        break;
      }
      case 'fabricante': {
        title = 'Fabricantes de Equipos';
        const chart = buildColumnChart(this.fabricanteItems, false);
        type = 'bar';
        data = chart.data;
        options = chart.options;
        filterType = 'marca';
        clickItems = this.fabricanteItems;
        break;
      }
      case 'sistema-operativo': {
        title = 'Sistemas Operativos';
        const chart = buildHorizontalBarChart(this.osItems, false, true);
        type = 'bar';
        data = chart.data;
        options = chart.options;
        filterType = 'osName';
        clickItems = this.osItems;
        break;
      }
      case 'red': {
        title = 'Dispositivos de Red';
        const chart = this.redChartEmpty
          ? buildDoughnutChart([], NETWORK_COLORS, false, 'Sin dispositivos de red')
          : buildDoughnutChart(this.redItems, NETWORK_COLORS, false);
        type = 'doughnut';
        data = chart.data;
        options = chart.options;
        filterType = this.redChartEmpty ? null : 'dispositivos';
        clickItems = this.redItems;
        legend = this.redChartEmpty
          ? []
          : doughnutLegendItems(this.redItems, NETWORK_COLORS);
        break;
      }
      default:
        return;
    }

    this.expandedChartTitle = title;
    this.expandedChartType = type;
    this.expandedChartData = data;
    this.expandedChartOptions = options;
    this.expandedFilterType = filterType;
    this.expandedClickItems = clickItems;
    this.expandedLegendItems = legend;

    const withLegend = legend.length > 0;
    this.activeModalRef = this.modalService.open(this.chartModal, {
      size: 'xl',
      backdrop: 'static',
      keyboard: false,
      centered: true,
      windowClass: withLegend ? 'chart-modal-xl chart-modal-xl--legend' : 'chart-modal-xl',
      modalDialogClass: withLegend ? 'chart-modal-dialog chart-modal-dialog--legend' : 'chart-modal-dialog'
    });

    setTimeout(() => this.cdr.detectChanges(), 200);
  }

  downloadExpandedChart(): void {
    const image = this.getExpandedChartImage();
    if (!image) return;
    const link = document.createElement('a');
    link.href = image;
    link.download = `${this.expandedChartTitle || 'grafica'}.png`;
    link.click();
  }

  printExpandedChart(): void {
    const image = this.getExpandedChartImage();
    if (!image) return;
    const popup = window.open('', '_blank');
    if (!popup) return;
    popup.document.write(
      `<html><head><title>${this.expandedChartTitle}</title></head><body style="margin:0;text-align:center"><img src="${image}" style="max-width:100%"/></body></html>`
    );
    popup.document.close();
    popup.focus();
    popup.print();
  }

  private getExpandedChartImage(): string | null {
    const fromDirective = this.expandedChart?.toBase64Image();
    if (fromDirective) return fromDirective;
    const canvas = document.querySelector('.expanded-chart-container canvas') as HTMLCanvasElement | null;
    return canvas ? canvas.toDataURL('image/png', 1) : null;
  }

  onExpandedChartClick(event: { active?: object[] }): void {
    if (!this.expandedFilterType) return;
    this.onChartClick(this.expandedFilterType, event, this.expandedClickItems);
  }

  onExpandedLegendClick(item: ChartLegendItem): void {
    if (!this.expandedFilterType) return;
    const point = this.expandedClickItems.find(
      (entry) => (entry.originalLabel || entry.label) === item.label
    );
    if (!point) return;
    this.onChartPointClick(this.expandedFilterType, { dataPoint: point });
  }

  filterAlerts(filterType: string): void {
    this.currentFilter = filterType;
    this.page = 1; // Resetear a la primera página al cambiar filtro
    
    this.applyCurrentFilter();
  }

  getFilterCount(filterType: string): number {
    if (filterType === 'all') {
      return this.alerts.length;
    }
    
    return this.alerts.filter(alert => {
      switch (filterType) {
        case 'new_hardware':
          return alert.new_hardware === 1;
        case 'memory':
          return alert.memory === true;
        case 'disk':
          return alert.disk === true;
        case 'ip':
          return alert.ip === true;
        case 'video':
          return alert.video === true;
        case 'monitor':
          return alert.monitor === true;
        case 'storage_hw':
          return alert.storageHw === true;
        case 'software_forbidden':
          return alert.softwareForbidden === true;
        default:
          return false;
      }
    }).length;
  }

  private normalizeHardwareType(type: string): string {
    // Normalizar el tipo de hardware para que coincida con los filtros del componente assets
    const normalizedType = type.trim().toUpperCase();
    
    switch (normalizedType) {
      case 'DESKTOP':
        return 'DESKTOP';
      case 'MINI PC':
      case 'MINI-PC':
      case 'MINIPC':
        return 'MINI PC';
      case 'LAPTOP':
      case 'NOTEBOOK':
      case 'PORTATIL':
        return 'LAPTOP';
      case 'TOWER':
      case 'TORRE':
        return 'TOWER';
      case 'LOW PROFILE DESKTOP':
      case 'LOW PROFILE':
      case 'LOWPROFILE':
      case 'LOW-PROFILE':
      case 'LOWPROFILEDESKTOP':
      case 'LOW-PROFILE-DESKTOP':
        return 'LOW PROFILE DESKTOP';
      case 'MINI TOWER':
      case 'MINITOWER':
      case 'MINI-TOWER':
      case 'MINI TOWER DESKTOP':
      case 'MINITOWERDESKTOP':
      case 'MINI-TOWER-DESKTOP':
        return 'MINI TOWER';
      case 'DESCONOCIDO':
      case 'UNKNOWN':
      case 'N/A':
      case 'NA':
      case '':
      case null:
      case undefined:
        return 'DESCONOCIDO';
      default:
        return normalizedType;
    }
  }

  /**
   * Registra el tour de Panel de Control en el helper-dog (menú radial).
   * Los hooks `beforeStart`/`afterEnd` resetean el scroll para que el spotlight
   * del primer/último step no quede contra el final de la página.
   */
  private registerDashboardTour(): void {
    this.tourCleanup = this.tourRegistry.register('dashboard', [
      {
        id: 'panel-overview',
        title: 'Tour del panel',
        icon: 'fa-route',
        description: 'Recorrido por las secciones del panel de control.',
        buildSteps: () => this.buildTourPanel(),
        beforeStart: () => this.resetScroll(),
        afterEnd: () => this.resetScroll(),
      },
    ]);
  }

  private resetScroll(): void {
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  /** Arma los pasos del tour del Panel (overview → acciones → alertas). */
  private buildTourPanel(): DriveStep[] {
    const steps = this.guidedTourHost.buildSteps([
      {
        selector: '#tour-dashboard-title',
        title: 'Panel de control',
        description:
          'Resumen visual del entorno: tipos de terminales, fabricantes, sistemas operativos y dispositivos de red.',
        side: 'bottom'
      },
      {
        selector: '#tour-dashboard-charts',
        title: 'Gráficas',
        description:
          'Cada tarjeta resume un corte del inventario. Podés ampliar una gráfica con el ícono de expandir y, en la vista ampliada, usar la opción de imprimir/exportar.',
        side: 'top'
      }
    ]);

    steps.push(...this.buildDashboardActionsSteps());

    steps.push(...this.guidedTourHost.buildSteps([
      {
        selector: '#tour-dashboard-alerts',
        title: 'Alertas recientes',
        description:
          'Debajo tenés la lista de alertas detectadas (hardware, disco, red, software, etc.) y los filtros por tipo para enfocarte en lo urgente.',
        side: 'top'
      }
    ]));

    return steps;
  }

  private buildDashboardActionsSteps(): DriveStep[] {
    const defs: Array<{ selector: string; title: string; description: string; side: 'left' | 'bottom' }> = [
      {
        selector: '#tour-dashboard-btn-check',
        title: 'Verificar cambios',
        description:
          'Compara el estado actual de equipos contra el inventario y genera o actualiza alertas automáticamente.',
        side: 'left'
      },
      {
        selector: '#tour-dashboard-btn-update',
        title: 'Actualizar dispositivos',
        description:
          'Sincroniza dispositivos de red desde OCS para refrescar la información guardada en Cerbero.',
        side: 'left'
      },
      {
        selector: '#tour-dashboard-btn-cleanup',
        title: 'Limpiar alertas',
        description:
          'Elimina alertas obsoletas o inconsistentes para dejar la bandeja limpia y vigente.',
        side: 'left'
      }
    ];

    const steps: DriveStep[] = [];
    for (const def of defs) {
      if (!document.querySelector(def.selector)) {
        continue;
      }
      steps.push({
        element: def.selector,
        popover: {
          title: def.title,
          description: def.description,
          side: def.side,
          align: 'start'
        },
        onHighlighted: () => {
          // Scroll arriba ante cada paso; driver.js reposiciona el popover solo.
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      });
    }

    if (steps.length === 0 && document.querySelector('#tour-dashboard-alert-actions')) {
      steps.push({
        element: '#tour-dashboard-alert-actions',
        popover: {
          title: 'Acciones rápidas',
          description: 'En esta zona se concentran las acciones de mantenimiento y sincronización de alertas.',
          side: 'left',
          align: 'start'
        },
        onHighlighted: () => {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      });
    }

    return steps;
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
  }
}
