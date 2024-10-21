import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-drive-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './drive-details.component.html',
  styleUrls: ['./drive-details.component.css']
})
export class DriveDetailsComponent implements OnChanges {
  @Input() driveData: any;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['driveData'] && this.driveData) {
      console.log('Datos de Unidad recibidos:', this.driveData);
    }
  }
}
