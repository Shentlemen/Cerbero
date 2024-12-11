import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SoftwareService, SoftwareDTO } from '../services/software.service';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-software',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './software.component.html',
  styleUrls: ['./software.component.css']
})
export class SoftwareComponent implements OnInit {
  softwareList: SoftwareDTO[] = [];
  totalSoftware: number = 0;
  showHidden: boolean = false;
  filteredSoftwareList: SoftwareDTO[] = [];

  constructor(
    private softwareService: SoftwareService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadSoftware();
  }

  loadSoftware(): void {
    this.softwareService.getSoftwareWithCounts().subscribe({
      next: (data) => {
        this.softwareList = data;
        this.filterSoftwareList();
      },
      error: (error) => {
        console.error('Error al cargar el software:', error);
      }
    });
  }

  filterSoftwareList(): void {
    this.filteredSoftwareList = this.softwareList.filter(software => 
      this.showHidden || !software.hidden
    );
    this.totalSoftware = this.filteredSoftwareList.length;
  }

  toggleHiddenSoftware(): void {
    this.showHidden = !this.showHidden;
    this.filterSoftwareList();
  }

  toggleSoftwareVisibility(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();
    const newHiddenState = !software.hidden;
    
    this.softwareService.toggleSoftwareVisibility(software, newHiddenState).subscribe({
      next: () => {
        software.hidden = newHiddenState;
        this.filterSoftwareList();
      },
      error: (error) => {
        console.error('Error al cambiar visibilidad:', error);
      }
    });
  }

  navigateToAssets(software: SoftwareDTO): void {
    this.softwareService.getHardwaresBySoftware(software).subscribe({
      next: (hardwareIds) => {
        this.router.navigate(['/menu/assets'], {
          queryParams: {
            filterType: 'software',
            filterValue: JSON.stringify({
              name: software.name,
              publisher: software.publisher,
              version: software.version
            })
          }
        });
      },
      error: (error) => {
        console.error('Error al obtener hardware IDs:', error);
      }
    });
  }
}
