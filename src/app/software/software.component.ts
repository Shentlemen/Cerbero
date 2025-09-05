import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SoftwareService, SoftwareDTO, PaginatedSoftwareResponse, SoftwarePaginationParams, SoftwareCounters } from '../services/software.service';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { Observable, forkJoin } from 'rxjs';
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
  loading: boolean = true;
  searchTerm: string = '';
  activeTab: 'total' | 'hidden' | 'forbidden' | 'driver' | 'licenciado' = 'total';
  page: number = 1;
  pageSize: number = 50; // Aumentar tamaño de página para mejor rendimiento
  collectionSize: number = 0;
  totalPages: number = 0;

  // Contadores de software
  softwareCounters: SoftwareCounters = {
    total: 0,
    hidden: 0,
    forbidden: 0,
    driver: 0,
    licenciado: 0
  };

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
    // Ya no necesitamos búsqueda reactiva, se maneja directamente en filterSoftware
  }

  ngOnInit(): void {
    this.loadSoftwarePaginated();
  }

  get pagedSoftwareList(): SoftwareDTO[] {
    // Ya no necesitamos paginación local, los datos vienen paginados del backend
    return this.softwareList;
  }

  // Getter para la página que cierra la selección múltiple al cambiar
  get currentPage(): number {
    return this.page;
  }

  set currentPage(value: number) {
    if (this.page !== value) {
      this.page = value;
      this.closeMultiSelectMode();
      this.loadSoftwarePaginated(); // Recargar datos cuando cambie la página
    }
  }

  get totalSoftware(): number {
    return this.collectionSize; // Usar el total del backend
  }

  // Getters para los contadores de cada tipo - ahora usando datos reales
  get hiddenSoftwareCount(): number {
    return this.softwareCounters.hidden;
  }

  get forbiddenSoftwareCount(): number {
    return this.softwareCounters.forbidden;
  }

  get driverSoftwareCount(): number {
    return this.softwareCounters.driver;
  }

  get licenciadoSoftwareCount(): number {
    return this.softwareCounters.licenciado;
  }

  loadSoftware(): void {
    this.loadSoftwarePaginated();
  }

  loadSoftwarePaginated(): void {
    this.loading = true;

    const params: SoftwarePaginationParams = {
      page: this.page - 1, // El backend usa 0-based indexing
      size: this.pageSize,
      sort: 'nombre',
      direction: 'asc',
      filter: this.activeTab,
      search: this.searchTerm || undefined
    };

    // Cargar datos paginados y contadores en paralelo
    forkJoin({
      paginatedData: this.softwareService.getSoftwarePaginated(params),
      counters: this.softwareService.getSoftwareCounters()
    }).subscribe({
      next: (data) => {
        this.softwareList = data.paginatedData.content;
        this.collectionSize = data.paginatedData.totalElements;
        this.totalPages = data.paginatedData.totalPages;
        this.softwareCounters = data.counters;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error al cargar software paginado:', error);
        this.notificationService.showError(
          'Error al Cargar Software',
          'No se pudo cargar la lista de software: ' + (error.message || 'Error desconocido')
        );
        this.loading = false;
      }
    });
  }

  // Método obsoleto - mantener por compatibilidad temporal
  loadSoftwareByFilter(filter: 'total' | 'hidden' | 'forbidden' | 'driver' | 'licenciado'): void {
    this.activeTab = filter;
    this.page = 1; // Resetear a la primera página
    this.loadSoftwarePaginated();
  }

  // Ya no necesitamos filtrar localmente, el backend se encarga
  updateFilteredList(): void {
    // Este método ya no es necesario con paginación del backend
    // Los filtros se aplican en el backend
  }

  filterSoftware(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    this.page = 1; // Resetear a la primera página cuando se busca
    this.closeMultiSelectMode(); // Cerrar selección múltiple al buscar
    this.loadSoftwarePaginated(); // Recargar con el nuevo término de búsqueda
  }

  showTotalSoftware(): void {
    this.activeTab = 'total';
    this.page = 1;
    this.closeMultiSelectMode();
    this.loadSoftwarePaginated();
  }

  showOnlyHiddenSoftware(): void {
    this.activeTab = 'hidden';
    this.page = 1;
    this.closeMultiSelectMode();
    this.loadSoftwarePaginated();
  }

  showOnlyForbiddenSoftware(): void {
    this.activeTab = 'forbidden';
    this.page = 1;
    this.closeMultiSelectMode();
    this.loadSoftwarePaginated();
  }

  showOnlyDriverSoftware(): void {
    this.activeTab = 'driver';
    this.page = 1;
    this.closeMultiSelectMode();
    this.loadSoftwarePaginated();
  }

  showOnlyLicenciadoSoftware(): void {
    this.activeTab = 'licenciado';
    this.page = 1;
    this.closeMultiSelectMode();
    this.loadSoftwarePaginated();
  }

  toggleSoftwareVisibility(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();

    this.softwareService.toggleSoftwareVisibility(software, !software.hidden).subscribe({
      next: () => {
        // Recargar datos y contadores para reflejar el cambio
        this.loadSoftwarePaginated();
        
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage(
          `Software ${software.hidden ? 'ocultado' : 'mostrado'} exitosamente`
        );
      },
      error: (error) => {
        // Mostrar mensaje de error más claro
        let errorMessage = 'No se pudo actualizar la visibilidad del software';
        
        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.notificationService.showError(
          'Error al Actualizar Visibilidad',
          errorMessage
        );
      }
    });
  }

  toggleSoftwareForbidden(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();

    this.softwareService.toggleSoftwareForbidden(software).subscribe({
      next: () => {
        // Actualizar el estado en la lista local
        software.forbidden = !software.forbidden;
        
        // Actualizar la lista filtrada para reflejar el cambio
        this.loadSoftware(); // Reload to update counts
        
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage(
          `Software ${software.forbidden ? 'marcado como prohibido' : 'desmarcado como prohibido'} exitosamente`
        );
      },
      error: (error) => {
        // Mostrar mensaje de error más claro
        let errorMessage = 'No se pudo actualizar el estado prohibido del software';
        
        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.notificationService.showError(
          'Error al Actualizar Estado Prohibido',
          errorMessage
        );
      }
    });
  }

  toggleSoftwareDriver(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();

    this.softwareService.toggleSoftwareDriver(software).subscribe({
      next: () => {
        // Actualizar el estado en la lista local
        software.driver = !software.driver;
        
        // Actualizar la lista filtrada para reflejar el cambio
        this.loadSoftware(); // Reload to update counts
        
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage(
          `Software ${software.driver ? 'marcado como driver' : 'desmarcado como driver'} exitosamente`
        );
      },
      error: (error) => {
        // Mostrar mensaje de error más claro
        let errorMessage = 'No se pudo actualizar el estado driver del software';
        
        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.notificationService.showError(
          'Error al Actualizar Estado Driver',
          errorMessage
        );
      }
    });
  }

  toggleSoftwareLicenciado(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();

    this.softwareService.toggleSoftwareLicenciado(software).subscribe({
      next: () => {
        // Actualizar el estado en la lista local
        software.licenciado = !software.licenciado;
        
        // Actualizar la lista filtrada para reflejar el cambio
        this.loadSoftware(); // Reload to update counts
        
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage(
          `Software ${software.licenciado ? 'marcado como licenciado' : 'desmarcado como licenciado'} exitosamente`
        );
      },
      error: (error) => {
        // Mostrar mensaje de error más claro
        let errorMessage = 'No se pudo actualizar el estado licenciado del software';
        
        if (error.error && error.error.message) {
          errorMessage = error.error.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        this.notificationService.showError(
          'Error al Actualizar Estado Licenciado',
          errorMessage
        );
      }
    });
  }

  deleteSoftware(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();
    
    // Validar que el software sea válido
    if (!software || !software.idSoftware) {
      console.error('Software inválido en deleteSoftware:', software);
      this.notificationService.showError(
        'Error al Eliminar Software',
        'Software inválido o sin ID'
      );
      return;
    }
    
    // Log para depuración
    console.log('Software a eliminar:', {
      id: software.idSoftware,
      nombre: software.nombre,
      publisher: software.publisher,
      version: software.version
    });
    
    // Permitir eliminación si tenemos ID (que es lo mínimo necesario)
    // Los campos null no deberían impedir la eliminación
    if (software.idSoftware) {
      this.softwareToDelete = software;
      this.showConfirmDialog = true;
    } else {
      this.notificationService.showError(
        'Error al Eliminar Software',
        'Software sin ID válido'
      );
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

  toggleSelectAll(): void {
    if (this.selectedCount === this.pagedSoftwareList.length && this.pagedSoftwareList.length > 0) {
      this.selectedSoftware.clear();
    } else {
      this.pagedSoftwareList.forEach(software => {
        this.selectedSoftware.add(software.idSoftware);
      });
    }
  }

  get selectedCount(): number {
    return this.selectedSoftware.size;
  }

  get isSoftwareToDeleteValid(): boolean {
    return this.softwareToDelete !== null && this.softwareToDelete.idSoftware !== undefined;
  }

  // Método helper para obtener un nombre de visualización del software
  getSoftwareDisplayName(software: SoftwareDTO): string {
    if (software.nombre) {
      return software.nombre;
    }
    
    // Si no hay nombre, crear uno basado en otros campos
    const parts = [];
    if (software.publisher) parts.push(software.publisher);
    if (software.version) parts.push(software.version);
    
    if (parts.length > 0) {
      return `Software (${parts.join(' - ')})`;
    }
    
    // Si solo tenemos ID, usar eso
    return `Software ID: ${software.idSoftware}`;
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

      // Recargar datos para reflejar los cambios
      this.loadSoftwarePaginated();

      // Mostrar notificación de éxito con información más detallada
      const actionText = this.getActionText(action, value);
      const actionDescription = this.getActionDescription(action, value);
      this.notificationService.showSuccessMessage(
        `${softwareIds.length} software ${actionText}. ${actionDescription}`
      );

      // Limpiar selección
      this.selectedSoftware.clear();
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
    console.log('Eliminación cancelada, softwareToDelete limpiado');
  }

  confirmarEliminacion(): void {
    if (!this.softwareToDelete) {
      console.error('softwareToDelete es null en confirmarEliminacion');
      this.notificationService.showError(
        'Error al Eliminar Software',
        'No se pudo identificar el software a eliminar'
      );
      this.showConfirmDialog = false;
      return;
    }

    // Verificar que el software aún existe en la lista
    const softwareExists = this.softwareList.some(s => s.idSoftware === this.softwareToDelete!.idSoftware);
    if (!softwareExists) {
      console.error('Software no encontrado en la lista:', this.softwareToDelete);
      this.notificationService.showError(
        'Error al Eliminar Software',
        'El software ya no existe en la lista'
      );
      this.showConfirmDialog = false;
      this.softwareToDelete = null;
      return;
    }

    // Guardar una referencia local para evitar problemas de concurrencia
    const softwareToDelete = this.softwareToDelete;
    
    // Usar el método que solo envía el ID al backend
    console.log('Intentando eliminar software con ID:', softwareToDelete.idSoftware);
    this.softwareService.eliminarSoftware(softwareToDelete.idSoftware).subscribe({
      next: () => {
        this.handleSoftwareDeletionSuccess(softwareToDelete);
      },
      error: (error) => {
        this.handleSoftwareDeletionError(error);
      }
    });
    
    this.showConfirmDialog = false;
    this.softwareToDelete = null;
  }

  cancelarEliminacionMultiple(): void {
    this.showConfirmDialogMultiple = false;
  }

  // Métodos helper para manejar la eliminación de software
  private handleSoftwareDeletionSuccess(software: SoftwareDTO): void {
    // Recargar datos para reflejar el cambio
    this.loadSoftwarePaginated();
    
    // Mostrar notificación de éxito con manejo de campos null
    const softwareName = this.getSoftwareDisplayName(software);
    this.notificationService.showSuccessMessage(
      `Software "${softwareName}" eliminado exitosamente`
    );
  }

  private handleSoftwareDeletionError(error: any): void {
    console.error('Error completo de eliminación:', error);
    
    let errorMessage = 'No se pudo eliminar el software';
    
    if (error.error && error.error.message) {
      errorMessage += ': ' + error.error.message;
    } else if (error.message) {
      errorMessage += ': ' + error.message;
    } else if (error.status) {
      errorMessage += ` (HTTP ${error.status})`;
    }
    
    this.notificationService.showError(
      'Error al Eliminar Software',
      errorMessage
    );
  }

  // Actualizar método de eliminación múltiple
  async confirmarEliminacionMultiple(): Promise<void> {
    if (this.selectedSoftware.size === 0) return;

    const softwareIds = Array.from(this.selectedSoftware);
    const softwareItems = this.softwareList.filter(s => softwareIds.includes(s.idSoftware));

    this.isUpdatingMultiple = true;
    this.showConfirmDialogMultiple = false;

    try {
      // Filtrar solo software con ID válido
      const validSoftwareItems = softwareItems.filter(s => s.idSoftware);
      
      if (validSoftwareItems.length === 0) {
        this.notificationService.showError(
          'Error al Eliminar Software',
          'No hay software válido para eliminar'
        );
        return;
      }

      const promises = validSoftwareItems.map(software => 
        this.softwareService.eliminarSoftware(software.idSoftware).toPromise()
      );

      await Promise.all(promises);

      // Recargar datos para reflejar los cambios
      this.loadSoftwarePaginated();

      this.notificationService.showSuccessMessage(
        `${validSoftwareItems.length} software eliminados exitosamente`
      );

      this.selectedSoftware.clear();
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
