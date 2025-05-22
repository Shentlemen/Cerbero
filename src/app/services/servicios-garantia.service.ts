import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiResponse } from '../interfaces/api-response.interface';
import { map, catchError } from 'rxjs/operators';

export interface ServicioGarantiaDTO {
  idServicioGarantia: number;
  nombre: string;
  correoDeContacto: string;
  telefonoDeContacto: string;
  nombreComercial: string;
  ruc: string;
}

@Injectable({
  providedIn: 'root'
})
export class ServiciosGarantiaService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.apiUrl}/servicios-garantia`;
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
            errorMessage = 'El servicio de garantía no fue encontrado';
            break;
          case 400:
            errorMessage = 'Datos inválidos para el servicio de garantía';
            break;
          case 500:
            errorMessage = 'Error interno del servidor';
            break;
        }
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  getServiciosGarantia(): Observable<ServicioGarantiaDTO[]> {
    return this.http.get<ApiResponse<ServicioGarantiaDTO[]>>(this.apiUrl).pipe(
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

  getServicioGarantia(id: number): Observable<ServicioGarantiaDTO> {
    return this.http.get<ApiResponse<ServicioGarantiaDTO>>(`${this.apiUrl}/${id}`).pipe(
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

  getServicioGarantiaByRUC(ruc: string): Observable<ServicioGarantiaDTO> {
    return this.http.get<ApiResponse<ServicioGarantiaDTO>>(`${this.apiUrl}/by-ruc/${ruc}`).pipe(
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

  crearServicioGarantia(servicioGarantia: Omit<ServicioGarantiaDTO, 'idServicioGarantia'>): Observable<ServicioGarantiaDTO> {
    return this.http.post<ApiResponse<ServicioGarantiaDTO>>(this.apiUrl, servicioGarantia).pipe(
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

  actualizarServicioGarantia(id: number, servicioGarantia: ServicioGarantiaDTO): Observable<ServicioGarantiaDTO> {
    return this.http.put<ApiResponse<ServicioGarantiaDTO>>(`${this.apiUrl}/${id}`, servicioGarantia).pipe(
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

  eliminarServicioGarantia(id: number): Observable<void> {
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