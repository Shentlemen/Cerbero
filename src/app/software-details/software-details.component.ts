import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SoftwareDTO } from '../services/software.service';

@Component({
  selector: 'app-software-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './software-details.component.html',
  styleUrls: ['./software-details.component.css']
})
export class SoftwareDetailsComponent {
  @Input() softwareData: SoftwareDTO[] = [];

  get softwareDataSorted(): SoftwareDTO[] {
    return [...(this.softwareData || [])].sort((a, b) =>
      (a?.nombre || '').localeCompare(b?.nombre || '', 'es', {
        sensitivity: 'base'
      })
    );
  }
} 