import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiResponse } from '../interfaces/api-response.interface';
import { map } from 'rxjs/operators';
import { UbicacionDTO, UbicacionSimpleDTO } from '../interfaces/ubicacion.interface';
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

  crearUbicacionEquipo(ubicacion: Omit<UbicacionDTO, 'id' | 'deviceName'>): Observable<UbicacionDTO> {
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

  crearUbicacionDispositivo(ubicacion: Omit<UbicacionDTO, 'id' | 'deviceName'>): Observable<UbicacionDTO> {
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

  actualizarUbicacionEquipo(hardwareId: number, ubicacion: Omit<UbicacionDTO, 'id' | 'tipo' | 'hardwareId' | 'macaddr' | 'deviceName'>): Observable<UbicacionDTO> {
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

  actualizarUbicacionDispositivo(macaddr: string, ubicacion: Omit<UbicacionDTO, 'id' | 'tipo' | 'hardwareId' | 'macaddr' | 'deviceName'>): Observable<UbicacionDTO> {
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
} 