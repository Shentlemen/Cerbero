import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { ConfigService } from '../services/config.service';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { PermissionsService } from '../services/permissions.service';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { TourRegistryService } from '../services/tour-registry.service';
import { SessionIdleService } from '../services/session-idle.service';
import { OcsDuplicatesAlertService } from '../services/ocs-duplicates-alert.service';

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
export class SettingsComponent implements OnInit, OnDestroy {
  isSyncing = false;
  syncResult: any = null;
  syncMessage: string = '';
  error: string | null = null;
  
  // Propiedades para duplicados Cerbero
  isSearchingDuplicates = false;
  duplicatesResult: any[] = [];
  duplicatesError: string | null = null;
  isDeleting: boolean = false;

  // Propiedades para duplicados OCS (solo consulta)
  isSearchingOcsDuplicates = false;
  ocsDuplicatesResult: any[] | null = null;
  ocsDuplicatesError: string | null = null;
  
  // Propiedades para comparación de bases de datos
  isComparingDatabases = false;
  comparisonResult: any = null;
  comparisonError: string | null = null;
  
  private apiUrl: string;
  private tourCleanup?: () => void;
  private routeSub?: { unsubscribe(): void };

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private modalService: NgbModal,
    private permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private tourRegistry: TourRegistryService,
    private sessionIdle: SessionIdleService,
    private route: ActivatedRoute,
    private ocsDuplicatesAlert: OcsDuplicatesAlertService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/sync`;
  }

  ngOnInit(): void {
    this.tourCleanup = this.tourRegistry.register('settings', [{
      id: 'settings-overview',
      title: 'Tour de configuración',
      icon: 'fa-route',
      beforeStart: () => this.resetScroll(),
      afterEnd: () => this.resetScroll(),
      steps: [
        {
          selector: '#tour-settings-title',
          title: 'Configuración del sistema',
          description:
            'Pantalla de <strong>mantenimiento avanzado</strong> (solo GM). Desde aquí podés resetear datos OCS, ' +
            'comparar inventarios entre bases, detectar duplicados y probar el cierre de sesión por inactividad. ' +
            'Todas las acciones son sensibles: usalas con criterio y en ventanas de mantenimiento.',
          side: 'bottom'
        },
        {
          selector: '#tour-settings-ocs',
          title: 'Reseteo de tablas OCS',
          description:
            'Esta sección ejecuta un <strong>reseteo completo</strong> de lo que Cerbero sincroniza desde OCS. ' +
            '<strong>Elimina</strong> hardware, software y dispositivos en Cerbero y luego <strong>reimporta</strong> datos frescos desde OCS. ' +
            '<strong>Preserva</strong> usuarios, alertas y configuraciones propias de Cerbero. El proceso puede tardar varios minutos.',
          side: 'top'
        },
        {
          selector: '#tour-settings-reset-ocs',
          title: 'Botón «Resetear tablas OCS»',
          description:
            'Inicia el reseteo. Abre un <strong>modal de confirmación</strong> con el detalle de lo que se borra y lo que se conserva. ' +
            'Solo al confirmar arranca la operación; mientras corre el botón queda deshabilitado y muestra progreso. ' +
            'Al terminar verás un resumen por tabla debajo de esta sección.',
          side: 'left'
        },
        {
          selector: '#tour-settings-idle',
          title: 'Sesión por inactividad (prueba)',
          description:
            'Herramientas de <strong>prueba</strong> para el cierre automático de sesión. En producción la app cierra tras ' +
            '<strong>30 minutos</strong> sin actividad y avisa en los <strong>últimos 3 minutos</strong>. ' +
            'Estos controles aceleran la simulación para validar el aviso y el logout sin esperar media hora.',
          side: 'top'
        },
        {
          selector: '#tour-settings-idle-actions',
          title: 'Probar aviso y cierre',
          description:
            '<strong>Probar aviso de inactividad</strong>: muestra el modal de advertencia en ~30 segundos (simula los últimos minutos). ' +
            '<strong>Probar cierre inmediato</strong>: cierra la sesión al instante y te redirige al login (pide confirmación antes). ' +
            'Útil para verificar que el flujo de seguridad funciona correctamente.',
          side: 'top'
        },
        {
          selector: '#tour-settings-compare',
          title: 'Comparar hardware OCS vs Cerbero',
          description:
            'Cruza la tabla <code>hardware</code> de ambas bases por <strong>nombre de equipo</strong> (sin distinguir mayúsculas ni espacios extra). ' +
            'El informe incluye estadísticas por base, grupos duplicados en OCS, resumen de sincronización (nombres únicos y diferencia Cerbero − OCS), ' +
            'equipos <strong>solo en OCS</strong> (faltan en Cerbero) y <strong>solo en Cerbero</strong> (posibles obsoletos). No lista los que ya coinciden.',
          side: 'top'
        },
        {
          selector: '#tour-settings-compare-btn',
          title: 'Botón «Comparar OCS vs Cerbero»',
          description:
            'Ejecuta el análisis y despliega tablas y tarjetas con los resultados debajo. ' +
            'Usalo para diagnosticar desfasajes de inventario antes o después de un reseteo. ' +
            'Si hay duplicados en Cerbero, el resumen te remite a la sección de búsqueda en Cerbero más abajo.',
          side: 'left'
        },
        {
          selector: '#ocs-duplicates-section',
          title: 'Buscar duplicados en OCS',
          description:
            'Consulta la base <strong>OCS</strong> (origen del agente) y agrupa equipos con el <strong>mismo nombre</strong> en la tabla hardware. ' +
            'Es <strong>solo lectura</strong>: no elimina registros en OCS desde Cerbero. ' +
            'Sirve para detectar inventario sucio en origen; el badge naranja del perro también puede llevarte acá.',
          side: 'top'
        },
        {
          selector: '#tour-settings-ocs-duplicates-btn',
          title: 'Botón «Buscar duplicados en OCS»',
          description:
            'Lanza la búsqueda y muestra cada grupo duplicado en tablas con ID, IP, DEVICEID, SO, usuario y última fecha. ' +
            'Si no hay duplicados verás un mensaje de éxito. Los duplicados en OCS conviene corregirlos en origen antes de sincronizar.',
          side: 'left'
        },
        {
          selector: '#tour-settings-cerbero-duplicates',
          title: 'Buscar duplicados en Cerbero',
          description:
            'Busca en la base <strong>Cerbero</strong> (no en OCS) equipos con el mismo nombre repetido. ' +
            'A diferencia de la sección OCS, acá podés <strong>eliminar</strong> registros duplicados desde la tabla de resultados. ' +
            'Complementa la comparación OCS vs Cerbero cuando necesitás limpiar la copia local.',
          side: 'top'
        },
        {
          selector: '#tour-settings-cerbero-duplicates-btn',
          title: 'Buscar y eliminar duplicados en Cerbero',
          description:
            '<strong>Buscar duplicados en Cerbero</strong> lista los grupos por nombre. En cada fila, el botón rojo <strong>Eliminar</strong> ' +
            'borra ese hardware de Cerbero y todos sus datos relacionados (pide confirmación y no se puede deshacer). ' +
            'Tras eliminar, la lista se actualiza automáticamente.',
          side: 'left'
        }
      ]
    }]);

    this.routeSub = this.route.queryParamMap.subscribe((params) => {
      if (params.get('focus') === 'ocs-duplicates') {
        setTimeout(() => {
          this.scrollToOcsDuplicatesSection();
          if (params.get('runSearch') === '1' && !this.isSearchingOcsDuplicates) {
            void this.buscarDuplicadosOcs();
          }
        }, 350);
      }
    });
  }

  private scrollToOcsDuplicatesSection(): void {
    const el = document.getElementById('ocs-duplicates-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private resetScroll(): void {
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.tourCleanup?.();
    this.tourCleanup = undefined;
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
        this.notificationService.showSuccessMessage('Reseteo de tablas OCS completado exitosamente');
      }
    } catch (err: any) {
      this.error = err.message || 'Error durante el reseteo completo';
      this.notificationService.showError(
        'Error de Reseteo',
        'No se pudo completar el reseteo de tablas OCS: ' + err.message
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

  async buscarDuplicadosOcs() {
    this.isSearchingOcsDuplicates = true;
    this.ocsDuplicatesError = null;
    this.ocsDuplicatesResult = null;

    try {
      const response = await this.http
        .get<ApiResponse<any[]>>(`${this.apiUrl}/duplicates/ocs`)
        .toPromise();

      if (response && response.success) {
        this.ocsDuplicatesResult = response.data || [];
        this.notificationService.showSuccessMessage(
          `Búsqueda en OCS completada. Se encontraron ${this.ocsDuplicatesResult.length} grupos de duplicados`
        );
        this.ocsDuplicatesAlert.refresh(false);
      } else {
        this.ocsDuplicatesError = response?.message || 'Error al buscar duplicados en OCS';
        this.notificationService.showError('Error al Buscar Duplicados en OCS', this.ocsDuplicatesError);
      }
    } catch (err: any) {
      this.ocsDuplicatesError = err.message || 'Error durante la búsqueda de duplicados en OCS';
      this.notificationService.showError(
        'Error al Buscar Duplicados en OCS',
        'No se pudo completar la búsqueda: ' + err.message
      );
    } finally {
      this.isSearchingOcsDuplicates = false;
    }
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
        this.notificationService.showSuccessMessage(
          `Búsqueda en Cerbero completada. Se encontraron ${this.duplicatesResult.length} grupos de duplicados`
        );
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
    
    const confirmacion = confirm(
      `¿Eliminar el duplicado "${hardwareName}" (ID: ${hardwareId}) de la base Cerbero?\n\n` +
        'Se borrarán todos los datos relacionados con ese hardware en Cerbero. Esta acción NO se puede deshacer.'
    );
    
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

  probarAvisoInactividad(): void {
    this.sessionIdle.simulateIdleWarningForTest();
  }

  probarCierreInactividad(): void {
    if (!confirm('¿Simular cierre de sesión por inactividad ahora? Serás redirigido al login.')) {
      return;
    }
    this.sessionIdle.simulateIdleLogoutForTest();
  }

  async compararBasesDatos() {
    // ✅ VERIFICAR PERMISOS antes de proceder
    if (!this.canAccessSettings()) {
      this.notificationService.showError(
        'Permisos Insuficientes',
        'No tienes permisos para comparar las bases de datos. Solo los administradores pueden realizar esta acción.'
      );
      return;
    }

    this.isComparingDatabases = true;
    this.comparisonError = null;
    this.comparisonResult = null;

    try {
      console.log('Iniciando comparación de bases de datos...');
      const response = await this.http.get<ApiResponse<any>>(`${this.configService.getApiUrl()}/compare-hardware`).toPromise();
      
      if (response && response.success) {
        this.comparisonResult = response.data;
        console.log('Resultados de comparación obtenidos:', this.comparisonResult);
        
        const a = this.comparisonResult.analisis;
        const dupOcs = a?.totalDuplicadosOCS ?? 0;
        const diff = a?.diferenciaTotal ?? 0;
        this.notificationService.showSuccessMessage(
          `Comparación OCS vs Cerbero: ${this.comparisonResult.soloEnOCS.length} solo en OCS, ` +
            `${this.comparisonResult.soloEnCerbero.length} solo en Cerbero, ` +
            `${dupOcs} grupo(s) duplicado(s) en OCS. Diferencia de nombres únicos: ${diff >= 0 ? '+' : ''}${diff}.`
        );
      } else {
        throw new Error(response?.message || 'Error al comparar las bases de datos');
      }
    } catch (err: any) {
      console.error('Error al comparar bases de datos:', err);
      this.comparisonError = err.message || 'Error durante la comparación de bases de datos';
      this.notificationService.showError(
        'Error al Comparar Bases de Datos',
        'No se pudo completar la comparación: ' + err.message
      );
    } finally {
      this.isComparingDatabases = false;
    }
  }

}
