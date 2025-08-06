import { Component, OnInit, AfterViewInit, ChangeDetectorRef, ViewChild, TemplateRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { BiosService } from '../services/bios.service';
import { CanvasJSAngularChartsModule } from '@canvasjs/angular-charts';
import { NgbPaginationModule, NgbModalModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AlertService, Alerta } from '../services/alert.service';
import { finalize } from 'rxjs/operators';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { PermissionsService } from '../services/permissions.service';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';

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
    NgbPaginationModule,
    NgbModalModule,
    NotificationContainerComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('chartModal', { static: true }) chartModal!: TemplateRef<any>;
  
  pieChartOptions: any;
  barChartOptions: any;
  pieChartOptions2: any;
  lineChartOptions: any;
  alerts: Alerta[] = [];
  isChecking: boolean = false;
  isCleaning: boolean = false;
  page: number = 1;
  pageSize: number = 14;
  collectionSize: number = 0;
  currentFilter: string = 'all';
  filteredAlerts: Alerta[] = [];
  expandedChartTitle: string = '';
  expandedChartOptions: any = null;
  private activeModalRef: any = null;

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
    private modalService: NgbModal
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
            fontSize: this.getResponsiveFontSize(18), // Aumentado de 16 a 18
            padding: 15, // Aumentado de 10 a 15
            fontFamily: "Arial, sans-serif",
            fontWeight: "bold"
          },
          data: [{
            indexLabelFontSize: this.getResponsiveFontSize(14), // Aumentado de 11 a 14
            indexLabelMaxWidth: 150, // Aumentado de 100 a 150
            indexLabelWrap: true,
            showInLegend: false,
          }]
        };

        // Aplicar un valor mínimo a las porciones pequeñas para mejor visibilidad
        const enhancedTypeData = typeData.map(item => {
          const minValue = 25; // Reducido de 30 a 25 para mejor proporción
          const realValue = item.y;
          const displayValue = realValue < minValue ? minValue : realValue;
          
          return {
            ...item,
            y: displayValue,
            toolTipContent: realValue < minValue 
              ? `${item.label}: ${realValue} (altura ampliada para visibilidad)`
              : `${item.label}: ${realValue}`,
            indexLabelFontSize: this.getResponsiveFontSize(14) // Tamaño de fuente específico
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
            indexLabelFontSize: this.getResponsiveFontSize(15), // Aumentado de 13 a 15
            // Configuraciones para mejorar la visibilidad de porciones pequeñas
            indexLabelPlacement: "outside",
            indexLabelOrientation: "horizontal",
            indexLabelMaxWidth: 140, // Aumentado de 120 a 140
            indexLabelWrap: true,
            // Ocultar la leyenda
            showInLegend: false,
            // Configurar colores personalizados para mejor visibilidad
            colorSet: "customColorSet",
            // Configurar el radio interno para hacer el anillo más grueso
            innerRadius: "45%", // Reducido de 55% a 45% para anillo más grueso
            // Configurar el radio externo para asegurar tamaño consistente
            radius: "85%",
            // Asegurar animaciones y exportación consistentes
            animationEnabled: true,
            exportEnabled: true
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
              fontSize: this.getResponsiveFontSize(12), // Aumentado de 10 a 12
              fontColor: "#666"
            }
          },
          axisY: { 
            title: "Cantidad",
            titleFontSize: this.getResponsiveFontSize(14), // Aumentado de 12 a 14
            labelFontSize: this.getResponsiveFontSize(13), // Aumentado de 11 a 13
            minimum: 0,
            // Dar más espacio para las etiquetas del eje X
            margin: 20,
            // Configurar intervalos automáticos
            interval: "auto",
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
          axisX: {
            // Dejar que CanvasJS maneje automáticamente las etiquetas
            labelAutoFit: true,
            labelAutoFitFontSizeMin: 8,
            labelAutoFitFontSizeMax: 14
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
              const tooltipText = `${d.originalLabel || d.label}: ${realY} dispositivos`;
              
              return {
                ...d,
                y: visualY,
                toolTipContent: tooltipText,
                indexLabel: String(realY),
                // Agregar color personalizado para barras pequeñas
                color: realY < 50 ? "#e74c3c" : undefined,
                indexLabelFontSize: this.getResponsiveFontSize(12), // Tamaño de fuente específico
                indexLabelPlacement: "outside", // Colocar etiquetas fuera de las barras
                indexLabelOrientation: "horizontal" // Orientación horizontal
              };
            }),
            click: this.onChartPointClick.bind(this, 'marca'),
            indexLabelFontSize: this.getResponsiveFontSize(15), // Aumentado de 13 a 15
            // Configuraciones adicionales para mejor visibilidad
            indexLabelMaxWidth: 100, // Limitar ancho de etiquetas de barras
            indexLabelWrap: true, // Permitir wrap de etiquetas
            indexLabelBackgroundColor: "rgba(255,255,255,0.8)", // Fondo para mejor legibilidad
            indexLabelBorderColor: "#ccc", // Borde para separar
            indexLabelBorderThickness: 1 // Grosor del borde
          }]
        };

        this.pieChartOptions2 = {
          ...commonOptions,
          title: { 
            ...commonOptions.title,
            text: "Sistema Operativo" 
          },
          axisY: { 
            title: "Cantidad", 
            labelFontSize: this.getResponsiveFontSize(13), // Aumentado de 11 a 13
            titleFontSize: this.getResponsiveFontSize(14) // Aumentado de 12 a 14
          },
          axisX: {
            labelFontSize: this.getResponsiveFontSize(12), // Agregado tamaño de fuente para eje X
            labelMaxWidth: 100, // Limitar ancho de etiquetas
            labelWrap: true
          },
          data: [{
            ...commonOptions.data[0],
            type: "bar",
            dataPoints: osData.map(d => ({
              ...d,
              indexLabelFontSize: this.getResponsiveFontSize(13) // Tamaño de fuente específico
            })),
            click: this.onChartPointClick.bind(this, 'osName'),
            indexLabelFontSize: this.getResponsiveFontSize(15) // Aumentado de 13 a 15
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
        console.log('Alertas actualizadas:', alertas);
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
        console.log('Alerta confirmada exitosamente:', response);
        
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
    // Limpiar la referencia del modal
    this.activeModalRef = null;
    // Cerrar el modal
    modal.close();
  }

  checkHardwareChanges(): void {
    if (this.isChecking) return;
    
    // Guardar la página actual antes de verificar cambios
    const currentPage = this.page;
    
    this.isChecking = true;
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
            indexLabel: "Sin dispositivos de red",
            indexLabelFontSize: this.getResponsiveFontSize(14)
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

    // Aplicar el mismo procesamiento de datos que en la gráfica de terminales
    const dataPoints = Object.entries(devicesByType).map(([type, devices]) => {
      const realValue = devices.length;
      const minValue = 25; // Mismo valor mínimo que en terminales
      const displayValue = realValue < minValue ? minValue : realValue;
      
      return {
        label: type,
        y: displayValue,
        toolTipContent: realValue < minValue 
          ? `${type}: ${realValue} (altura ampliada para visibilidad)`
          : `${type}: ${realValue}`,
        indexLabelFontSize: this.getResponsiveFontSize(14) // Tamaño de fuente específico
      };
    });

    this.lineChartOptions = {
      ...commonOptions,
      title: {
        ...commonOptions.title,
        text: "Dispositivos de Red"
      },
      data: [{
        ...commonOptions.data[0],
        type: "doughnut",
        indexLabel: "{label}: {y}",
        startAngle: -90,
        dataPoints: dataPoints,
        click: this.onChartPointClick.bind(this, 'dispositivos'),
        indexLabelFontSize: this.getResponsiveFontSize(15),
        // Configuraciones para mejorar la visibilidad de porciones pequeñas
        indexLabelPlacement: "outside",
        indexLabelOrientation: "horizontal",
        indexLabelMaxWidth: 140,
        indexLabelWrap: true,
        // Ocultar la leyenda
        showInLegend: false,
        // Configurar colores personalizados para mejor visibilidad
        colorSet: "customColorSet",
        // Configurar el radio interno para hacer el anillo más grueso
        innerRadius: "45%",
        // Configurar el radio externo para asegurar tamaño consistente
        radius: "85%",
        // Asegurar animaciones y exportación consistentes
        animationEnabled: true,
        exportEnabled: true
      }],
      // Configurar colores personalizados para dispositivos de red
      colorSet: [
        "#3498db", // Router - Azul
        "#e74c3c", // Switch - Rojo
        "#2ecc71", // Access Point - Verde
        "#f39c12", // Firewall - Naranja
        "#9b59b6", // Modem - Púrpura
        "#1abc9c", // Bridge - Turquesa
        "#34495e", // Gateway - Gris oscuro
        "#e67e22"  // Otros - Naranja oscuro
      ]
    };
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

  expandChart(chartType: string): void {
    console.log('expandChart llamado con:', chartType);
    
    let chartOptions: any = null;
    let title: string = '';

    switch (chartType) {
      case 'terminales':
        chartOptions = this.pieChartOptions;
        title = 'Distribución de Terminales';
        break;
      case 'fabricante':
        chartOptions = this.barChartOptions;
        title = 'Fabricantes de Equipos';
        break;
      case 'sistema-operativo':
        chartOptions = this.pieChartOptions2;
        title = 'Sistemas Operativos';
        break;
      case 'red':
        chartOptions = this.lineChartOptions;
        title = 'Dispositivos de Red';
        break;
      default:
        console.log('Tipo de gráfica no reconocido:', chartType);
        return;
    }

    console.log('ChartOptions encontradas:', !!chartOptions);
    console.log('Título:', title);

    if (chartOptions) {
      // Crear una copia de las opciones con configuraciones optimizadas para el modal
      this.expandedChartOptions = {
        ...chartOptions,
        title: {
          ...chartOptions.title,
          fontSize: 24, // Título más grande para el modal
          padding: 20,
          horizontalAlign: "center"
        },
        data: chartOptions.data.map((dataSeries: any) => ({
          ...dataSeries,
          indexLabelFontSize: 16, // Etiquetas más grandes
          indexLabelMaxWidth: 200, // Más espacio para etiquetas
          toolTipContent: dataSeries.toolTipContent || "{label}: {y}"
        }))
      };

      this.expandedChartTitle = title;

      console.log('Intentando abrir modal...');
      
      // Mostrar el modal usando NgbModal
      this.activeModalRef = this.modalService.open(this.chartModal, {
        size: 'xl',
        backdrop: 'static',
        keyboard: false,
        centered: true,
        windowClass: 'chart-modal-xl',
        modalDialogClass: 'chart-modal-dialog'
      });
      
      // Forzar la detección de cambios después de que el modal se abra
      setTimeout(() => {
        this.cdr.detectChanges();
      }, 200);
      
      console.log('Modal abierto exitosamente');
    } else {
      console.log('No se encontraron opciones de gráfica para:', chartType);
    }
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
