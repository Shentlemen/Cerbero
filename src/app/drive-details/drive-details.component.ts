import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-drive-details',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="driveData">
      <h4 class="text-secondary">Información de la Unidad</h4>
      <ul class="list-group list-group-flush">
        <li class="list-group-item"><i class="fas fa-microchip me-2"></i><strong>ID:</strong> {{ driveData.id }}</li>
        <li class="list-group-item"><i class="fas fa-fingerprint me-2"></i><strong>ID de Hardware:</strong> {{ driveData.hardwareId }}</li>
        <li class="list-group-item"><i class="fas fa-font me-2"></i><strong>Letra:</strong> {{ driveData.letter }}</li>
        <li class="list-group-item"><i class="fas fa-hdd me-2"></i><strong>Tipo:</strong> {{ driveData.type }}</li>
        <li class="list-group-item"><i class="fas fa-folder me-2"></i><strong>Sistema de archivos:</strong> {{ driveData.filesystem }}</li>
        <li class="list-group-item"><i class="fas fa-database me-2"></i><strong>Capacidad total:</strong> {{ driveData.total | number }} bytes</li>
        <li class="list-group-item"><i class="fas fa-chart-pie me-2"></i><strong>Espacio libre:</strong> {{ driveData.free | number }} bytes</li>
        <li class="list-group-item"><i class="fas fa-file me-2"></i><strong>Número de archivos:</strong> {{ driveData.numFiles | number }}</li>
        <li class="list-group-item"><i class="fas fa-tag me-2"></i><strong>Nombre del volumen:</strong> {{ driveData.volumn }}</li>
        <li class="list-group-item"><i class="fas fa-calendar-alt me-2"></i><strong>Fecha de creación:</strong> {{ driveData.createDate | date:'medium' }}</li>
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
export class DriveDetailsComponent implements OnChanges {
  @Input() driveData: any;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['driveData'] && this.driveData) {
      console.log('Datos de Unidad recibidos:', this.driveData);
    }
  }
}
