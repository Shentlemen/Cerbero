import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiResponse } from '../interfaces/api-response.interface';
import { map, catchError } from 'rxjs/operators';

export interface InternoOseDTO {
  id: number;
  box?: string | null;
  area: string;
  persona?: string | null;
  interno?: string | null;
  app?: string | null;
  esColectivo: boolean;
  activo: boolean;
  fechaCreacion?: string | null;
}

export type InternoOsePayload = Omit<InternoOseDTO, 'id' | 'fechaCreacion'>;

@Injectable({
  providedIn: 'root'
})
export class InternosOseService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.apiUrl}/internos-ose`;
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ha ocurrido un error en la operación';

    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else {
      switch (error.status) {
        case 404:
          errorMessage = 'El interno no fue encontrado';
          break;
        case 400:
          errorMessage = 'Datos inválidos para el interno';
          break;
        case 403:
          errorMessage = 'No tiene permisos para realizar esta acción';
          break;
        case 500:
          errorMessage = 'Error interno del servidor';
          break;
      }
    }

    return throwError(() => new Error(errorMessage));
  }

  getInternos(): Observable<InternoOseDTO[]> {
    return this.http.get<ApiResponse<InternoOseDTO[]>>(this.apiUrl).pipe(
      map(response => {
        if (response.success) {
          return response.data ?? [];
        }
        throw new Error(response.message);
      }),
      catchError(this.handleError)
    );
  }

  getInterno(id: number): Observable<InternoOseDTO> {
    return this.http.get<ApiResponse<InternoOseDTO>>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message);
      }),
      catchError(this.handleError)
    );
  }

  crearInterno(interno: InternoOsePayload): Observable<InternoOseDTO> {
    return this.http.post<ApiResponse<InternoOseDTO>>(this.apiUrl, interno).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message);
      }),
      catchError(this.handleError)
    );
  }

  actualizarInterno(id: number, interno: InternoOsePayload): Observable<InternoOseDTO> {
    return this.http.put<ApiResponse<InternoOseDTO>>(`${this.apiUrl}/${id}`, interno).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message);
      }),
      catchError(this.handleError)
    );
  }

  eliminarInterno(id: number): Observable<void> {
    return this.http.delete(`${this.apiUrl}/${id}`, { observe: 'response' }).pipe(
      map(response => {
        if (response.status === 204) {
          return;
        }
        const apiResponse = response.body as ApiResponse<null>;
        if (apiResponse && !apiResponse.success) {
          throw new Error(apiResponse.message);
        }
      }),
      catchError(this.handleError)
    );
  }
}
