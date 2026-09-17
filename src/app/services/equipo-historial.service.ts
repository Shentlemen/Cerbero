import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { ApiResponse } from '../interfaces/api-response.interface';
import { EquipoHistorialDTO, EquipoHistorialPageDTO } from '../interfaces/equipo-historial.interface';

export interface EquipoHistorialFiltros {
  hardwareId?: number | null;
  pcName?: string;
  categoria?: string;
  tipo?: string;
  usuarioWin?: string;
  desde?: string;
  hasta?: string;
  page?: number;
  size?: number;
}

@Injectable({
  providedIn: 'root'
})
export class EquipoHistorialService {
  private readonly apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/equipos-historial`;
  }

  buscar(filtros: EquipoHistorialFiltros = {}): Observable<EquipoHistorialPageDTO> {
    let params = new HttpParams();
    if (filtros.hardwareId != null) {
      params = params.set('hardwareId', String(filtros.hardwareId));
    }
    if (filtros.pcName) {
      params = params.set('pcName', filtros.pcName);
    }
    if (filtros.categoria) {
      params = params.set('categoria', filtros.categoria);
    }
    if (filtros.tipo) {
      params = params.set('tipo', filtros.tipo);
    }
    if (filtros.usuarioWin) {
      params = params.set('usuarioWin', filtros.usuarioWin);
    }
    if (filtros.desde) {
      params = params.set('desde', filtros.desde);
    }
    if (filtros.hasta) {
      params = params.set('hasta', filtros.hasta);
    }
    params = params.set('page', String(filtros.page ?? 0));
    params = params.set('size', String(filtros.size ?? 50));

    return this.http.get<ApiResponse<EquipoHistorialPageDTO>>(this.apiUrl, { params }).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error(response.message || 'No se pudo cargar el historial');
      })
    );
  }

  porEquipo(hardwareId: number): Observable<EquipoHistorialDTO[]> {
    return this.http.get<ApiResponse<EquipoHistorialDTO[]>>(`${this.apiUrl}/equipo/${hardwareId}`).pipe(
      map(response => {
        if (response.success) {
          return response.data ?? [];
        }
        throw new Error(response.message || 'No se pudo cargar el historial del equipo');
      })
    );
  }
}
