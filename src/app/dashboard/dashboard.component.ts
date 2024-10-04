import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { CanvasJSAngularChartsModule } from '@canvasjs/angular-charts';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CanvasJSAngularChartsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  pieChartOptions: any;
  barChartOptions: any;
  pieChartOptions2: any;

  constructor(private hardwareService: HardwareService, private router: Router) {}

  ngOnInit() {
    this.hardwareService.getHardware().subscribe(
      (assets: any[]) => {
        console.log('Datos recibidos:', assets); // Log para depuración

        // Preparar datos para las gráficas
        const typeData = this.prepareChartData(assets, 'type');
        const brandData = this.prepareChartData(assets, 'marca');
        const osData = this.prepareChartData(assets, 'osName');

        console.log('Datos preparados:', { typeData, brandData, osData }); // Log para depuración

        // Configuración común para las gráficas
        const commonOptions = {
          animationEnabled: true,
          exportEnabled: true,
          theme: "light2",
        };

        this.pieChartOptions = {
          ...commonOptions,
          title: { text: "Tipos de PC" },
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
          title: { text: "Marcas de PC" },
          axisY: { title: "Cantidad" },
          data: [{
            type: "column",
            dataPoints: brandData,
            click: this.onChartPointClick.bind(this, 'marca')
          }]
        };

        this.pieChartOptions2 = {
          ...commonOptions,
          title: { text: "Sistemas Operativos" },
          data: [{
            type: "pie",
            indexLabel: "{label}: {y}",
            startAngle: 0,
            dataPoints: osData,
            click: this.onChartPointClick.bind(this, 'osName')
          }]
        };
      },
      (error) => {
        console.error('Error al cargar los datos del hardware', error);
      }
    );
  }

  private prepareChartData(array: any[], prop: string): any[] {
    const counts = this.countByProperty(array, prop);
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
}
