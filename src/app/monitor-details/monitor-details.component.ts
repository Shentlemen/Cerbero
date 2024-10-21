import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-monitor-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monitor-details.component.html',
  styleUrls: ['./monitor-details.component.css']
})
export class MonitorDetailsComponent implements OnChanges {
  @Input() monitorData: any;
  @Input() index: number = 0;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['monitorData'] && this.monitorData) {
      console.log(`Datos del Monitor ${this.index + 1} recibidos:`, this.monitorData);
    }
  }
}
