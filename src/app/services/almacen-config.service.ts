import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BaseRestService } from './base-rest.service';
import { NotificationService } from './notification.service';
import { map } from 'rxjs/operators';
import { AlmacenConfig, AlmacenConfigCreate } from '../interfaces/almacen-config.interface';

@Injectable({
  providedIn: 'root'
})
export class AlmacenConfigService extends BaseRestService {
  protected apiUrl = `${environment.apiUrl}/almacen-config`;

  constructor(
    http: HttpClient,
    notificationService: NotificationService
  ) {
    super(http, notificationService);
  }

  getAllConfigs(): Observable<AlmacenConfig[]> {
    return this.http.get<{success: boolean, data: AlmacenConfig[], message: string}>(this.apiUrl)
      .pipe(
        map(response => response.data || [])
      );
  }

  getConfigById(id: number): Observable<AlmacenConfig> {
    return this.http.get<{success: boolean, data: AlmacenConfig, message: string}>(`${this.apiUrl}/${id}`)
      .pipe(
        map(response => response.data)
      );
  }

  getConfigByAlmacenId(almacenId: number): Observable<AlmacenConfig | null> {
    return this.http.get<{success: boolean, data: AlmacenConfig | null, message: string}>(`${this.apiUrl}/almacen/${almacenId}`)
      .pipe(
        map(response => response.data || null)
      );
  }

  createConfig(config: AlmacenConfigCreate): Observable<AlmacenConfig> {
    // Convertir a formato que espera el backend
    const requestBody = {
      almacen: { id: config.almacenId },
      nombre: config.nombre,
      cantidadEstanterias: config.cantidadEstanterias,
      cantidadEstantesPorEstanteria: config.cantidadEstantesPorEstanteria,
      divisionesEstante: config.divisionesEstante
    };

    return this.http.post<{success: boolean, data: AlmacenConfig, message: string}>(this.apiUrl, requestBody)
      .pipe(
        map(response => {
          this.showSuccessMessage('Configuración de almacén creada exitosamente');
          return response.data;
        })
      );
  }

  updateConfig(id: number, config: AlmacenConfigCreate): Observable<AlmacenConfig> {
    const requestBody = {
      almacen: { id: config.almacenId },
      nombre: config.nombre,
      cantidadEstanterias: config.cantidadEstanterias,
      cantidadEstantesPorEstanteria: config.cantidadEstantesPorEstanteria,
      divisionesEstante: config.divisionesEstante
    };

    return this.http.put<{success: boolean, data: AlmacenConfig, message: string}>(`${this.apiUrl}/${id}`, requestBody)
      .pipe(
        map(response => {
          this.showSuccessMessage('Configuración de almacén actualizada exitosamente');
          return response.data;
        })
      );
  }

  deleteConfig(id: number): Observable<void> {
    return this.http.delete<{success: boolean, message: string}>(`${this.apiUrl}/${id}`)
      .pipe(
        map(() => {
          this.showSuccessMessage('Configuración de almacén eliminada exitosamente');
        })
      );
  }

  /**
   * Obtiene las divisiones como array de strings
   */
  getDivisionesArray(divisionesEstante: string): string[] {
    if (!divisionesEstante || divisionesEstante.trim().length === 0) {
      return ['A', 'B', 'C'];
    }
    return divisionesEstante.split(',').map(d => d.trim()).filter(d => d.length > 0);
  }
}

