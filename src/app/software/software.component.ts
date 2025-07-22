import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SoftwareService, SoftwareDTO } from '../services/software.service';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-software',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    NgbPaginationModule
  ],
  templateUrl: './software.component.html',
  styleUrls: ['./software.component.css']
})
export class SoftwareComponent implements OnInit {
  softwareList: SoftwareDTO[] = [];
  filteredSoftwareList: SoftwareDTO[] = [];
  loading: boolean = true;
  errorMessage: string | null = null;
  showHidden: boolean = false;
  showOnlyHidden: boolean = false;
  showOnlyForbidden: boolean = false;
  searchTerm: string = '';
  private searchSubject = new Subject<string>();
  activeTab: 'total' | 'hidden' | 'forbidden' = 'total';
  page: number = 1;
  pageSize: number = 10;
  collectionSize: number = 0;

  constructor(
    private softwareService: SoftwareService,
    private router: Router
  ) {
    // Configurar el filtrado reactivo
    this.searchSubject.pipe(
      debounceTime(300), // Espera 300ms después de que el usuario deje de escribir
      distinctUntilChanged() // Solo emite si el valor cambió
    ).subscribe(term => {
      this.searchTerm = term;
      this.updateFilteredList();
    });
  }

  ngOnInit(): void {
    this.loadSoftware();
  }

  get pagedSoftwareList(): SoftwareDTO[] {
    const start = (this.page - 1) * this.pageSize;
    const end = this.page * this.pageSize;
    return this.filteredSoftwareList.slice(start, end);
  }

  get totalSoftware(): number {
    return this.softwareList.length;
  }

  loadSoftware(): void {
    this.loading = true;
    this.errorMessage = null;

    this.softwareService.getSoftwareWithCounts().subscribe({
      next: (data) => {
        this.softwareList = data;
        this.updateFilteredList();
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar el software: ' + error.message;
        this.loading = false;
      }
    });
  }

  updateFilteredList(): void {
    if (!this.softwareList) {
      this.filteredSoftwareList = [];
      this.collectionSize = 0;
      return;
    }

    this.filteredSoftwareList = this.softwareList.filter(software => {
      if (!software) return false;

      const searchTermLower = (this.searchTerm || '').toLowerCase();
      const nombre = (software.nombre || '').toLowerCase();
      const publisher = (software.publisher || '').toLowerCase();

      const matchesSearch = !searchTermLower || 
        nombre.includes(searchTermLower) ||
        publisher.includes(searchTermLower);

      if (this.activeTab === 'hidden') {
        return matchesSearch && !!software.hidden;
      } else if (this.activeTab === 'forbidden') {
        return matchesSearch && !!software.forbidden;
      } else if (this.activeTab === 'total') {
        // Solo los que no están ni prohibidos ni escondidos
        return matchesSearch && !software.hidden && !software.forbidden;
      }
      return matchesSearch;
    });
    this.collectionSize = this.filteredSoftwareList.length;
    this.page = 1;
  }

  filterSoftware(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  showTotalSoftware(): void {
    this.activeTab = 'total';
    this.updateFilteredList();
  }

  showOnlyHiddenSoftware(): void {
    this.activeTab = 'hidden';
    this.updateFilteredList();
  }

  showOnlyForbiddenSoftware(): void {
    this.activeTab = 'forbidden';
    this.updateFilteredList();
  }

  toggleSoftwareVisibility(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();
    this.errorMessage = null;

    // Actualización optimista
    const prevHidden = software.hidden;
    software.hidden = !software.hidden;
    this.updateFilteredList();

    this.softwareService.toggleSoftwareVisibility(software, software.hidden).subscribe({
      next: (updatedSoftware) => {
        const index = this.softwareList.findIndex(s => s.idSoftware === software.idSoftware);
        if (index !== -1) {
          this.softwareList[index] = updatedSoftware;
          this.updateFilteredList();
        }
      },
      error: (error) => {
        software.hidden = prevHidden; // revertir si falla
        this.updateFilteredList();
        this.errorMessage = 'Error al actualizar la visibilidad: ' + error.message;
      }
    });
  }

  toggleSoftwareForbidden(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();
    this.errorMessage = null;

    // Actualización optimista
    const prevForbidden = software.forbidden;
    software.forbidden = !software.forbidden;
    this.updateFilteredList();

    this.softwareService.toggleSoftwareForbidden(software).subscribe({
      next: (updatedSoftware) => {
        const index = this.softwareList.findIndex(s => s.idSoftware === software.idSoftware);
        if (index !== -1) {
          // Siempre conservar el count anterior
          const count = this.softwareList[index].count;
          this.softwareList[index] = { ...updatedSoftware, count };
          this.updateFilteredList();
        }
      },
      error: (error) => {
        software.forbidden = prevForbidden; // revertir si falla
        this.updateFilteredList();
        this.errorMessage = 'Error al actualizar el estado prohibido: ' + error.message;
      }
    });
  }

  navigateToAssets(software: SoftwareDTO): void {
    this.router.navigate(['/menu/assets'], { 
      queryParams: { 
        softwareId: software.idSoftware,
        softwareName: software.nombre
      }
    });
  }
}
