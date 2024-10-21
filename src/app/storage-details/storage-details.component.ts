import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-storage-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './storage-details.component.html',
  styleUrls: ['./storage-details.component.css']
})
export class StorageDetailsComponent implements OnChanges {
  @Input() storageData: any;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['storageData'] && this.storageData) {
      console.log('Datos de Almacenamiento recibidos:', this.storageData);
    }
  }
}
