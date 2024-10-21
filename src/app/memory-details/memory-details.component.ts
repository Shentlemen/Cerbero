import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-memory-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './memory-details.component.html',
  styleUrls: ['./memory-details.component.css']
})
export class MemoryDetailsComponent implements OnChanges {
  @Input() memoryData: any;
  @Input() index: number = 0;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['memoryData'] && this.memoryData) {
      console.log(`Datos de Memoria ${this.index + 1} recibidos:`, this.memoryData);
    }
  }
}
