import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SoftwareDTO } from '../services/software.service';

@Component({
  selector: 'app-software-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './software-details.component.html',
  styleUrls: ['./software-details.component.css']
})
export class SoftwareDetailsComponent implements OnChanges {
  @Input() softwareData: SoftwareDTO[] = [];
  /** Solo se reordena al cambiar datos; antes el getter ordenaba en cada CD y trababa pestaña Software/tour. */
  softwareDataSorted: SoftwareDTO[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['softwareData']) {
      return;
    }
    const raw = this.softwareData || [];
    this.softwareDataSorted = [...raw].sort((a, b) =>
      (a?.nombre || '').localeCompare(b?.nombre || '', 'es', {
        sensitivity: 'base'
      })
    );
  }
}
