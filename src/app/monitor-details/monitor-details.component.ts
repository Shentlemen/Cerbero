import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-monitor-details',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="monitorData">
      <h4 class="text-secondary">{{ title }}</h4>
      <ul class="list-group list-group-flush">
        <li class="list-group-item"><i class="fas fa-tag me-2"></i><strong>Nombre:</strong> {{ monitorData.caption }}</li>
        <li class="list-group-item"><i class="fas fa-info-circle me-2"></i><strong>Descripción:</strong> {{ monitorData.description }}</li>
        <li class="list-group-item"><i class="fas fa-microchip me-2"></i><strong>ID de Hardware:</strong> {{ monitorData.hardwareId }}</li>
        <li class="list-group-item"><i class="fas fa-fingerprint me-2"></i><strong>ID:</strong> {{ monitorData.id }}</li>
        <li class="list-group-item"><i class="fas fa-industry me-2"></i><strong>Fabricante:</strong> {{ monitorData.manufacturer }}</li>
        <li class="list-group-item"><i class="fas fa-barcode me-2"></i><strong>Número de serie:</strong> {{ monitorData.serial }}</li>
        <li class="list-group-item"><i class="fas fa-desktop me-2"></i><strong>Tipo:</strong> {{ monitorData.type }}</li>
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
export class MonitorDetailsComponent implements OnChanges {
  @Input() monitorData: any;
  @Input() index: number = 0;
  title: string = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['monitorData'] && this.monitorData) {
      console.log('Datos de Monitor recibidos:', this.monitorData);
      this.title = `Monitor ${this.index + 1}`;
    }
  }
}
