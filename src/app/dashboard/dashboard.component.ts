import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { BiosService } from '../services/bios.service';
import { CanvasJSAngularChartsModule } from '@canvasjs/angular-charts';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AlertService, Alerta } from '../services/alert.service';
import { finalize } from 'rxjs/operators';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';

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
    RouterModule
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
    private networkInfoService: NetworkInfoService
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
            dataPoints: typeData,
            click: this.onChartPointClick.bind(this, 'terminales'),
            indexLabelFontSize: this.getResponsiveFontSize(13)
          }]
        };

        this.barChartOptions = {
          ...commonOptions,
          title: { 
            ...commonOptions.title,
            text: "Fabricante" 
          },
          axisY: { 
            title: "Cantidad",
            titleFontSize: this.getResponsiveFontSize(12),
            labelFontSize: this.getResponsiveFontSize(11),
            minimum: 0
          },
          data: [{
            ...commonOptions.data[0],
            type: "column",
            dataPoints: brandData.map(d => {
              const realY = d.y;
              return {
                ...d,
                y: realY < 5 ? 5 : realY,
                toolTipContent: `${d.label}: ${realY}`,
                indexLabel: String(realY)
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
        console.log('Alertas recibidas:', alertas);
        this.alerts = alertas;
      },
      error => {
        console.error('Error al cargar las alertas', error);
      }
    );
  }

  confirmarAlerta(alerta: Alerta): void {
    this.alertService.confirmarAlerta(alerta.id).subscribe({
      next: (response) => {
        console.log('Alerta confirmada exitosamente:', response);
        this.loadAlertas();
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
    const counts = hardware.reduce((acc: Record<string, number>, curr) => {
      const biosData = biosMap.get(curr.id);
      const type = biosData?.type?.toUpperCase() || 'DESCONOCIDO';
      
      if (!acc[type]) {
        acc[type] = 0;
      }
      acc[type]++;
      
      return acc;
    }, {});

    return Object.entries(counts).map(([label, y]) => ({ label, y }));
  }

  private prepareChartData(array: any[], prop: string): any[] {
    const counts = this.countByProperty(array, prop);
    return Object.entries(counts).map(([label, y]) => ({ label, y }));
  }

  private prepareBrandData(biosData: any[]): any[] {
    const counts = this.countByProperty(biosData, 'smanufacturer');
    console.log('Brand counts:', counts); // Agrega este log para verificar los valores
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
    
    this.isChecking = true;
    this.alertService.checkHardwareChanges().pipe(
      finalize(() => {
        this.isChecking = false;
      })
    ).subscribe({
      next: () => {
        // Recargar alertas después de verificar cambios
        this.loadAlertas();
      },
      error: (error) => {
        console.error('Error al verificar cambios:', error);
        // Aquí puedes mostrar un mensaje al usuario usando un servicio de notificaciones
        // o un componente de toast/snackbar
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
    console.log('Datos de red recibidos:', networkData);
    
    // Asegurarnos de que networkData sea un array
    const networkArray = Array.isArray(networkData) ? networkData : [];
    console.log('Array de red procesado:', networkArray);
    
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

    console.log('Dispositivos agrupados por tipo:', devicesByType);

    const dataPoints = Object.entries(devicesByType).map(([type, devices]) => ({
      label: type,
      y: devices.length,
      indexLabel: `${type}: {y}`
    }));

    console.log('Puntos de datos para la gráfica:', dataPoints);

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
}
