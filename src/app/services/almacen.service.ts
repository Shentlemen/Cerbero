import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BaseRestService } from './base-rest.service';
import { NotificationService } from './notification.service';
import { map } from 'rxjs/operators';

export interface Almacen {
  id: number;
  numero: string;
  nombre: string;
}

@Injectable({
  providedIn: 'root'
})
export class AlmacenService extends BaseRestService {
  protected apiUrl = `${environment.apiUrl}/almacenes`;

  constructor(
    http: HttpClient,
    notificationService: NotificationService
  ) {
    super(http, notificationService);
  }

  getAllAlmacenes(): Observable<Almacen[]> {
    return this.getList<Almacen>();
  }

  getAlmacenById(id: number): Observable<Almacen> {
    return this.getById<Almacen>(id);
  }

  getAlmacenByNumero(numero: string): Observable<Almacen> {
    return this.getById<Almacen>(numero, 'by-numero');
  }

  createAlmacen(almacen: Omit<Almacen, 'id'>): Observable<Almacen> {
    return this.post<Almacen>(almacen).pipe(
      // Mostrar mensaje de éxito después de crear
      map(result => {
        this.showSuccessMessage('Almacén creado exitosamente');
        return result;
      })
    );
  }

  updateAlmacen(id: number, almacen: Almacen): Observable<void> {
    return this.put<void>(id, almacen).pipe(
      // Mostrar mensaje de éxito después de actualizar
      map(result => {
        this.showSuccessMessage('Almacén actualizado exitosamente');
        return result;
      })
    );
  }

  deleteAlmacen(id: number): Observable<void> {
    return this.delete<void>(id).pipe(
      // Mostrar mensaje de éxito después de eliminar
      map(result => {
        this.showSuccessMessage('Almacén eliminado exitosamente');
        return result;
      })
    );
  }
} 