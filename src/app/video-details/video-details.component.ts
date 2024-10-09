import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-details',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="videoData">
      <h4 class="text-secondary">Información de Tarjeta de Video</h4>
      <ul class="list-group list-group-flush">
        <li class="list-group-item"><i class="fas fa-microchip me-2"></i><strong>Chipset:</strong> {{ videoData.chipset || 'N/A' }}</li>
        <li class="list-group-item"><i class="fas fa-fingerprint me-2"></i><strong>ID de Hardware:</strong> {{ videoData.hardwareId || 'N/A' }}</li>
        <li class="list-group-item"><i class="fas fa-id-badge me-2"></i><strong>ID:</strong> {{ videoData.id || 'N/A' }}</li>
        <li class="list-group-item"><i class="fas fa-memory me-2"></i><strong>Memoria:</strong> {{ videoData.memory ? (videoData.memory + ' MB') : 'N/A' }}</li>
        <li class="list-group-item"><i class="fas fa-tag me-2"></i><strong>Nombre:</strong> {{ videoData.name || 'N/A' }}</li>
        <li class="list-group-item"><i class="fas fa-desktop me-2"></i><strong>Resolución:</strong> {{ videoData.resolution || 'N/A' }}</li>
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
export class VideoDetailsComponent implements OnChanges {
  @Input() videoData: any;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['videoData'] && this.videoData) {
      console.log('Datos de Video recibidos:', this.videoData);
    }
  }
}
