import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiResponse } from '../interfaces/api-response.interface';
import { map, catchError } from 'rxjs/operators';

export interface TipoDeActivoDTO {
    idActivo: number;      // ID único del tipo de activo
    nombre: string;        // Nombre del tipo de activo
    descripcion: string;   // Descripción del tipo de activo
    idUsuario: number;     // ID del usuario responsable (FK a usuario)
}

@Injectable({
  providedIn: 'root'
})
export class TiposActivoService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/tipos-activo`;
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ha ocurrido un error en la operación';
    
    if (error.error instanceof ErrorEvent) {
      // Error del cliente
      errorMessage = error.error.message;
    } else {
      // Error del servidor
      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else {
        switch (error.status) {
          case 404:
            errorMessage = 'El tipo de activo no fue encontrado';
            break;
          case 400:
            errorMessage = 'Datos inválidos para el tipo de activo';
            break;
          case 500:
            errorMessage = 'Error interno del servidor';
            break;
        }
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  getTiposActivo(): Observable<TipoDeActivoDTO[]> {
    return this.http.get<ApiResponse<TipoDeActivoDTO[]>>(this.apiUrl).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      }),
      catchError(this.handleError)
    );
  }

  getTipoActivo(id: number): Observable<TipoDeActivoDTO> {
    return this.http.get<ApiResponse<TipoDeActivoDTO>>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      }),
      catchError(this.handleError)
    );
  }

  getTiposActivoByUsuario(idUsuario: number): Observable<TipoDeActivoDTO[]> {
    return this.http.get<ApiResponse<TipoDeActivoDTO[]>>(`${this.apiUrl}/by-usuario/${idUsuario}`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  crearTipoActivo(tipoActivo: Omit<TipoDeActivoDTO, 'idActivo'>): Observable<TipoDeActivoDTO> {
    return this.http.post<ApiResponse<TipoDeActivoDTO>>(this.apiUrl, tipoActivo).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      }),
      catchError(this.handleError)
    );
  }

  actualizarTipoActivo(id: number, tipoActivo: TipoDeActivoDTO): Observable<TipoDeActivoDTO> {
    return this.http.put<ApiResponse<TipoDeActivoDTO>>(`${this.apiUrl}/${id}`, tipoActivo).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      }),
      catchError(this.handleError)
    );
  }

  eliminarTipoActivo(id: number): Observable<void> {
    return this.http.delete(`${this.apiUrl}/${id}`, { observe: 'response' }).pipe(
      map(response => {
        // Si la respuesta es 204 (No Content), consideramos que fue exitosa
        if (response.status === 204) {
          return;
        }
        // Si hay una respuesta con cuerpo, verificamos el success
        const apiResponse = response.body as ApiResponse<null>;
        if (apiResponse && !apiResponse.success) {
          throw new Error(apiResponse.message);
        }
      }),
      catchError(this.handleError)
    );
  }
} 