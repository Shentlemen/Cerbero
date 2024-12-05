import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { BiosService } from '../services/bios.service';
import { CanvasJSAngularChartsModule } from '@canvasjs/angular-charts';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AlertService, Alerta } from '../services/alert.service';
import { finalize } from 'rxjs/operators';
import { NetworkInfoService } from '../services/network-info.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CanvasJSAngularChartsModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
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

  ngOnInit(): void {
    this.loadAlertas();
    forkJoin({
      hardware: this.hardwareService.getHardware(),
      bios: this.biosService.getAllBios(),
      network: this.networkInfoService.getNetworkInfo()
    }).subscribe(
      ({ hardware, bios, network }) => {
        // Crear un mapa de hardware a BIOS
        const biosMap = new Map(bios.map(b => [b.hardwareId, b]));
        
        // Preparar datos para las gráficas usando el tipo de BIOS
        const typeData = this.prepareHardwareTypeData(hardware, biosMap);
        const brandData = this.prepareBrandData(bios);
        const osData = this.prepareChartData(hardware, 'osName');

        console.log('Datos preparados:', { typeData, brandData, osData });

        // Configuración común para las gráficas
        const commonOptions = {
          animationEnabled: true,
          exportEnabled: true,
          theme: "light2",
        };

        this.pieChartOptions = {
          ...commonOptions,
          title: { text: "Terminales" },
          data: [{
            type: "pie",
            indexLabel: "{label}: {y}",
            startAngle: -90,
            dataPoints: typeData,
            click: this.onChartPointClick.bind(this, 'type')
          }]
        };

        this.barChartOptions = {
          ...commonOptions,
          title: { text: "Fabricante" },
          axisY: { title: "Cantidad" },
          data: [{
            type: "column",
            dataPoints: brandData,
            click: this.onChartPointClick.bind(this, 'marca')
          }]
        };

        this.pieChartOptions2 = {
          ...commonOptions,
          title: { text: "S.O." },
          data: [{
            type: "pie",
            indexLabel: "{label}: {y}",
            startAngle: 0,
            dataPoints: osData,
            click: this.onChartPointClick.bind(this, 'osName')
          }]
        };

        this.prepareNetworkChart(network);
      },
      (error) => {
        console.error('Error al cargar los datos', error);
      }
    );
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
    this.router.navigate(['/menu/assets'], { 
      queryParams: { filterType, filterValue }
    });
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
    console.log('Navegando a detalles del asset:', hardwareId);
    this.router.navigate(['/menu/asset-details', hardwareId])
      .then(() => {
        console.log('Navegación completada');
      })
      .catch(err => {
        console.error('Error en la navegación:', err);
      });
  }

  private prepareNetworkChart(networkData: any[]): void {
    const devicesByType = networkData.reduce((acc: Record<string, any[]>, device: any) => {
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
      animationEnabled: true,
      theme: "light2",
      title: {
        text: "Dispositivos"
      },
      data: [{
        type: "pie",
        startAngle: -90,
        indexLabelFontSize: 16,
        showInLegend: true,
        toolTipContent: "{label}: <strong>{y}</strong>",
        dataPoints: dataPoints
      }]
    };
  }
}
