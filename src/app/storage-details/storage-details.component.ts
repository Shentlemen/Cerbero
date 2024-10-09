import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-storage-details',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="storageData">
      <h4 class="text-secondary">Información de Almacenamiento</h4>
      <ul class="list-group list-group-flush">
        <li class="list-group-item"><i class="fas fa-info-circle me-2"></i><strong>Descripción:</strong> {{ storageData.description }}</li>
        <li class="list-group-item"><i class="fas fa-hdd me-2"></i><strong>Tamaño del disco:</strong> {{ storageData.diskSize }} GB</li>
        <li class="list-group-item"><i class="fas fa-microchip me-2"></i><strong>Firmware:</strong> {{ storageData.firmware }}</li>
        <li class="list-group-item"><i class="fas fa-fingerprint me-2"></i><strong>ID de Hardware:</strong> {{ storageData.hardwareId }}</li>
        <li class="list-group-item"><i class="fas fa-id-badge me-2"></i><strong>ID:</strong> {{ storageData.id }}</li>
        <li class="list-group-item"><i class="fas fa-industry me-2"></i><strong>Fabricante:</strong> {{ storageData.manufacturer }}</li>
        <li class="list-group-item"><i class="fas fa-cube me-2"></i><strong>Modelo:</strong> {{ storageData.model }}</li>
        <li class="list-group-item"><i class="fas fa-tag me-2"></i><strong>Nombre:</strong> {{ storageData.name }}</li>
        <li class="list-group-item"><i class="fas fa-barcode me-2"></i><strong>Número de serie:</strong> {{ storageData.serialNumber }}</li>
        <li class="list-group-item"><i class="fas fa-database me-2"></i><strong>Tipo:</strong> {{ storageData.type }}</li>
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
export class StorageDetailsComponent implements OnChanges {
  @Input() storageData: any;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['storageData'] && this.storageData) {
      console.log('Datos de Almacenamiento recibidos:', this.storageData);
    }
  }
}
