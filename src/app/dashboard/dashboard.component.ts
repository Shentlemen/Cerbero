import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { BiosService } from '../services/bios.service'; // Asegúrate de crear este servicio
import { CanvasJSAngularChartsModule } from '@canvasjs/angular-charts';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

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
  alerts: any[] = [
    { type: 'warning', message: 'Cambio detectado en la RAM: 8GB a 16GB', date: '2023-11-15', pc: 'PC14587' },
    { type: 'warning', message: 'Cambio detectado en la tarjeta de video: NVIDIA GTX 1060 a RTX 3070', date: '2023-11-14', pc: 'PC18932' },
    { type: 'danger', message: 'Disco duro al 85% de capacidad', date: '2023-11-13', pc: 'PC20145' },
    { type: 'info', message: 'Cambio de IP detectado: 192.168.1.100 a 192.168.1.150', date: '2023-11-12', pc: 'PC15678' },
    { type: 'warning', message: 'Cambio detectado en el procesador: Intel i5 a Intel i7', date: '2023-11-11', pc: 'PC17234' }
  ];

  constructor(
    private hardwareService: HardwareService,
    private biosService: BiosService, // Inyecta el nuevo servicio
    private router: Router
  ) {}

  ngOnInit() {
    forkJoin({
      hardware: this.hardwareService.getHardware(),
      bios: this.biosService.getAllBios()
    }).subscribe(
      ({ hardware, bios }) => {
        console.log('Datos de hardware:', hardware);
        console.log('Datos de BIOS:', bios);

        // Preparar datos para las gráficas
        const typeData = this.prepareHardwareTypeData(hardware);
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
        console.error('Error al cargar los datos', error);
      }
    );
  }

  private prepareHardwareTypeData(hardware: any[]): any[] {
    const typeMap: Record<string, string> = { '1': 'PC', '2': 'MINI PC', '3': 'LAPTOP', '4': 'Tablet' };

    const counts = hardware.reduce((acc: Record<string, number>, curr) => {
      const type = typeMap[curr.type as keyof typeof typeMap] || 'Desconocido';
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
