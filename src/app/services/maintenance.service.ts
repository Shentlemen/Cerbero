import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';

/** Tiempo máximo (ms) para esperar confirmación del backend en activación optimista */
const OPTIMISTIC_TIMEOUT_MS = 15000;

export interface MaintenanceLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'progress';
}

export interface MaintenanceStatus {
  maintenance: boolean;
  reason: string;
  startTime: string | null;
  initiatedBy: string;
  remainingMinutes: number;
  timeoutMinutes: number;
  logs: MaintenanceLog[];
}

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {
  private maintenanceModeSubject = new BehaviorSubject<boolean>(false);
  private maintenanceReasonSubject = new BehaviorSubject<string>('');
  private remainingMinutesSubject = new BehaviorSubject<number>(0);
  private logsSubject = new BehaviorSubject<MaintenanceLog[]>([]);
  
  public maintenanceMode$ = this.maintenanceModeSubject.asObservable();
  public maintenanceReason$ = this.maintenanceReasonSubject.asObservable();
  public remainingMinutes$ = this.remainingMinutesSubject.asObservable();
  public logs$ = this.logsSubject.asObservable();

  private pollingSubscription: Subscription | null = null;
  private lastLogCount = 0;
  /** True cuando el overlay se activó al hacer clic en "Verificar cambios" (backend puede no haber activado aún) */
  private isOptimisticActivation = false;
  private optimisticStartTime = 0;

  constructor(private http: HttpClient) {
    // Iniciar polling lento para detectar activación de mantenimiento
    this.startSlowPolling();
  }

  /**
   * Polling (cada 2.5 seg) cuando NO hay mantenimiento activo - detecta más rápido
   */
  private startSlowPolling(): void {
    this.stopPolling();
    this.pollingSubscription = interval(2500).subscribe(() => {
      if (!this.maintenanceModeSubject.value) {
        this.checkForMaintenanceActivation();
      }
    });
    // Verificar inmediatamente
    this.checkForMaintenanceActivation();
  }

  /**
   * Polling rápido (cada 3 seg) cuando SÍ hay mantenimiento activo
   */
  private startFastPolling(): void {
    this.stopPolling();
    this.pollingSubscription = interval(3000).subscribe(() => {
      this.updateMaintenanceStatus();
    });
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  /**
   * Verifica si se activó el modo mantenimiento
   */
  private checkForMaintenanceActivation(): void {
    this.http.get<MaintenanceStatus>(`${environment.apiUrl}/maintenance/status`).subscribe({
      next: (status) => {
        if (status.maintenance && !this.maintenanceModeSubject.value) {
          console.log('🔧 Modo mantenimiento DETECTADO - activando overlay');
          this.activateMaintenanceMode(status);
        }
      },
      error: () => { /* Ignorar errores en polling lento */ }
    });
  }

  /**
   * Activa el modo mantenimiento y empieza polling rápido
   */
  private activateMaintenanceMode(status: MaintenanceStatus): void {
    this.maintenanceModeSubject.next(true);
    this.maintenanceReasonSubject.next(status.reason);
    this.remainingMinutesSubject.next(status.remainingMinutes);
    
    // Cargar logs iniciales
    if (status.logs && status.logs.length > 0) {
      this.logsSubject.next(status.logs);
      this.lastLogCount = status.logs.length;
    }
    
    // Cambiar a polling rápido para actualizar logs
    this.startFastPolling();
  }

  /**
   * Actualiza el estado durante mantenimiento activo
   */
  private updateMaintenanceStatus(): void {
    this.http.get<MaintenanceStatus>(`${environment.apiUrl}/maintenance/status`).subscribe({
      next: (status) => {
        if (!status.maintenance) {
          // En activación optimista: el backend puede no haber activado aún
          if (this.isOptimisticActivation) {
            const elapsed = Date.now() - this.optimisticStartTime;
            if (elapsed < OPTIMISTIC_TIMEOUT_MS) {
              return; // Seguir esperando, no desactivar
            }
            // Timeout: la verificación falló (ej. 409)
            console.log('⚠️ Activación optimista timeout - desactivando overlay');
            this.cancelOptimisticActivation();
            return;
          }
          // Mantenimiento terminó normalmente
          console.log('✅ Modo mantenimiento FINALIZADO - recargando página');
          this.maintenanceModeSubject.next(false);
          this.logsSubject.next([]);
          this.lastLogCount = 0;
          this.startSlowPolling();
          window.location.reload();
          return;
        }

        // Backend confirmó mantenimiento - dejar de ser optimista
        if (this.isOptimisticActivation) {
          this.isOptimisticActivation = false;
        }

        // Actualizar minutos restantes
        this.remainingMinutesSubject.next(status.remainingMinutes);

        // Actualizar logs SOLO si hay nuevos (evita titileo)
        if (status.logs && status.logs.length > this.lastLogCount) {
          console.log(`📋 Nuevos logs: ${status.logs.length - this.lastLogCount}`);
          this.logsSubject.next(status.logs);
          this.lastLogCount = status.logs.length;
        }
      },
      error: () => { /* Ignorar errores */ }
    });
  }

  /**
   * Consulta el estado de mantenimiento del servidor (para uso externo)
   */
  checkMaintenanceStatus(): Observable<MaintenanceStatus> {
    return this.http.get<MaintenanceStatus>(`${environment.apiUrl}/maintenance/status`);
  }

  /**
   * Activa el overlay inmediatamente al hacer clic en "Verificar cambios".
   * Inicia polling para obtener logs. Si el backend no activa en ~15s, se cancela (ej. error 409).
   */
  activateOptimistic(reason: string): void {
    this.isOptimisticActivation = true;
    this.optimisticStartTime = Date.now();
    this.maintenanceModeSubject.next(true);
    this.maintenanceReasonSubject.next(reason);
    this.logsSubject.next([]);
    this.lastLogCount = 0;
    this.startFastPolling();
  }

  /**
   * Cancela la activación optimista (ej. cuando la verificación falla con 409)
   */
  cancelOptimisticActivation(): void {
    this.isOptimisticActivation = false;
    this.maintenanceModeSubject.next(false);
    this.maintenanceReasonSubject.next('');
    this.logsSubject.next([]);
    this.lastLogCount = 0;
    this.startSlowPolling();
  }

  /**
   * Llamado cuando se recibe 503 (otro usuario bloqueado). Obtiene logs e inicia polling.
   */
  onMaintenanceDetectedFrom503(reason: string): void {
    this.maintenanceModeSubject.next(true);
    this.maintenanceReasonSubject.next(reason);
    this.isOptimisticActivation = false;
    // Obtener estado completo (incl. logs) - /maintenance/status está permitido durante mantenimiento
    this.http.get<MaintenanceStatus>(`${environment.apiUrl}/maintenance/status`).subscribe({
      next: (status) => {
        if (status.logs && status.logs.length > 0) {
          this.logsSubject.next(status.logs);
          this.lastLogCount = status.logs.length;
        }
        this.remainingMinutesSubject.next(status.remainingMinutes);
        this.startFastPolling();
      },
      error: () => {
        this.startFastPolling(); // Igual empezar polling para obtener logs después
      }
    });
  }

  /**
   * Establece el estado de mantenimiento localmente (legacy, para compatibilidad)
   */
  setMaintenanceMode(isActive: boolean, reason: string = '', remainingMinutes: number = 0): void {
    this.maintenanceModeSubject.next(isActive);
    this.maintenanceReasonSubject.next(reason);
    this.remainingMinutesSubject.next(remainingMinutes);
  }

  /**
   * Verifica si el modo mantenimiento está activo
   */
  isMaintenanceModeActive(): boolean {
    return this.maintenanceModeSubject.value;
  }

  /**
   * Obtiene la razón del mantenimiento
   */
  getMaintenanceReason(): string {
    return this.maintenanceReasonSubject.value;
  }

  /**
   * Obtiene los logs actuales
   */
  getLogs(): MaintenanceLog[] {
    return this.logsSubject.value;
  }

  /**
   * Limpia los logs
   */
  clearLogs(): void {
    this.logsSubject.next([]);
    this.lastLogCount = 0;
  }
}
