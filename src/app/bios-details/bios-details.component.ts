import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-bios-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bios-details.component.html',
  styleUrls: ['./bios-details.component.css']
})
export class BiosDetailsComponent implements OnChanges {
  @Input() biosData: any;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['biosData'] && this.biosData) {
      console.log('Datos de BIOS recibidos:', this.biosData);
    }
  }
}
