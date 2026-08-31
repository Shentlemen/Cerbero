import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { firstValueFrom, timeout } from 'rxjs';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, NgbModule, NotificationContainerComponent, FormsModule],
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

  // Propiedades para duplicados OCS
  isSearchingOcsDuplicates = false;
  ocsDuplicatesResult: any[] | null = null;
  ocsDuplicatesError: string | null = null;
  isDeletingOcs = false;
  
  // Propiedades para comparación de bases de datos
  isComparingDatabases = false;
  comparisonResult: any = null;
  comparisonError: string | null = null;

  // Export CSV Grafana
  isExportingCsv = false;
  csvExportError: string | null = null;

  // Diagnóstico inventario
  isLoadingHealth = false;
  healthResult: any = null;
  healthError: string | null = null;

  isLoadingStale = false;
  staleResult: any = null;
  staleError: string | null = null;
  staleDays = 30;
  staleSource: 'cerbero' | 'ocs' = 'cerbero';

  private diagnosticsUrl: string;
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
    this.diagnosticsUrl = `${this.configService.getApiUrl()}/sync/inventory-diagnostics`;
  }

  ngOnInit(): void {
    if (this.canAccessSettings()) {
      void this.cargarSaludInventario();
    }

    this.tourCleanup = this.tourRegistry.register('settings', [{
      id: 'settings-overview',
      title: 'Tour de mantenimiento de BD',
      icon: 'fa-route',
      beforeStart: () => this.resetScroll(),
      afterEnd: () => this.resetScroll(),
      steps: [
        {
          selector: '#tour-settings-title',
          title: 'Mantenimiento de bases de datos',
          description:
            'Pantalla de <strong>mantenimiento y diagnóstico</strong> de inventario (solo GM). Incluye salud OCS/Cerbero, ' +
            'equipos sin reportar, reseteo, duplicados y export CSV.',
          side: 'bottom'
        },
        {
          selector: '#tour-settings-health',
          title: 'Salud del inventario',
          description:
            'Resumen de conteos OCS vs Cerbero, duplicados, alertas abiertas y equipos sin reportar (7/30/90 días). Solo lectura.',
          side: 'top'
        },
        {
          selector: '#tour-settings-stale',
          title: 'Equipos sin reportar',
          description:
            'Lista equipos cuyo <code>lastcome</code> es antiguo o nulo. Podés filtrar por días y base (Cerbero u OCS).',
          side: 'top'
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
          selector: '#tour-settings-grafana-export',
          title: 'Exportar CSV para Grafana',
          description:
            'Descarga un <strong>ZIP</strong> con CSV del inventario (hardware, componentes, software, subredes) ' +
            'más vistas denormalizadas listas para paneles Grafana. La generación puede demorar si hay mucho software.',
          side: 'top'
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
            'Desde los resultados podés <strong>eliminar</strong> un duplicado: se borra ese hardware en OCS y todos sus datos relacionados. ' +
            'Debe quedar al menos un registro con ese nombre. El badge naranja del perro también puede llevarte acá.',
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

  async cargarSaludInventario(notificar = false): Promise<void> {
    this.isLoadingHealth = true;
    this.healthError = null;
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<any>>(`${this.diagnosticsUrl}/health`)
      );
      if (response?.success) {
        this.healthResult = response.data;
        if (notificar) {
          const cerbero = response.data?.cerbero?.total ?? '—';
          const ocs = response.data?.ocs?.total ?? '—';
          this.notificationService.showSuccessMessage(
            `Salud del inventario actualizada. Cerbero: ${cerbero} equipos · OCS: ${ocs}.`
          );
        }
      } else {
        throw new Error(response?.message || 'Error al cargar salud del inventario');
      }
    } catch (err: any) {
      const mensaje = err?.error?.message || err?.message || 'Error al cargar salud del inventario';
      this.healthError = mensaje;
      this.healthResult = null;
      if (notificar) {
        this.notificationService.showError('Salud del inventario', mensaje);
      }
    } finally {
      this.isLoadingHealth = false;
    }
  }

  async cargarEquiposSinReportar(): Promise<void> {
    this.isLoadingStale = true;
    this.staleError = null;
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<any>>(`${this.diagnosticsUrl}/stale`, {
          params: {
            days: String(this.staleDays),
            source: this.staleSource
          }
        })
      );
      if (response?.success) {
        this.staleResult = response.data;
      } else {
        throw new Error(response?.message || 'Error al listar equipos sin reportar');
      }
    } catch (err: any) {
      this.staleError = err?.error?.message || err?.message || 'Error al listar equipos sin reportar';
      this.staleResult = null;
    } finally {
      this.isLoadingStale = false;
    }
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
        this.notificationService.showError(
          'Error al Buscar Duplicados en OCS',
          this.ocsDuplicatesError ?? 'Error desconocido'
        );
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

  async eliminarDuplicadoOcs(hardwareId: number, hardwareName: string): Promise<void> {
    if (this.isDeletingOcs) {
      return;
    }
    if (!this.canAccessSettings()) {
      this.notificationService.showError(
        'Permisos Insuficientes',
        'Solo GM puede eliminar duplicados en OCS.'
      );
      return;
    }

    const confirmacion = confirm(
      `¿Eliminar el duplicado "${hardwareName}" (ID: ${hardwareId}) de la base OCS?\n\n` +
        'Se borrarán ese hardware y todos sus datos relacionados en OCS ' +
        '(bios, CPU, memoria, discos, software, redes, etc.).\n' +
        'Debe quedar al menos un equipo con ese nombre.\n\n' +
        'Esta acción NO se puede deshacer.'
    );
    if (!confirmacion) {
      return;
    }

    this.isDeletingOcs = true;
    try {
      const response = await this.http
        .delete<ApiResponse<any>>(`${this.apiUrl}/duplicates/ocs/${hardwareId}`)
        .toPromise();

      if (response && response.success) {
        this.notificationService.showSuccessMessage(
          response.message || `Duplicado OCS "${hardwareName}" eliminado`
        );
        await this.buscarDuplicadosOcs();
        this.ocsDuplicatesAlert.refresh(false);
      } else {
        throw new Error(response?.message || 'Error al eliminar el duplicado en OCS');
      }
    } catch (err: any) {
      const msg =
        err?.error?.message || err?.message || 'Error al eliminar el duplicado en OCS';
      this.notificationService.showError('Error al Eliminar Duplicado en OCS', msg);
    } finally {
      this.isDeletingOcs = false;
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

  async exportarCsvGrafana(): Promise<void> {
    if (!this.canAccessSettings()) {
      this.notificationService.showError(
        'Permisos Insuficientes',
        'Solo GM puede exportar el inventario a CSV.'
      );
      return;
    }

    this.isExportingCsv = true;
    this.csvExportError = null;

    try {
      const blob = await firstValueFrom(
        this.http
          .get(`${this.configService.getApiUrl()}/sync/export/grafana-csv`, {
            responseType: 'blob'
          })
          .pipe(timeout(30 * 60 * 1000))
      );

      if (!blob || blob.size === 0) {
        throw new Error('El archivo descargado está vacío');
      }

      if (blob.type && blob.type.includes('application/json')) {
        const text = await blob.text();
        throw new Error(text || 'Error al generar el export');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `cerbero_grafana_${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      this.notificationService.showSuccessMessage('Export CSV para Grafana descargado');
    } catch (err: any) {
      let message = err?.message || 'Error al exportar CSV';
      if (err?.name === 'TimeoutError') {
        message = 'La exportación tardó demasiado. Probá de nuevo o exportá en un momento de menor carga.';
      }
      if (err?.error instanceof Blob) {
        try {
          const text = await err.error.text();
          if (text) {
            message = text;
          }
        } catch {
          /* ignore */
        }
      }
      this.csvExportError = message;
      this.notificationService.showError('Error al exportar CSV', message);
    } finally {
      this.isExportingCsv = false;
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
