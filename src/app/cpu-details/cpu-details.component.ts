import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cpu-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cpu-details.component.html',
  styleUrls: ['./cpu-details.component.css']
})
export class CpuDetailsComponent implements OnChanges {
  @Input() cpuData: any;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['cpuData'] && this.cpuData) {
      console.log('Datos de CPU recibidos:', this.cpuData);
    }
  }
}
