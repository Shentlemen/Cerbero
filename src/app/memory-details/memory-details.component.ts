import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-memory-details',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="memoryData">
      <h4 class="text-secondary">{{ title }}</h4>
      <ul class="list-group list-group-flush">
        <li class="list-group-item"><i class="fas fa-memory me-2"></i><strong>Capacidad:</strong> {{ memoryData.capacity | number }} MB</li>
        <li class="list-group-item"><i class="fas fa-info-circle me-2"></i><strong>Descripción breve:</strong> {{ memoryData.caption }}</li>
        <li class="list-group-item"><i class="fas fa-align-left me-2"></i><strong>Descripción detallada:</strong> {{ memoryData.description }}</li>
        <li class="list-group-item"><i class="fas fa-id-card me-2"></i><strong>ID de Hardware:</strong> {{ memoryData.hardwareId }}</li>
        <li class="list-group-item"><i class="fas fa-puzzle-piece me-2"></i><strong>Número de slots:</strong> {{ memoryData.numSlots }}</li>
        <li class="list-group-item"><i class="fas fa-tasks me-2"></i><strong>Propósito:</strong> {{ memoryData.purpose }}</li>
        <li class="list-group-item"><i class="fas fa-barcode me-2"></i><strong>Número de serie:</strong> {{ memoryData.serialNumber }}</li>
        <li class="list-group-item"><i class="fas fa-tachometer-alt me-2"></i><strong>Velocidad:</strong> {{ memoryData.speed }} MHz</li>
        <li class="list-group-item"><i class="fas fa-microchip me-2"></i><strong>Tipo:</strong> {{ memoryData.type }}</li>
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
export class MemoryDetailsComponent implements OnChanges {
  @Input() memoryData: any;
  @Input() index: number = 0;
  title: string = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['memoryData'] && this.memoryData) {
      console.log('Datos de Memoria recibidos:', this.memoryData);
      this.title = `Memoria ${this.index + 1}`;
    }
  }
}
