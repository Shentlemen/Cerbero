import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-details.component.html',
  styleUrls: ['./video-details.component.css']
})
export class VideoDetailsComponent implements OnChanges {
  @Input() videoData: any;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['videoData'] && this.videoData) {
      console.log('Datos de Video recibidos:', this.videoData);
    }
  }

  getMemoryInMB(memory: string): number {
    // Remueve cualquier texto no numérico y convierte a número
    const memoryValue = parseFloat(memory.replace(/[^\d.-]/g, ''));
    return isNaN(memoryValue) ? 0 : memoryValue;
  }
}
