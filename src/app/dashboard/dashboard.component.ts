import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { BiosService } from '../services/bios.service';
import { CanvasJSAngularChartsModule } from '@canvasjs/angular-charts';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AlertService, Alerta } from '../services/alert.service';
import { finalize } from 'rxjs/operators';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { PermissionsService } from '../services/permissions.service';

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
    CanvasJSAngularChartsModule, 
    RouterModule,
    NgbPaginationModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  pieChartOptions: any;
  barChartOptions: any;
  pieChartOptions2: any;
  lineChartOptions: any;
  alerts: Alerta[] = [];
  isChecking: boolean = false;
  isCleaning: boolean = false;
  page: number = 1;
  pageSize: number = 7;
  collectionSize: number = 0;

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
    private permissionsService: PermissionsService
  ) {}

  private getResponsiveFontSize(base: number): number {
    const width = window.innerWidth;
    if (width < 600) return Math.round(base * 0.7);
    if (width < 992) return Math.round(base * 0.85);
    if (width < 1200) return Math.round(base * 0.95);
    return base;
  }

  ngOnInit(): void {
    this.loadAlertas();
    forkJoin({
      hardware: this.hardwareService.getHardware(),
      bios: this.biosService.getAllBios(),
      network: this.networkInfoService.getNetworkInfo()
    }).subscribe(
      ({ hardware, bios, network }) => {
        const biosMap = new Map(bios.map(b => [b.hardwareId, b]));
        const typeData = this.prepareHardwareTypeData(hardware, biosMap);
        const brandData = this.prepareBrandData(bios);
        const osData = this.prepareChartData(hardware, 'osName');

        // Procesar datos de red
        let networkData: NetworkInfoDTO[] = [];
        if (network && 'success' in network && network.success) {
          networkData = network.data || [];
        }

        // Configuración común para todas las gráficas
        const commonOptions = {
          animationEnabled: true,
          exportEnabled: true,
          theme: "light2",
          title: {
            fontSize: this.getResponsiveFontSize(16),
            padding: 10
          },
          data: [{
            indexLabelFontSize: this.getResponsiveFontSize(11),
            indexLabelMaxWidth: 100,
            indexLabelWrap: true,
            showInLegend: false,
          }]
        };

        // Aplicar un valor mínimo a las porciones pequeñas para mejor visibilidad
        const enhancedTypeData = typeData.map(item => {
          const minValue = 30; // Valor mínimo para porciones pequeñas
          const realValue = item.y;
          const displayValue = realValue < minValue ? minValue : realValue;
          
          return {
            ...item,
            y: displayValue,
            toolTipContent: realValue < minValue 
              ? `${item.label}: ${realValue} (altura ampliada para visibilidad)`
              : `${item.label}: ${realValue}`
          };
        });

        this.pieChartOptions = {
          ...commonOptions,
          title: { 
            ...commonOptions.title,
            text: "Terminales" 
          },
          data: [{
            ...commonOptions.data[0],
            type: "doughnut",
            indexLabel: "{label}: {y}",
            startAngle: -90,
            dataPoints: enhancedTypeData,
            click: this.onChartPointClick.bind(this, 'terminales'),
            indexLabelFontSize: this.getResponsiveFontSize(13),
            // Configuraciones para mejorar la visibilidad de porciones pequeñas
            indexLabelPlacement: "outside",
            indexLabelOrientation: "horizontal",
            indexLabelMaxWidth: 120,
            indexLabelWrap: true,
            // Ocultar la leyenda
            showInLegend: false,
            // Configurar colores personalizados para mejor visibilidad
            colorSet: "customColorSet",
            // Configurar el radio interno para hacer el anillo más delgado
            innerRadius: "60%"
          }],
          // Configurar colores personalizados
          colorSet: [
            "#2E86AB", // Desktop - Azul
            "#A23B72", // Mini PC - Rosa
            "#F18F01", // Tower - Naranja
            "#C73E1D", // Notebook - Rojo
            "#8E44AD", // Low Profile Desktop - Púrpura
            "#95A5A6", // Desconocido - Gris
            "#E67E22"  // Mini Tower - Naranja oscuro
          ]
        };

        this.barChartOptions = {
          ...commonOptions,
          title: { 
            ...commonOptions.title,
            text: "Fabricante",
            subtitle: {
              text: "Barras pequeñas ampliadas para mejor visibilidad",
              fontSize: this.getResponsiveFontSize(10),
              fontColor: "#666"
            }
          },
          axisY: { 
            title: "Cantidad",
            titleFontSize: this.getResponsiveFontSize(12),
            labelFontSize: this.getResponsiveFontSize(11),
            minimum: 0,
            // Agregar formato personalizado para mostrar valores reales
            labelFormatter: (e: any) => {
              const value = e.value;
              // Si el valor es 50 pero el valor real es menor, mostrar el valor real
              if (value === 50) {
                const dataPoint = brandData.find(d => d.y < 50);
                if (dataPoint) {
                  return `< ${dataPoint.y}`;
                }
              }
              return value;
            }
          },
          legend: {
            cursor: "pointer",
            itemclick: function (e: any) {
              if (typeof (e.dataSeries.visible) === "undefined" || e.dataSeries.visible) {
                e.dataSeries.visible = false;
              } else {
                e.dataSeries.visible = true;
              }
              e.chart.render();
            }
          },
          data: [{
            ...commonOptions.data[0],
            type: "column",
            dataPoints: brandData.map(d => {
              const realY = d.y;
              // Calcular altura mínima: si el valor real es menor a 50, usar 50 como altura visual
              const visualY = realY < 50 ? 50 : realY;
              const tooltipText = realY < 50 
                ? `${d.label}: ${realY} dispositivos (altura ampliada para visibilidad)`
                : `${d.label}: ${realY} dispositivos`;
              
              return {
                ...d,
                y: visualY,
                toolTipContent: tooltipText,
                indexLabel: String(realY),
                // Agregar color personalizado para barras pequeñas
                color: realY < 50 ? "#e74c3c" : undefined
              };
            }),
            click: this.onChartPointClick.bind(this, 'marca'),
            indexLabelFontSize: this.getResponsiveFontSize(13)
          }]
        };

        this.pieChartOptions2 = {
          ...commonOptions,
          title: { 
            ...commonOptions.title,
            text: "S.O." 
          },
          axisY: { title: "Cantidad", labelFontSize: this.getResponsiveFontSize(11), titleFontSize: this.getResponsiveFontSize(12) },
          data: [{
            ...commonOptions.data[0],
            type: "bar",
            dataPoints: osData,
            click: this.onChartPointClick.bind(this, 'osName'),
            indexLabelFontSize: this.getResponsiveFontSize(13)
          }]
        };

        this.prepareNetworkChart(networkData, commonOptions);
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
        this.collectionSize = alertas.length;
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
        console.log('Alertas actualizadas:', alertas);
        this.alerts = alertas;
        this.collectionSize = alertas.length;
        
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

  confirmarAlerta(alerta: Alerta): void {
    // Guardar la página actual antes de confirmar
    const currentPage = this.page;
    
    this.alertService.confirmarAlerta(alerta.id).subscribe({
      next: (response) => {
        console.log('Alerta confirmada exitosamente:', response);
        
        // Recargar alertas y mantener la página actual
        this.reloadAlertasManteniendoPagina(currentPage);
      },
      error: (error) => {
        let mensajeError = 'Error al confirmar la alerta';
        if (error.status === 404) {
          mensajeError = 'No se encontró la alerta';
        } else if (error.status === 400) {
          mensajeError = 'Solicitud inválida';
        }
        console.error(mensajeError, error);
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
    return Object.entries(counts).map(([label, y]) => ({ label, y }));
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

  onChartPointClick(filterType: string, e: any) {
    const filterValue = e.dataPoint.label;
    
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

  checkHardwareChanges(): void {
    if (this.isChecking) return;
    
    // Guardar la página actual antes de verificar cambios
    const currentPage = this.page;
    
    this.isChecking = true;
    this.alertService.checkHardwareChanges().pipe(
      finalize(() => {
        this.isChecking = false;
      })
    ).subscribe({
      next: () => {
        // Recargar alertas y mantener la página actual
        this.reloadAlertasManteniendoPagina(currentPage);
      },
      error: (error) => {
        console.error('Error al verificar cambios:', error);
        // En caso de error, mantener la página actual
        this.page = currentPage;
      }
    });
  }

  cleanupOrphanedAlerts(): void {
    if (this.isCleaning) return;
    
    // Guardar la página actual antes de limpiar
    const currentPage = this.page;
    
    this.isCleaning = true;
    this.alertService.cleanupOrphanedAlerts().pipe(
      finalize(() => {
        this.isCleaning = false;
      })
    ).subscribe({
      next: () => {
        // Recargar alertas y mantener la página actual
        this.reloadAlertasManteniendoPagina(currentPage);
      },
      error: (error) => {
        console.error('Error al limpiar alertas huérfanas:', error);
        // En caso de error, mantener la página actual
        this.page = currentPage;
      }
    });
  }

  navigateToAssetDetails(hardwareId: number): void {
    this.router.navigate(['/menu/asset-details', hardwareId])
      .then(() => {
        console.log('Navegación completada');
      })
      .catch(err => {
        console.error('Error en la navegación:', err);
      });
  }

  private prepareNetworkChart(networkData: NetworkInfoDTO[], commonOptions: any): void {
    // Asegurarnos de que networkData sea un array
    const networkArray = Array.isArray(networkData) ? networkData : [];
    
    // Si no hay datos, mostrar un mensaje en la gráfica
    if (networkArray.length === 0) {
      this.lineChartOptions = {
        ...commonOptions,
        title: {
          ...commonOptions.title,
          text: "Dispositivos de Red"
        },
        data: [{
          ...commonOptions.data[0],
          type: "pie",
          startAngle: -90,
          dataPoints: [{
            label: "Sin datos",
            y: 1,
            indexLabel: "Sin dispositivos de red"
          }]
        }]
      };
      return;
    }

    const devicesByType = networkArray.reduce((acc: Record<string, any[]>, device: NetworkInfoDTO) => {
      // Asegurarnos de que el dispositivo tenga un tipo válido
      const type = device.type || 'Desconocido';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(device);
      return acc;
    }, {});

    const dataPoints = Object.entries(devicesByType).map(([type, devices]) => ({
      label: type,
      y: devices.length,
      indexLabel: `${type}: {y}`
    }));

    this.lineChartOptions = {
      ...commonOptions,
      title: {
        ...commonOptions.title,
        text: "Dispositivos de Red"
      },
      data: [{
        ...commonOptions.data[0],
        type: "doughnut",
        startAngle: -90,
        dataPoints: dataPoints,
        click: this.onChartPointClick.bind(this, 'dispositivos'),
        indexLabelFontSize: this.getResponsiveFontSize(13)
      }]
    };
  }

  showNewHardwareMessage(): void {
    alert('Este equipo es nuevo y aún no está registrado en la base de datos. Por favor, confirme la alerta para procesar su registro.');
  }

  get pagedAlerts(): Alerta[] {
    const start = (this.page - 1) * this.pageSize;
    const end = this.page * this.pageSize;
    return this.alerts.slice(start, end);
  }

  canConfirmAlerts(): boolean {
    return this.permissionsService.canConfirmAlerts();
  }

  private normalizeHardwareType(type: string): string {
    // Normalizar el tipo de hardware para que coincida con los filtros del componente assets
    const normalizedType = type.trim().toUpperCase();
    
    // Log para debugging de normalización
    if (type !== normalizedType) {
      console.log(`Normalizando: "${type}" -> "${normalizedType}"`);
    }
    
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
      case 'LOW PROFILE':
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
}
