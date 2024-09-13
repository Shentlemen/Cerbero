import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HwService } from '../hw.service';
import { CanvasJSAngularChartsModule } from '@canvasjs/angular-charts';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CanvasJSAngularChartsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  pieChartOptions: any;
  barChartOptions: any;
  pieChartOptions2: any;

  constructor(private hwService: HwService, private router: Router) {}

  ngOnInit() {
    const assets = this.hwService.getHardware();
    
    // Preparar datos para las gráficas
    const typeData = this.prepareChartData(assets, 'TYPE');
    const brandData = this.prepareChartData(assets, 'marca');
    const osData = this.prepareChartData(assets, 'OSNAME');

    // Configuración común para las gráficas
    const commonOptions = {
      animationEnabled: true,
      exportEnabled: true,
      theme: "light2",
    };

    this.pieChartOptions = {
      ...commonOptions,
      data: [{
        type: "pie",
        indexLabel: "{label}: {y}",
        startAngle: -90,
        dataPoints: typeData,
        click: this.onChartPointClick.bind(this, 'TYPE')
      }]
    };

    this.barChartOptions = {
      ...commonOptions,
      axisY: { title: "Cantidad" },
      data: [{
        type: "column",
        dataPoints: brandData,
        click: this.onChartPointClick.bind(this, 'marca')
      }]
    };

    this.pieChartOptions2 = {
      ...commonOptions,
      data: [{
        type: "pie",
        indexLabel: "{label}: {y}",
        startAngle: 0,
        dataPoints: osData,
        click: this.onChartPointClick.bind(this, 'OSNAME')
      }]
    };
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
