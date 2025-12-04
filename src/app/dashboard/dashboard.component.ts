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
import { ConfigService } from '../services/config.service';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';

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
  isUpdatingDevices: boolean = false;
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
    private modalService: NgbModal,
    private configService: ConfigService,
    private http: HttpClient,
    private authService: AuthService
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
      hardware: this.hardwareService.getActiveHardware(),
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
            toolTipContent: `${item.label}: ${realValue}`,
            indexLabel: `${item.label}: ${realValue}`, // Mostrar "Nombre: Número"
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
            text: "Sistema Operativo",
            subtitle: {
              text: "Barras pequeñas ampliadas para mejor visibilidad",
              fontSize: this.getResponsiveFontSize(12),
              fontColor: "#666"
            }
          },
          axisY: { 
            title: "Cantidad", 
            labelFontSize: this.getResponsiveFontSize(13),
            titleFontSize: this.getResponsiveFontSize(14),
            minimum: 0,
            margin: 20,
            interval: "auto",
            labelFormatter: (e: any) => {
              const value = e.value;
              if (value === 50) {
                const dataPoint = osData.find(d => d.y < 50);
                if (dataPoint) {
                  return `< ${dataPoint.y}`;
                }
              }
              return value;
            }
          },
          axisX: {
            labelFontSize: this.getResponsiveFontSize(12),
            labelMaxWidth: 100,
            labelWrap: true,
            labelAutoFit: true,
            labelAutoFitFontSizeMin: 8,
            labelAutoFitFontSizeMax: 14
          },
          data: [{
            ...commonOptions.data[0],
            type: "bar",
            dataPoints: osData.map(d => {
              const realY = d.y;
              // Calcular altura mínima: si el valor real es menor a 50, usar 50 como altura visual
              const visualY = realY < 50 ? 50 : realY;
              const abbreviatedLabel = this.abbreviateOSName(d.label);
              const tooltipText = `${d.label}: ${realY} dispositivos`;
              
              return {
                ...d,
                label: abbreviatedLabel, // Usar etiqueta abreviada para mostrar en eje X
                originalLabel: d.label, // Guardar nombre original para tooltip y filtrado
                y: visualY,
                toolTipContent: tooltipText,
                indexLabel: String(realY), // Mostrar cantidad a la derecha de la barra
                indexLabelFontSize: this.getResponsiveFontSize(12),
                indexLabelPlacement: "outside",
                indexLabelOrientation: "horizontal",
                indexLabelMaxWidth: 60,
                indexLabelWrap: true,
                indexLabelBackgroundColor: "rgba(255,255,255,0.9)",
                indexLabelBorderColor: "#ddd",
                indexLabelBorderThickness: 1,
                // Agregar color personalizado para barras pequeñas
                color: realY < 50 ? "#e74c3c" : undefined
              };
            }),
            click: this.onChartPointClick.bind(this, 'osName')
          }]
        };

        this.prepareNetworkChart(networkData, commonOptions);
      },
      (error) => {
        console.error('Error al cargar los datos', error);
        
        // Verificar si es un error de autenticación (posible reseteo de base de datos)
        if (error.status === 401) {
          console.log('Error 401 detectado - posible reseteo de base de datos');
          this.authService.handleDatabaseReset();
        }
      }
    );
  }

  ngAfterViewInit() {
    // Inicializar todos los tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    Array.from(tooltipTriggerList).forEach(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    
    // Ajustar coordenadas del mouse para compensar el zoom del body
    this.fixChartMouseCoordinates();
  }

  private fixChartMouseCoordinates(): void {
    // Esperar a que las gráficas se rendericen completamente
    setTimeout(() => {
      const chartContainers = document.querySelectorAll('canvasjs-chart');
      const zoomFactor = 0.8; // El zoom aplicado al body en styles.css
      
      chartContainers.forEach((container: any) => {
        // Buscar el canvas dentro del contenedor de CanvasJS
        const canvas = container.querySelector('canvas');
        if (!canvas) return;
        
        // Interceptar eventos del mouse antes de que CanvasJS los procese
        const adjustMouseEvent = (e: MouseEvent) => {
          const rect = canvas.getBoundingClientRect();
          
          // Calcular coordenadas relativas al canvas (ya afectadas por el zoom visual)
          const relativeX = e.clientX - rect.left;
          const relativeY = e.clientY - rect.top;
          
          // Obtener dimensiones del canvas
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          const displayWidth = rect.width; // Tamaño visual (ya afectado por zoom 0.8)
          const displayHeight = rect.height; // Tamaño visual (ya afectado por zoom 0.8)
          
          // Explicación del problema y solución:
          // Con zoom 0.8, el canvas se muestra 80% del tamaño original
          // Las coordenadas del mouse están en el espacio visual (con zoom)
          // CanvasJS calcula coordenadas basándose en el tamaño visual del canvas
          // pero el canvas interno mantiene su tamaño original
          //
          // Solución profesional: Ajustar coordenadas considerando:
          // 1. El zoom aplicado al body (0.8)
          // 2. La relación entre tamaño interno y visual del canvas
          
          // Solución profesional: Ajustar coordenadas considerando el zoom del body
          // 
          // Explicación del problema:
          // - Con zoom 0.8 en el body, todo se muestra 80% del tamaño
          // - El canvas se renderiza a su tamaño interno (canvasWidth x canvasHeight)
          // - Pero se muestra visualmente más pequeño (displayWidth x displayHeight)
          // - Las coordenadas del mouse están en el espacio visual (con zoom)
          // - CanvasJS espera coordenadas en el espacio del canvas interno
          //
          // Solución: Convertir coordenadas visuales a coordenadas del canvas interno
          // 
          // El factor de escala relaciona el tamaño interno con el visual:
          // scale = canvasWidth / displayWidth
          // 
          // Pero displayWidth ya está afectado por el zoom, así que:
          // displayWidth_real = displayWidth / zoomFactor
          // scale = canvasWidth / (displayWidth / zoomFactor) = (canvasWidth * zoomFactor) / displayWidth
          //
          // Sin embargo, CanvasJS ya maneja el scale internamente basándose en displayWidth,
          // así que solo necesitamos compensar el zoom:
          const scaleX = canvasWidth / displayWidth;
          const scaleY = canvasHeight / displayHeight;
          
          // Solución profesional: Ajustar coordenadas considerando el zoom del body
          // 
          // Con zoom 0.8 en el body:
          // - El canvas se muestra 80% del tamaño original visualmente
          // - Las coordenadas del mouse están en el espacio visual (ya afectado por zoom)
          // - CanvasJS calcula coordenadas basándose en el tamaño visual del canvas
          // - Pero el canvas interno mantiene su tamaño original
          //
          // El factor de escala relaciona el tamaño interno con el visual:
          // scaleX = canvasWidth / displayWidth
          // donde displayWidth ya está afectado por el zoom 0.8
          //
          // Para convertir coordenadas visuales a coordenadas del canvas interno:
          // Con zoom 0.8, si haces clic en posición visual 100px, deberías estar en 125px del canvas
          // Fórmula: coordenada_canvas = coordenada_visual / zoomFactor
          // Esto convierte de espacio visual (80%) a espacio real (100%)
          const canvasX = relativeX / zoomFactor;
          const canvasY = relativeY / zoomFactor;
          
          // Modificar el evento para que CanvasJS use las coordenadas correctas
          try {
            Object.defineProperty(e, 'offsetX', { 
              value: canvasX, 
              writable: true,
              configurable: true 
            });
            Object.defineProperty(e, 'offsetY', { 
              value: canvasY, 
              writable: true,
              configurable: true 
            });
          } catch (err) {
            console.debug('No se pudieron ajustar las propiedades del evento:', err);
          }
        };
        
        // Agregar listeners en fase de captura para interceptar antes que CanvasJS
        container.addEventListener('mousedown', adjustMouseEvent, true);
        container.addEventListener('mousemove', adjustMouseEvent, true);
        container.addEventListener('mouseup', adjustMouseEvent, true);
        container.addEventListener('click', adjustMouseEvent, true);
      });
    }, 2000); // Esperar 2 segundos para que las gráficas se rendericen completamente
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
        
        // Verificar si es un error de autenticación (posible reseteo de base de datos)
        if (error.status === 401) {
          console.log('Error 401 en loadAlertas - posible reseteo de base de datos');
          this.authService.handleDatabaseReset();
        }
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

  eliminarAlerta(alerta: Alerta): void {
    // Guardar la página actual antes de eliminar
    const currentPage = this.page;
    
    // Confirmar antes de eliminar
    if (!confirm(`¿Estás seguro de que deseas eliminar la alerta para ${alerta.pcName}?`)) {
      return;
    }
    
    this.alertService.eliminarAlerta(alerta.id).subscribe({
      next: (response) => {
        console.log('Alerta eliminada exitosamente:', response);
        
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
    
    // Mapeo de abreviaciones comunes para sistemas operativos
    const abbreviations: { [key: string]: string } = {
      'MICROSOFT WINDOWS 10 PRO': 'Windows 10 Pro',
      'MICROSOFT WINDOWS 10 HOME': 'Windows 10 Home',
      'MICROSOFT WINDOWS 10': 'Windows 10',
      'MICROSOFT WINDOWS 11 PRO': 'Windows 11 Pro',
      'MICROSOFT WINDOWS 11 HOME': 'Windows 11 Home',
      'MICROSOFT WINDOWS 11': 'Windows 11',
      'MICROSOFT WINDOWS 7 PROFESSIONAL': 'Windows 7 Pro',
      'MICROSOFT WINDOWS 7 HOME': 'Windows 7 Home',
      'MICROSOFT WINDOWS 7': 'Windows 7',
      'MICROSOFT WINDOWS 8.1': 'Windows 8.1',
      'MICROSOFT WINDOWS 8': 'Windows 8',
      'MICROSOFT WINDOWS SERVER 2019': 'Windows Server 2019',
      'MICROSOFT WINDOWS SERVER 2016': 'Windows Server 2016',
      'MICROSOFT WINDOWS SERVER 2022': 'Windows Server 2022',
      'UBUNTU 20.04 LTS': 'Ubuntu 20.04',
      'UBUNTU 22.04 LTS': 'Ubuntu 22.04',
      'UBUNTU 18.04 LTS': 'Ubuntu 18.04',
      'UBUNTU': 'Ubuntu',
      'DEBIAN': 'Debian',
      'CENTOS': 'CentOS',
      'RED HAT ENTERPRISE LINUX': 'RHEL',
      'FEDORA': 'Fedora',
      'MACOS MONTEREY': 'macOS Monterey',
      'MACOS BIG SUR': 'macOS Big Sur',
      'MACOS VENTURA': 'macOS Ventura',
      'MACOS': 'macOS',
      'MAC OS X': 'macOS'
    };
    
    // Buscar coincidencia exacta
    if (abbreviations[nameUpper]) {
      return abbreviations[nameUpper];
    }
    
    // Si no hay coincidencia exacta, intentar abreviar nombres largos
    if (name.length > 15) {
      // Para nombres muy largos, tomar las primeras palabras importantes
      const words = name.split(/\s+/);
      if (words.length > 2) {
        // Tomar las primeras 2-3 palabras más importantes
        const importantWords = words.slice(0, 2);
        const abbreviation = importantWords.join(' ');
        if (abbreviation.length <= 15) {
          return abbreviation;
        }
      }
      
      // Si no se puede abreviar por palabras, truncar
      return name.substring(0, 12) + '...';
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

  async actualizarDispositivos(): Promise<void> {
    // Verificar permisos antes de proceder
    if (!this.permissionsService.canUpdateNetworkDevices()) {
      this.notificationService.showError(
        'Permisos Insuficientes', 
        'No tienes permisos para actualizar dispositivos de red. Solo los administradores y Game Masters pueden realizar esta acción.'
      );
      return;
    }

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
            toolTipContent: `${type}: ${realValue}`,
            indexLabel: `${type}: ${realValue}`, // Mostrar "Nombre: Número"
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

  canUpdateDevices(): boolean {
    return this.permissionsService.canUpdateNetworkDevices();
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
