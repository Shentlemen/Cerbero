import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';

export interface ActivoDTO {
  idActivo: number;
  hardwareId: number;
  criticidad: string;
  clasificacionDeINFO: string;
  estado: string;
  idTipoActivo: number;
  idNumeroCompra: number;
  idItem: number;
  idEntrega: number;
  idUbicacion: number;
  idUsuario: number;
  idSecundario: string;
  idServicioGarantia: number;
  fechaFinGarantia: string;
  activosRelacionados?: number[];
}

@Injectable({
  providedIn: 'root'
})
export class ActivosService {
  private apiUrl = `${environment.apiUrl}/activos`;

  constructor(private http: HttpClient) { }

  getActivos(): Observable<ActivoDTO[]> {
    return this.http.get<ActivoDTO[] | { data: ActivoDTO[] }>(this.apiUrl).pipe(
      map(response => {
        if (Array.isArray(response)) {
          return response;
        } else if (response && 'data' in response) {
          return response.data;
        }
        throw new Error('Formato de respuesta inválido');
      })
    );
  }

  getActivo(id: number): Observable<ActivoDTO> {
    const url = `${this.apiUrl}/${id}`;
    console.log('Llamando a la URL:', url);
    return this.http.get<ApiResponse<ActivoDTO>>(url).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  crearActivo(activo: ActivoDTO): Observable<ActivoDTO> {
    return this.http.post<ActivoDTO>(this.apiUrl, activo);
  }

  actualizarActivo(id: number, activo: ActivoDTO): Observable<ActivoDTO> {
    return this.http.put<ActivoDTO>(`${this.apiUrl}/${id}`, activo);
  }

  eliminarActivo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getActivoByHardwareId(hardwareId: number): Observable<ActivoDTO> {
    return this.http.get<ApiResponse<ActivoDTO>>(`${this.apiUrl}/by-hardware/${hardwareId}`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  getActivosRelacionados(idActivo: number): Observable<number[]> {
    const url = `${this.apiUrl}/${idActivo}/relacionados`;
    console.log('Obteniendo activos relacionados para:', idActivo);
    return this.http.get<ApiResponse<number[]>>(url).pipe(
      map(response => {
        console.log('Respuesta del servidor:', response);
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Error al obtener activos relacionados');
      }),
      catchError(error => {
        console.error('Error al obtener activos relacionados:', error);
        return of([]);
      })
    );
  }

  getActivosByIds(ids: number[]): Observable<ActivoDTO[]> {
    return this.http.get<ActivoDTO[]>(`${this.apiUrl}/by-ids`, { params: { ids: ids.join(',') } });
  }

  agregarRelacion(idActivoOrigen: number, idActivoDestino: number): Observable<ApiResponse<any>> {
    const url = `${this.apiUrl}/relacion`;
    const body = {
      idActivoOrigen,
      idActivoDestino
    };
    console.log('Agregando relación:', body);
    return this.http.post<ApiResponse<any>>(url, body).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Error al agregar relación');
        }
        return response;
      }),
      catchError(error => {
        console.error('Error al agregar relación:', error);
        throw error;
      })
    );
  }

  eliminarRelacion(idActivoOrigen: number, idActivoDestino: number): Observable<ApiResponse<any>> {
    const url = `${this.apiUrl}/relacion`;
    const body = {
      idActivoOrigen,
      idActivoDestino
    };
    console.log('Eliminando relación:', body);
    return this.http.delete<ApiResponse<any>>(url, { body }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Error al eliminar relación');
        }
        return response;
      }),
      catchError(error => {
        console.error('Error al eliminar relación:', error);
        throw error;
      })
    );
  }
} 