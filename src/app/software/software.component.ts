import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SoftwareService, SoftwareDTO } from '../services/software.service';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-software',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule
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
  searchTerm: string = '';
  private searchSubject = new Subject<string>();

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
      
      const matchesVisibility = this.showHidden || !software.hidden;
      
      return matchesSearch && matchesVisibility;
    });
  }

  filterSoftware(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  toggleHiddenSoftware(): void {
    this.showHidden = !this.showHidden;
    this.updateFilteredList();
  }

  toggleSoftwareVisibility(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();
    this.loading = true;
    this.errorMessage = null;

    this.softwareService.toggleSoftwareVisibility(software, !software.hidden).subscribe({
      next: (updatedSoftware) => {
        const index = this.softwareList.findIndex(s => s.idSoftware === software.idSoftware);
        if (index !== -1) {
          this.softwareList[index] = updatedSoftware;
          this.updateFilteredList();
        }
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = 'Error al actualizar la visibilidad: ' + error.message;
        this.loading = false;
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
