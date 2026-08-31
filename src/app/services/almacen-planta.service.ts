import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { BaseRestService } from './base-rest.service';
import { NotificationService } from './notification.service';
import { AlmacenPlanta, AlmacenPlantaObjeto } from '../interfaces/almacen-planta.interface';

@Injectable({
  providedIn: 'root'
})
export class AlmacenPlantaService extends BaseRestService {
  protected apiUrl = `${environment.apiUrl}/almacen-planta`;

  constructor(
    http: HttpClient,
    notificationService: NotificationService
  ) {
    super(http, notificationService);
  }

  getByAlmacenId(almacenId: number): Observable<AlmacenPlanta> {
    return this.http
      .get<{ success: boolean; data: AlmacenPlanta; message: string }>(`${this.apiUrl}/almacen/${almacenId}`)
      .pipe(map(response => this.normalize(response.data, almacenId)));
  }

  saveByAlmacenId(almacenId: number, planta: AlmacenPlanta, silent = false): Observable<AlmacenPlanta> {
    const body = {
      gridCols: planta.gridCols,
      gridRows: planta.gridRows,
      objetos: (planta.objetos || []).map(o => this.toPayload(o)),
    };
    return this.http
      .put<{ success: boolean; data: AlmacenPlanta; message: string }>(`${this.apiUrl}/almacen/${almacenId}`, body)
      .pipe(
        map(response => {
          if (!silent) {
            this.showSuccessMessage('Planta del almacén guardada');
          }
          return this.normalize(response.data, almacenId);
        })
      );
  }

  private toPayload(o: AlmacenPlantaObjeto): AlmacenPlantaObjeto {
    return {
      tipo: o.tipo,
      estanteriaCodigo: o.tipo === 'ESTANTERIA' ? (o.estanteriaCodigo ?? null) : null,
      etiqueta: o.etiqueta ?? null,
      x: o.x,
      y: o.y,
      ancho: o.ancho,
      alto: o.alto,
      color: o.color ?? null,
    };
  }

  private normalize(data: AlmacenPlanta | null | undefined, almacenId: number): AlmacenPlanta {
    const objetos = (data?.objetos ?? []).map((o, i) => ({
      ...o,
      clientKey: o.id != null ? `id-${o.id}` : `tmp-${i}-${o.tipo}-${o.x}-${o.y}`,
    }));
    return {
      id: data?.id ?? null,
      almacenId: data?.almacenId ?? almacenId,
      gridCols: data?.gridCols && data.gridCols >= 8 ? data.gridCols : 40,
      gridRows: data?.gridRows && data.gridRows >= 8 ? data.gridRows : 30,
      objetos,
      ocupacionPorEstanteria: data?.ocupacionPorEstanteria ?? {},
    };
  }
}
