// src/app/services/alert.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { catchError, map, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private apiUrl: string;
  private changeDetectionUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/alertas`;
    this.changeDetectionUrl = `${this.configService.getApiUrl()}/change-detection`;
  }

  getAlertas(): Observable<Alerta[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      map(alertas => alertas.map(alerta => ({
        ...alerta,
        memory: Boolean(alerta.memory),
        disk: Boolean(alerta.disk),
        ip: Boolean(alerta.ip),
        video: Boolean(alerta.video),
        softwareForbidden: Boolean(alerta.softwareForbidden),
        confirmada: Boolean(alerta.confirmada),
        new_hardware: alerta.newHardware ? 1 : 0,
        pcName: alerta.pcName || 'Desconocido'
      }))),
      catchError(error => {
        console.error('Error en getAlertas:', error);
        throw error;
      })
    );
  }

  confirmarAlerta(alertaId: number): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/confirmar/${alertaId}`,
      {}
    ).pipe(
      catchError(error => {
        console.error('Error al confirmar alerta:', error);
        return throwError(() => error);
      })
    );
  }

  checkHardwareChanges(): Observable<any> {
    return this.http.get(`${this.changeDetectionUrl}/run-scheduled-task`).pipe(
      catchError(error => {
        console.error('Error en checkHardwareChanges:', error);
        if (error.status === 500) {
          const errorMessage = error.error || 'Error interno del servidor al verificar cambios';
          return throwError(() => new Error(errorMessage));
        }
        return throwError(() => error);
      })
    );
  }

  cleanupOrphanedAlerts(): Observable<any> {
    return this.http.post(`${this.changeDetectionUrl}/cleanup-orphaned-alerts`, {}).pipe(
      catchError(error => {
        console.error('Error en cleanupOrphanedAlerts:', error);
        if (error.status === 500) {
          const errorMessage = error.error || 'Error interno del servidor al limpiar alertas';
          return throwError(() => new Error(errorMessage));
        }
        return throwError(() => error);
      })
    );
  }
}

export interface Alerta {
  id: number;
  hardwareId: number;
  pcName: string;
  fecha: string;
  memory: boolean;
  disk: boolean;
  ip: boolean;
  video: boolean;
  softwareForbidden: boolean;
  confirmada: boolean;
  valorAnterior?: string;
  valorNuevo?: string;
  new_hardware: number;
}

