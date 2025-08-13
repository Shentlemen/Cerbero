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
  pageSize: number = 20;
  collectionSize: number = 0;

  // Propiedades para selección múltiple
  multiSelectMode: boolean = false;
  selectedSoftware: Set<number> = new Set();
  isUpdatingMultiple: boolean = false;

  // Propiedades para diálogos de confirmación
  showConfirmDialog: boolean = false;
  showConfirmDialogMultiple: boolean = false;
  softwareToDelete: SoftwareDTO | null = null;

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

  // Getter para la página que cierra la selección múltiple al cambiar
  get currentPage(): number {
    return this.page;
  }

  set currentPage(value: number) {
    if (this.page !== value) {
      this.page = value;
      this.closeMultiSelectMode();
    }
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
    this.closeMultiSelectMode(); // Cerrar selección múltiple al buscar
    this.searchSubject.next(input.value);
  }

  showTotalSoftware(): void {
    this.activeTab = 'total';
    this.page = 1;
    this.closeMultiSelectMode();
    this.loadSoftwareByFilter('total');
  }

  showOnlyHiddenSoftware(): void {
    this.activeTab = 'hidden';
    this.page = 1;
    this.closeMultiSelectMode();
    this.loadSoftwareByFilter('hidden');
  }

  showOnlyForbiddenSoftware(): void {
    this.activeTab = 'forbidden';
    this.page = 1;
    this.closeMultiSelectMode();
    this.loadSoftwareByFilter('forbidden');
  }

  showOnlyDriverSoftware(): void {
    this.activeTab = 'driver';
    this.page = 1;
    this.closeMultiSelectMode();
    this.loadSoftwareByFilter('driver');
  }

  showOnlyLicenciadoSoftware(): void {
    this.activeTab = 'licenciado';
    this.page = 1;
    this.closeMultiSelectMode();
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
    this.softwareToDelete = software;
    this.showConfirmDialog = true;
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

  // Métodos para selección múltiple
  toggleMultiSelectMode(): void {
    this.multiSelectMode = !this.multiSelectMode;
    if (!this.multiSelectMode) {
      this.selectedSoftware.clear();
    }
  }

  closeMultiSelectMode(): void {
    this.multiSelectMode = false;
    this.selectedSoftware.clear();
  }

  toggleSoftwareSelection(softwareId: number): void {
    if (this.selectedSoftware.has(softwareId)) {
      this.selectedSoftware.delete(softwareId);
    } else {
      this.selectedSoftware.add(softwareId);
    }
  }

  selectAllVisible(): void {
    this.pagedSoftwareList.forEach(software => {
      this.selectedSoftware.add(software.idSoftware);
    });
  }

  toggleSelectAll(): void {
    if (this.selectedCount === this.pagedSoftwareList.length && this.pagedSoftwareList.length > 0) {
      this.deselectAll();
    } else {
      this.selectAllVisible();
    }
  }

  deselectAll(): void {
    this.selectedSoftware.clear();
  }

  get selectedCount(): number {
    return this.selectedSoftware.size;
  }

  // Acciones en lote
  async updateMultipleSoftware(action: 'visibility' | 'forbidden' | 'driver' | 'licenciado', value: boolean): Promise<void> {
    if (this.selectedSoftware.size === 0) return;

    this.isUpdatingMultiple = true;
    const softwareIds = Array.from(this.selectedSoftware);
    const softwareItems = this.softwareList.filter(s => softwareIds.includes(s.idSoftware));

    try {
      const promises = softwareItems.map(software => {
        switch (action) {
          case 'visibility':
            return this.softwareService.toggleSoftwareVisibility(software, value).toPromise();
          case 'forbidden':
            return this.softwareService.toggleSoftwareForbidden(software).toPromise();
          case 'driver':
            return this.softwareService.toggleSoftwareDriver(software).toPromise();
          case 'licenciado':
            return this.softwareService.toggleSoftwareLicenciado(software).toPromise();
          default:
            return Promise.resolve();
        }
      });

      await Promise.all(promises);

      // Mostrar notificación de éxito con información más detallada
      const actionText = this.getActionText(action, value);
      const actionDescription = this.getActionDescription(action, value);
      this.notificationService.showSuccessMessage(
        `${softwareIds.length} software ${actionText}. ${actionDescription}`
      );

      // Limpiar selección y recargar datos
      this.selectedSoftware.clear();
      this.loadSoftwareByFilter(this.activeTab);
    } catch (error: any) {
      this.notificationService.showError(
        'Error al Actualizar Software',
        'No se pudieron actualizar algunos elementos: ' + (error?.message || 'Error desconocido')
      );
    } finally {
      this.isUpdatingMultiple = false;
    }
  }

  async deleteMultipleSoftware(): Promise<void> {
    if (this.selectedSoftware.size === 0) return;
    this.showConfirmDialogMultiple = true;
  }

  private getActionText(action: string, value: boolean): string {
    switch (action) {
      case 'visibility':
        return value ? 'mostrados' : 'ocultados';
      case 'forbidden':
        return 'marcados como prohibidos';
      case 'driver':
        return 'marcados como drivers';
      case 'licenciado':
        return 'marcados como licenciados';
      default:
        return 'actualizados';
    }
  }

  private getActionDescription(action: string, value: boolean): string {
    switch (action) {
      case 'visibility':
        return value ? 'Software ocultado exitosamente' : 'Software mostrado exitosamente';
      case 'forbidden':
        return value ? 'Software desmarcado como prohibido exitosamente' : 'Software marcado como prohibido exitosamente';
      case 'driver':
        return value ? 'Software desmarcado como driver exitosamente' : 'Software marcado como driver exitosamente';
      case 'licenciado':
        return value ? 'Software desmarcado como licenciado exitosamente' : 'Software marcado como licenciado exitosamente';
      default:
        return '';
    }
  }

  isSoftwareSelected(softwareId: number): boolean {
    return this.selectedSoftware.has(softwareId);
  }

  // Métodos helper para determinar el estado de los botones de selección múltiple
  hasAnyHiddenSoftware(): boolean {
    return this.softwareList
      .filter(s => this.selectedSoftware.has(s.idSoftware))
      .some(s => s.hidden);
  }

  hasAnyForbiddenSoftware(): boolean {
    return this.softwareList
      .filter(s => this.selectedSoftware.has(s.idSoftware))
      .some(s => s.forbidden);
  }

  hasAnyDriverSoftware(): boolean {
    return this.softwareList
      .filter(s => this.selectedSoftware.has(s.idSoftware))
      .some(s => s.driver);
  }

  hasAnyLicenciadoSoftware(): boolean {
    return this.softwareList
      .filter(s => this.selectedSoftware.has(s.idSoftware))
      .some(s => s.licenciado);
  }

  // Métodos para diálogos de confirmación
  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.softwareToDelete = null;
  }

  confirmarEliminacion(): void {
    if (this.softwareToDelete) {
      this.softwareService.deleteSoftware(this.softwareToDelete).subscribe({
        next: () => {
          // Mostrar notificación de éxito
          this.notificationService.showSuccessMessage(
            `Software "${this.softwareToDelete!.nombre}" eliminado exitosamente`
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
      
      this.showConfirmDialog = false;
      this.softwareToDelete = null;
    }
  }

  cancelarEliminacionMultiple(): void {
    this.showConfirmDialogMultiple = false;
  }

  async confirmarEliminacionMultiple(): Promise<void> {
    if (this.selectedSoftware.size === 0) return;

    const softwareIds = Array.from(this.selectedSoftware);
    const softwareItems = this.softwareList.filter(s => softwareIds.includes(s.idSoftware));

    this.isUpdatingMultiple = true;
    this.showConfirmDialogMultiple = false;

    try {
      const promises = softwareItems.map(software => 
        this.softwareService.deleteSoftware(software).toPromise()
      );

      await Promise.all(promises);

      this.notificationService.showSuccessMessage(
        `${softwareIds.length} software eliminados exitosamente`
      );

      this.selectedSoftware.clear();
      this.loadSoftwareByFilter(this.activeTab);
    } catch (error: any) {
      this.notificationService.showError(
        'Error al Eliminar Software',
        'No se pudieron eliminar algunos elementos: ' + (error?.message || 'Error desconocido')
      );
    } finally {
      this.isUpdatingMultiple = false;
    }
  }
}
