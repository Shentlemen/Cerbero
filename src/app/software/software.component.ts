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
  pageSize: number = 50; // Paginación de 50 elementos por página
  collectionSize: number = 0;
  totalPages: number = 0;
  
  // Hacer Math disponible en el template
  Math = Math;

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
  
  // Propiedad para mostrar loading en filtros
  isFiltering: boolean = false;
  
  // Cache para la lista filtrada
  private _cachedFilteredList: SoftwareDTO[] | null = null;
  private _lastSearchTerm: string = '';
  private _lastActiveTab: string = '';

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
    // Verificar si necesitamos recalcular el cache
    const currentSearchTerm = this.searchTerm || '';
    const currentActiveTab = this.activeTab;
    
    if (this._cachedFilteredList && 
        this._lastSearchTerm === currentSearchTerm && 
        this._lastActiveTab === currentActiveTab) {
      return this._cachedFilteredList;
    }

    // Recalcular y cachear
    let filtered = [...this.softwareList];

    // Filtrar software sin nombre o sin editor
    filtered = filtered.filter(software => 
      software.nombre && software.nombre.trim() !== '' && 
      software.publisher && software.publisher.trim() !== ''
    );

    // Filtrar software que solo está instalado en equipos en cementerio o almacén (count = 0)
    filtered = filtered.filter(software => 
      software.count !== undefined && software.count !== null && software.count > 0
    );

    // Aplicar filtro de búsqueda
    if (currentSearchTerm && currentSearchTerm.trim()) {
      const searchLower = currentSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(software => 
        (software.nombre && software.nombre.toLowerCase().includes(searchLower)) ||
        (software.publisher && software.publisher.toLowerCase().includes(searchLower)) ||
        (software.version && software.version.toLowerCase().includes(searchLower))
      );
    }

    // Aplicar filtro de tipo
    switch (currentActiveTab) {
      case 'hidden':
        filtered = filtered.filter(software => software.hidden);
        break;
      case 'forbidden':
        filtered = filtered.filter(software => software.forbidden);
        break;
      case 'driver':
        filtered = filtered.filter(software => software.driver);
        break;
      case 'licenciado':
        filtered = filtered.filter(software => software.licenciado);
        break;
      case 'total':
      default:
        // Mostrar solo software sin atributos marcados
        filtered = filtered.filter(software => 
          !software.hidden && !software.forbidden && !software.driver && !software.licenciado
        );
        break;
    }

    // Actualizar cache
    this._cachedFilteredList = filtered;
    this._lastSearchTerm = currentSearchTerm;
    this._lastActiveTab = currentActiveTab;

    return filtered;
  }

  // Getter para la lista paginada
  get paginatedSoftwareList(): SoftwareDTO[] {
    const filteredList = this.pagedSoftwareList;
    const startIndex = (this.page - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return filteredList.slice(startIndex, endIndex);
  }

  // Getter para la página que cierra la selección múltiple al cambiar
  get currentPage(): number {
    return this.page;
  }

  set currentPage(value: number) {
    if (this.page !== value) {
      this.page = value;
      this.closeMultiSelectMode();
      // No necesitamos recargar, la paginación es local
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

    // Cargar todo el software de una vez (más eficiente para datasets medianos)
    this.softwareService.getAllSoftwareWithCountAndAttributes().subscribe({
      next: (data) => {
        this.softwareList = data;
        this.collectionSize = data.length;
        this.updateFilteredList();
        this.clearCache(); // Limpiar cache cuando se cargan nuevos datos
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error al cargar software:', error);
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

  // Filtrar localmente para mejor rendimiento
  updateFilteredList(): void {
    // Filtrar primero software sin nombre o editor
    let validSoftware = this.softwareList.filter(software => 
      software.nombre && software.nombre.trim() !== '' && 
      software.publisher && software.publisher.trim() !== ''
    );

    // Filtrar software que solo está instalado en equipos en cementerio o almacén (count = 0)
    validSoftware = validSoftware.filter(software => 
      software.count !== undefined && software.count !== null && software.count > 0
    );

    // Actualizar contadores basados en software válido
    this.softwareCounters = {
      total: validSoftware.filter(s => !s.hidden && !s.forbidden && !s.driver && !s.licenciado).length,
      hidden: validSoftware.filter(s => s.hidden).length,
      forbidden: validSoftware.filter(s => s.forbidden).length,
      driver: validSoftware.filter(s => s.driver).length,
      licenciado: validSoftware.filter(s => s.licenciado).length
    };

    // Actualizar tamaño de colección basado en la lista filtrada actual
    this.collectionSize = this.pagedSoftwareList.length;
    this.totalPages = Math.ceil(this.collectionSize / this.pageSize);
  }

  // Limpiar cache de filtros
  private clearCache(): void {
    this._cachedFilteredList = null;
    this._lastSearchTerm = '';
    this._lastActiveTab = '';
  }

  filterSoftware(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    this.page = 1; // Resetear a la primera página al buscar
    this.closeMultiSelectMode(); // Cerrar selección múltiple al buscar
    
    // Mostrar loading solo si hay texto para filtrar
    if (this.searchTerm && this.searchTerm.trim()) {
      this.isFiltering = true;
      // Usar setTimeout para permitir que Angular actualice la UI
      setTimeout(() => {
        this.isFiltering = false;
      }, 100);
    } else {
      this.isFiltering = false;
    }
  }

  showTotalSoftware(): void {
    this.isFiltering = true;
    this.activeTab = 'total';
    this.page = 1; // Resetear a la primera página
    this.closeMultiSelectMode();
    this.updateFilteredList();
    // Simular un pequeño delay para mostrar el loading
    setTimeout(() => {
      this.isFiltering = false;
    }, 300);
  }

  showOnlyHiddenSoftware(): void {
    this.isFiltering = true;
    this.activeTab = 'hidden';
    this.page = 1; // Resetear a la primera página
    this.closeMultiSelectMode();
    this.updateFilteredList();
    // Simular un pequeño delay para mostrar el loading
    setTimeout(() => {
      this.isFiltering = false;
    }, 300);
  }

  showOnlyForbiddenSoftware(): void {
    this.isFiltering = true;
    this.activeTab = 'forbidden';
    this.page = 1; // Resetear a la primera página
    this.closeMultiSelectMode();
    this.updateFilteredList();
    // Simular un pequeño delay para mostrar el loading
    setTimeout(() => {
      this.isFiltering = false;
    }, 300);
  }

  showOnlyDriverSoftware(): void {
    this.isFiltering = true;
    this.activeTab = 'driver';
    this.page = 1; // Resetear a la primera página
    this.closeMultiSelectMode();
    this.updateFilteredList();
    // Simular un pequeño delay para mostrar el loading
    setTimeout(() => {
      this.isFiltering = false;
    }, 300);
  }

  showOnlyLicenciadoSoftware(): void {
    this.isFiltering = true;
    this.activeTab = 'licenciado';
    this.page = 1; // Resetear a la primera página
    this.closeMultiSelectMode();
    this.updateFilteredList();
    // Simular un pequeño delay para mostrar el loading
    setTimeout(() => {
      this.isFiltering = false;
    }, 300);
  }

  toggleSoftwareVisibility(software: SoftwareDTO, event: Event): void {
    event.stopPropagation();

    this.softwareService.toggleSoftwareVisibility(software, !software.hidden).subscribe({
      next: () => {
        // Actualizar el estado local
        software.hidden = !software.hidden;
        this.clearCache(); // Limpiar cache cuando se modifica el software
        this.updateFilteredList();
        
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
        this.clearCache(); // Limpiar cache cuando se modifica el software
        
        // Actualizar la lista filtrada para reflejar el cambio
        this.updateFilteredList();
        
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
        this.clearCache(); // Limpiar cache cuando se modifica el software
        
        // Actualizar la lista filtrada para reflejar el cambio
        this.updateFilteredList();
        
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
        this.clearCache(); // Limpiar cache cuando se modifica el software
        
        // Actualizar la lista filtrada para reflejar el cambio
        this.updateFilteredList();
        
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
    if (this.selectedCount === this.paginatedSoftwareList.length && this.paginatedSoftwareList.length > 0) {
      this.selectedSoftware.clear();
    } else {
      this.paginatedSoftwareList.forEach((software: SoftwareDTO) => {
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

      // Actualizar contadores localmente
      this.updateFilteredList();

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
    // Remover el software de la lista local
    this.softwareList = this.softwareList.filter(s => s.idSoftware !== software.idSoftware);
    this.updateFilteredList();
    
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

      // Remover software eliminado de la lista local
      const validSoftwareIds = validSoftwareItems.map(s => s.idSoftware);
      this.softwareList = this.softwareList.filter(s => !validSoftwareIds.includes(s.idSoftware));
      this.updateFilteredList();

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
