import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BaseRestService } from './base-rest.service';
import { NotificationService } from './notification.service';
import { map } from 'rxjs/operators';
import { Almacen } from './almacen.service';

export interface ActivoAlmacen {
  id: number;
  activoId: number;
  almacen: Almacen;
  estanteria: string;
  estante: string;
}

export interface ActivoAlmacenCreate {
  activoId: number;
  almacenId: number;
  estanteria: string;
  estante: string;
}

@Injectable({
  providedIn: 'root'
})
export class ActivoAlmacenService extends BaseRestService {
  protected apiUrl = `${environment.apiUrl}/activo-almacen`;

  constructor(
    http: HttpClient,
    notificationService: NotificationService
  ) {
    super(http, notificationService);
  }

  getAllUbicaciones(): Observable<ActivoAlmacen[]> {
    return this.getList<ActivoAlmacen>();
  }

  getUbicacionById(id: number): Observable<ActivoAlmacen> {
    return this.getById<ActivoAlmacen>(id);
  }

  getUbicacionesByActivoId(activoId: number): Observable<ActivoAlmacen[]> {
    return this.getList<ActivoAlmacen>(`activo/${activoId}`);
  }

  createUbicacion(ubicacion: ActivoAlmacenCreate): Observable<ActivoAlmacen> {
    return this.post<ActivoAlmacen>(ubicacion).pipe(
      // Mostrar mensaje de éxito después de crear
      map(result => {
        this.showSuccessMessage('Ubicación creada exitosamente');
        return result;
      })
    );
  }

  updateUbicacion(id: number, ubicacion: ActivoAlmacenCreate): Observable<void> {
    return this.put<void>(id, ubicacion).pipe(
      // Mostrar mensaje de éxito después de actualizar
      map(result => {
        this.showSuccessMessage('Ubicación actualizada exitosamente');
        return result;
      })
    );
  }

  deleteUbicacion(id: number): Observable<void> {
    return this.delete<void>(id).pipe(
      // Mostrar mensaje de éxito después de eliminar
      map(result => {
        this.showSuccessMessage('Ubicación eliminada exitosamente');
        return result;
      })
    );
  }

  deleteUbicacionesByActivoId(activoId: number): Observable<void> {
    return this.delete<void>(activoId, `activo`).pipe(
      // Mostrar mensaje de éxito después de eliminar
      map(result => {
        this.showSuccessMessage('Ubicaciones del activo eliminadas exitosamente');
        return result;
      })
    );
  }

  createUbicacionesBatch(ubicaciones: ActivoAlmacenCreate[]): Observable<ActivoAlmacen[]> {
    // Enviar en el formato que espera el backend: { ubicaciones: [...] }
    const batchRequest = { ubicaciones: ubicaciones };
    return this.http.post<ActivoAlmacen[]>(`${this.apiUrl}/batch`, batchRequest).pipe(
      map(result => {
        this.showSuccessMessage(`Se crearon exitosamente ${result.length} ubicaciones`);
        return result;
      })
    );
  }
} 