import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../services/config.service';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { PermissionsService } from '../services/permissions.service';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, NgbModule, NotificationContainerComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent {
  isSyncing = false;
  syncResult: any = null;
  syncMessage: string = '';
  error: string | null = null;
  
  // Propiedades para duplicados
  isSearchingDuplicates = false;
  duplicatesResult: any[] = [];
  duplicatesError: string | null = null;
  isDeleting: boolean = false;
  
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private modalService: NgbModal,
    private permissionsService: PermissionsService,
    private notificationService: NotificationService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/sync`;
  }

  // Verificar si el usuario tiene permisos para acceder a settings
  canAccessSettings(): boolean {
    return this.permissionsService.isGM();
  }

  mostrarConfirmacion(confirmModal: any) {
    this.modalService.open(confirmModal, { centered: true }).result.then(
      (result) => {
        if (result === 'confirm') {
          this.sincronizarBases();
        }
      },
      (reason) => {
        // Modal cerrado sin confirmar
      }
    );
  }

  async sincronizarBases() {
    this.isSyncing = true;
    this.error = null;
    this.syncResult = null;
    this.syncMessage = '';

    try {
      const response = await this.http.post<ApiResponse<any>>(`${this.apiUrl}/sync-all`, {}).toPromise();
      
      if (response) {
        this.syncResult = response.data; // Los resultados detallados están en data
        this.syncMessage = response.message; // El mensaje general está en message
        
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage('Sincronización completada exitosamente');
      }
    } catch (err: any) {
      this.error = err.message || 'Error durante la sincronización';
      this.notificationService.showError(
        'Error de Sincronización',
        'No se pudo completar la sincronización: ' + err.message
      );
    } finally {
      this.isSyncing = false;
    }
  }

  getResultClass(value: any): string {
    if (typeof value === 'string') {
      if (value.includes('exitos')) return 'text-success';
      if (value.includes('Error')) return 'text-warning';
    }
    return '';
  }

  async buscarDuplicados() {
    this.isSearchingDuplicates = true;
    this.duplicatesError = null;
    this.duplicatesResult = [];

    try {
      console.log('Iniciando búsqueda de duplicados...');
      const response = await this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/duplicates`).toPromise();
      
      console.log('Respuesta del servidor:', response);
      
      if (response && response.success) {
        this.duplicatesResult = response.data || [];
        console.log('Resultados obtenidos:', this.duplicatesResult);
        
        // Log de depuración para verificar la estructura de datos
        if (this.duplicatesResult.length > 0) {
          console.log('Primer grupo de duplicados:', this.duplicatesResult[0]);
          if (this.duplicatesResult[0].duplicates && this.duplicatesResult[0].duplicates.length > 0) {
            console.log('Primer hardware en el grupo:', this.duplicatesResult[0].duplicates[0]);
            console.log('isPrimary del primer hardware:', this.duplicatesResult[0].duplicates[0].isPrimary);
            console.log('Tipo de isPrimary:', typeof this.duplicatesResult[0].duplicates[0].isPrimary);
          }
        }
        
        // Mostrar notificación de éxito
        this.notificationService.showSuccessMessage(`Búsqueda completada. Se encontraron ${this.duplicatesResult.length} grupos de duplicados`);
      } else {
        this.duplicatesError = response?.message || 'Error al buscar duplicados';
        console.error('Error en la respuesta:', this.duplicatesError);
        this.notificationService.showError(
          'Error al Buscar Duplicados',
          this.duplicatesError
        );
      }
    } catch (err: any) {
      console.error('Error completo:', err);
      this.duplicatesError = err.message || 'Error durante la búsqueda de duplicados';
      this.notificationService.showError(
        'Error al Buscar Duplicados',
        'No se pudo completar la búsqueda: ' + err.message
      );
    } finally {
      this.isSearchingDuplicates = false;
    }
  }

  async eliminarDuplicado(hardwareId: number, hardwareName: string) {
    if (this.isDeleting) return;
    
    const confirmacion = confirm(`¿Está seguro de que desea eliminar el duplicado "${hardwareName}" (ID: ${hardwareId})?\n\nEsta acción eliminará TODOS los datos relacionados con este hardware de la base de datos y NO se puede deshacer.`);
    
    if (!confirmacion) return;
    
    this.isDeleting = true;
    
    try {
      console.log(`Eliminando duplicado ID: ${hardwareId}`);
      const response = await this.http.delete<ApiResponse<any>>(`${this.apiUrl}/duplicates/${hardwareId}`).toPromise();
      
      if (response && response.success) {
        console.log('Duplicado eliminado exitosamente:', response.message);
        // Recargar la lista de duplicados
        await this.buscarDuplicados();
        this.notificationService.showSuccessMessage(`Duplicado "${hardwareName}" eliminado exitosamente`);
      } else {
        throw new Error(response?.message || 'Error al eliminar el duplicado');
      }
    } catch (err: any) {
      console.error('Error al eliminar duplicado:', err);
      this.notificationService.showError(
        'Error al Eliminar Duplicado',
        `No se pudo eliminar el duplicado "${hardwareName}": ${err.message}`
      );
    } finally {
      this.isDeleting = false;
    }
  }
}
