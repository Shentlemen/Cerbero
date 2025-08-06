import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SoftwareService, SoftwareDTO } from '../services/software.service';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { Subject, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { PermissionsService } from '../services/permissions.service';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';

@Component({
  selector: 'app-software',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    NgbPaginationModule,
    NotificationContainerComponent
  ],
  templateUrl: './software.component.html',
  styleUrls: ['./software.component.css']
})
export class SoftwareComponent implements OnInit {
  softwareList: SoftwareDTO[] = [];
  filteredSoftwareList: SoftwareDTO[] = [];
  loading: boolean = true;
  showHidden: boolean = false;
  showOnlyHidden: boolean = false;
  showOnlyForbidden: boolean = false;
  searchTerm: string = '';
  private searchSubject = new Subject<string>();
  activeTab: 'total' | 'hidden' | 'forbidden' | 'driver' | 'licenciado' = 'total';
  page: number = 1;
  pageSize: number = 10;
  collectionSize: number = 0;

  constructor(
    private softwareService: SoftwareService,
    private router: Router,
    private permissionsService: PermissionsService,
    private notificationService: NotificationService
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

    // Cargar software visible por defecto
    this.loadSoftwareByFilter('total');
  }

  loadSoftwareByFilter(filter: 'total' | 'hidden' | 'forbidden' | 'driver' | 'licenciado'): void {
    this.loading = true;

    let observable: Observable<SoftwareDTO[]>;

    switch (filter) {
      case 'total':
        observable = this.softwareService.getVisibleSoftwareWithCounts();
        break;
      case 'hidden':
        observable = this.softwareService.getHiddenSoftwareWithCounts();
        break;
      case 'forbidden':
        observable = this.softwareService.getForbiddenSoftwareWithCounts();
        break;
      case 'driver':
        observable = this.softwareService.getDriverSoftwareWithCounts();
        break;
      case 'licenciado':
        observable = this.softwareService.getLicenciadoSoftwareWithCounts();
        break;
      default:
        observable = this.softwareService.getVisibleSoftwareWithCounts();
    }

    observable.subscribe({
      next: (data) => {
        this.softwareList = data;
        this.updateFilteredList();
        this.loading = false;
      },
      error: (error) => {
        this.notificationService.showError(
          'Error al Cargar Software',
          'No se pudo cargar la lista de software: ' + error.message
        );
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

    // Ahora solo filtramos por búsqueda, ya que los datos vienen filtrados del servidor
    this.filteredSoftwareList = this.softwareList.filter(software => {
      if (!software) return false;

      const searchTermLower = (this.searchTerm || '').toLowerCase();
      const nombre = (software.nombre || '').toLowerCase();
      const publisher = (software.publisher || '').toLowerCase();

      return !searchTermLower || 
        nombre.includes(searchTermLower) ||
        publisher.includes(searchTermLower);
    });
    
    this.collectionSize = this.filteredSoftwareList.length;
    
    // Mantener la página actual si es válida, sino ir a la página 1
    const maxPage = Math.ceil(this.collectionSize / this.pageSize);
    if (this.page > maxPage && maxPage > 0) {
      this.page = maxPage;
    }
  }

  filterSoftware(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.page = 1; // Resetear página cuando se busca
    this.searchSubject.next(input.value);
  }

  showTotalSoftware(): void {
    this.activeTab = 'total';
    this.page = 1;
    this.loadSoftwareByFilter('total');
  }

  showOnlyHiddenSoftware(): void {
    this.activeTab = 'hidden';
    this.page = 1;
    this.loadSoftwareByFilter('hidden');
  }

  showOnlyForbiddenSoftware(): void {
    this.activeTab = 'forbidden';
    this.page = 1;
    this.loadSoftwareByFilter('forbidden');
  }

  showOnlyDriverSoftware(): void {
    this.activeTab = 'driver';
    this.page = 1;
    this.loadSoftwareByFilter('driver');
  }

  showOnlyLicenciadoSoftware(): void {
    this.activeTab = 'licenciado';
    this.page = 1;
    this.loadSoftwareByFilter('licenciado');
  }

  toggleSoftwareVisibility(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();

    this.softwareService.toggleSoftwareVisibility(software, !software.hidden).subscribe({
      next: () => {
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage(
          `Software ${software.hidden ? 'mostrado' : 'ocultado'} exitosamente`
        );
        
        // Recargar los datos del filtro actual
        this.loadSoftwareByFilter(this.activeTab);
      },
      error: (error) => {
        this.notificationService.showError(
          'Error al Actualizar Visibilidad',
          'No se pudo actualizar la visibilidad del software: ' + error.message
        );
      }
    });
  }

  toggleSoftwareForbidden(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();

    this.softwareService.toggleSoftwareForbidden(software).subscribe({
      next: () => {
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage(
          `Software ${software.forbidden ? 'desmarcado como prohibido' : 'marcado como prohibido'} exitosamente`
        );
        
        // Recargar los datos del filtro actual
        this.loadSoftwareByFilter(this.activeTab);
      },
      error: (error) => {
        this.notificationService.showError(
          'Error al Actualizar Estado Prohibido',
          'No se pudo actualizar el estado prohibido del software: ' + error.message
        );
      }
    });
  }

  toggleSoftwareDriver(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();

    this.softwareService.toggleSoftwareDriver(software).subscribe({
      next: () => {
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage(
          `Software ${software.driver ? 'desmarcado como driver' : 'marcado como driver'} exitosamente`
        );
        
        // Recargar los datos del filtro actual
        this.loadSoftwareByFilter(this.activeTab);
      },
      error: (error) => {
        this.notificationService.showError(
          'Error al Actualizar Estado Driver',
          'No se pudo actualizar el estado driver del software: ' + error.message
        );
      }
    });
  }

  toggleSoftwareLicenciado(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();

    this.softwareService.toggleSoftwareLicenciado(software).subscribe({
      next: () => {
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage(
          `Software ${software.licenciado ? 'desmarcado como licenciado' : 'marcado como licenciado'} exitosamente`
        );
        
        // Recargar los datos del filtro actual
        this.loadSoftwareByFilter(this.activeTab);
      },
      error: (error) => {
        this.notificationService.showError(
          'Error al Actualizar Estado Licenciado',
          'No se pudo actualizar el estado licenciado del software: ' + error.message
        );
      }
    });
  }

  deleteSoftware(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();

    if (confirm(`¿Está seguro de que desea eliminar el software "${software.nombre}"? Esta acción no se puede deshacer.`)) {
      this.softwareService.deleteSoftware(software).subscribe({
        next: () => {
          // Mostrar notificación de éxito
          this.notificationService.showSuccessMessage(
            `Software "${software.nombre}" eliminado exitosamente`
          );
          
          // Recargar los datos del filtro actual
          this.loadSoftwareByFilter(this.activeTab);
        },
        error: (error) => {
          this.notificationService.showError(
            'Error al Eliminar Software',
            'No se pudo eliminar el software: ' + error.message
          );
        }
      });
    }
  }

  navigateToAssets(software: SoftwareDTO): void {
    this.router.navigate(['/menu/assets'], { 
      queryParams: { 
        softwareId: software.idSoftware,
        softwareName: software.nombre
      }
    });
  }

  canManageSoftware(): boolean {
    return this.permissionsService.canManageSoftware();
  }
}
