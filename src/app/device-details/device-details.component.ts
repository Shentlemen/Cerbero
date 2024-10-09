import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-device-details',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="deviceData">
      <h4 class="text-secondary">Información del Dispositivo</h4>
      <ul class="list-group list-group-flush">
        <li class="list-group-item"><i class="fas fa-comment me-2"></i><strong>Comentarios:</strong> {{ deviceData.comments }}</li>
        <li class="list-group-item"><i class="fas fa-id-badge me-2"></i><strong>ID:</strong> {{ deviceData.id }}</li>
        <li class="list-group-item"><i class="fas fa-fingerprint me-2"></i><strong>ID de Hardware:</strong> {{ deviceData.hardwareId }}</li>
        <li class="list-group-item"><i class="fas fa-sort-numeric-up me-2"></i><strong>Valor Entero:</strong> {{ deviceData.ivalue }}</li>
        <li class="list-group-item"><i class="fas fa-tag me-2"></i><strong>Nombre:</strong> {{ deviceData.name }}</li>
        <li class="list-group-item"><i class="fas fa-font me-2"></i><strong>Valor de Texto:</strong> {{ deviceData.tvalue }}</li>
      </ul>
    </div>
  `,
  styles: [`
    .list-group-item {
      background-color: #f9f9f9;
      border: 1px solid #dddddd;
      margin-bottom: 5px;
      border-radius: 5px;
      padding: 0.5rem;
      word-break: break-word;
    }
    .list-group-item strong {
      color: #5a9bd5;
    }
  `]
})
export class DeviceDetailsComponent {
  @Input() deviceData: any;
}
