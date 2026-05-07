import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiResponse } from '../interfaces/api-response.interface';
import { map } from 'rxjs/operators';
import { UbicacionDTO, UbicacionHistorialDTO, UbicacionSimpleDTO } from '../interfaces/ubicacion.interface';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UbicacionesService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = this.configService.getApiUrl();
  }

  getUbicaciones(tipo?: 'EQUIPO' | 'DISPOSITIVO'): Observable<UbicacionDTO[]> {
    let params = new HttpParams();
    if (tipo) {
      params = params.set('tipo', tipo);
    }
    return this.http.get<ApiResponse<UbicacionDTO[]>>(`${this.apiUrl}/ubicaciones`, { params }).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  getUbicacionEquipo(hardwareId: number): Observable<UbicacionDTO> {
    return this.http.get<ApiResponse<UbicacionDTO>>(`${this.apiUrl}/ubicaciones/equipos/${hardwareId}`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  getHistorialUbicacionesEquipo(hardwareId: number): Observable<UbicacionHistorialDTO[]> {
    return this.http.get<ApiResponse<UbicacionHistorialDTO[]>>(`${this.apiUrl}/ubicaciones/equipos/${hardwareId}/historial`).pipe(
      map(response => {
        if (response.success) {
          return response.data ?? [];
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  deleteHistorialUbicacion(historialId: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/ubicaciones/equipos/historial/${historialId}`).pipe(
      map(response => {
        if (response.success) {
          return;
        }
        throw new Error(response.message || 'No se pudo eliminar el movimiento del historial');
      })
    );
  }

  getUbicacionDispositivo(macaddr: string): Observable<UbicacionDTO> {
    return this.http.get<ApiResponse<UbicacionDTO>>(`${this.apiUrl}/ubicaciones/dispositivos/${macaddr}`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  crearUbicacionEquipo(ubicacion: { id: number; hardwareId: number; tipo: 'EQUIPO' }): Observable<UbicacionDTO> {
    return this.http.post<ApiResponse<UbicacionDTO>>(`${this.apiUrl}/ubicaciones/equipos`, ubicacion).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  crearUbicacionDispositivo(ubicacion: { id: number; macaddr: string; tipo: 'DISPOSITIVO' }): Observable<UbicacionDTO> {
    return this.http.post<ApiResponse<UbicacionDTO>>(`${this.apiUrl}/ubicaciones/dispositivos`, ubicacion).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  actualizarUbicacionEquipo(hardwareId: number, ubicacion: { id: number; hardwareId: number; tipo: 'EQUIPO' }): Observable<UbicacionDTO> {
    return this.http.put<ApiResponse<UbicacionDTO>>(`${this.apiUrl}/ubicaciones/equipos/${hardwareId}`, ubicacion).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  actualizarUbicacionDispositivo(macaddr: string, ubicacion: { id: number; macaddr: string; tipo: 'DISPOSITIVO' }): Observable<UbicacionDTO> {
    return this.http.put<ApiResponse<UbicacionDTO>>(`${this.apiUrl}/ubicaciones/dispositivos/${macaddr}`, ubicacion).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  eliminarUbicacion(idUbicacion: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/ubicaciones/${idUbicacion}`);
  }

  // Obtener todas las ubicaciones simples
  getUbicacionesSimple(): Observable<ApiResponse<UbicacionSimpleDTO[]>> {
    return this.http.get<ApiResponse<UbicacionSimpleDTO[]>>(`${this.apiUrl}/ubicaciones/simple`);
  }

  // Crear una ubicación simple
  crearUbicacionSimple(ubicacion: Omit<UbicacionSimpleDTO, 'idUbicacion'>): Observable<ApiResponse<UbicacionSimpleDTO>> {
    return this.http.post<ApiResponse<UbicacionSimpleDTO>>(`${this.apiUrl}/ubicaciones/simple`, ubicacion);
  }

  // Actualizar una ubicación
  actualizarUbicacion(idUbicacion: number, ubicacion: Omit<UbicacionSimpleDTO, 'idUbicacion'>): Observable<ApiResponse<UbicacionSimpleDTO>> {
    return this.http.put<ApiResponse<UbicacionSimpleDTO>>(`${this.apiUrl}/ubicaciones/${idUbicacion}`, ubicacion);
  }

  // GESTIÓN DE UBICACIONES (tabla ubicaciones)
  getUbicacionesData(): Observable<UbicacionDTO[]> {
    return this.http.get<ApiResponse<UbicacionDTO[]>>(`${this.apiUrl}/ubicaciones/data`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  getUbicacionDataById(idUbicacion: number): Observable<UbicacionDTO> {
    return this.http.get<ApiResponse<UbicacionDTO>>(`${this.apiUrl}/ubicaciones/data/${idUbicacion}`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  crearUbicacionData(ubicacion: Omit<UbicacionDTO, 'id'>): Observable<UbicacionDTO> {
    return this.http.post<ApiResponse<UbicacionDTO>>(`${this.apiUrl}/ubicaciones/data`, ubicacion).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  actualizarUbicacionData(idUbicacion: number, ubicacion: Omit<UbicacionDTO, 'id'>): Observable<UbicacionDTO> {
    return this.http.put<ApiResponse<UbicacionDTO>>(`${this.apiUrl}/ubicaciones/data/${idUbicacion}`, ubicacion).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  eliminarUbicacionData(idUbicacion: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/ubicaciones/data/${idUbicacion}`);
  }
} 