import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cpu-details',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="cpuData">
      <h4 class="text-secondary">Información de CPU</h4>
      <ul class="list-group list-group-flush">
        <li class="list-group-item"><i class="fas fa-microchip me-2"></i><strong>ID:</strong> {{ cpuData.id }}</li>
        <li class="list-group-item"><i class="fas fa-fingerprint me-2"></i><strong>ID de Hardware:</strong> {{ cpuData.hardwareId }}</li>
        <li class="list-group-item"><i class="fas fa-industry me-2"></i><strong>Fabricante:</strong> {{ cpuData.manufacturer }}</li>
        <li class="list-group-item"><i class="fas fa-cogs me-2"></i><strong>Tipo:</strong> {{ cpuData.type }}</li>
        <li class="list-group-item"><i class="fas fa-barcode me-2"></i><strong>Número de Serie:</strong> {{ cpuData.serialNumber }}</li>
        <li class="list-group-item"><i class="fas fa-tachometer-alt me-2"></i><strong>Velocidad:</strong> {{ cpuData.speed }}</li>
        <li class="list-group-item"><i class="fas fa-layer-group me-2"></i><strong>Núcleos:</strong> {{ cpuData.cores }}</li>
        <li class="list-group-item"><i class="fas fa-memory me-2"></i><strong>Tamaño de Caché L2:</strong> {{ cpuData.l2CacheSize }}</li>
        <li class="list-group-item"><i class="fas fa-microchip me-2"></i><strong>Arquitectura:</strong> {{ cpuData.cpuArch }}</li>
        <li class="list-group-item"><i class="fas fa-ruler me-2"></i><strong>Ancho de Datos:</strong> {{ cpuData.dataWidth }}</li>
        <li class="list-group-item"><i class="fas fa-ruler-combined me-2"></i><strong>Ancho de Dirección Actual:</strong> {{ cpuData.currentAddressWidth }}</li>
        <li class="list-group-item"><i class="fas fa-sitemap me-2"></i><strong>CPUs Lógicas:</strong> {{ cpuData.logicalCpus }}</li>
        <li class="list-group-item"><i class="fas fa-bolt me-2"></i><strong>Voltaje:</strong> {{ cpuData.voltage }}</li>
        <li class="list-group-item"><i class="fas fa-tachometer-alt me-2"></i><strong>Velocidad Actual:</strong> {{ cpuData.currentSpeed }}</li>
        <li class="list-group-item"><i class="fas fa-plug me-2"></i><strong>Socket:</strong> {{ cpuData.socket }}</li>
      </ul>
    </div>
  `,
  styles: [`
    .text-secondary {
      color: #5a9bd5 !important;
      font-size: 1rem;
      margin-top: 0;
      margin-bottom: 1rem;
      border-bottom: 2px solid #85c1e9;
      padding-bottom: 0.5rem;
    }
    .list-group-item {
      background-color: #f9f9f9;
      border: 1px solid #dddddd;
      margin-bottom: 5px;
      border-radius: 5px;
      padding: 0.5rem;
      word-break: break-word;
      font-size: 0.9rem;
    }
    .list-group-item strong {
      color: #5a9bd5;
    }
  `]
})
export class CpuDetailsComponent implements OnChanges {
  @Input() cpuData: any;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['cpuData'] && this.cpuData) {
      console.log('Datos de CPU recibidos:', this.cpuData);
    }
  }
}
