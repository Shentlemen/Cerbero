import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiResponse } from '../interfaces/api-response.interface';
import { map, catchError } from 'rxjs/operators';

export interface TipoDeCompraDTO {
  idTipoCompra: number;
  descripcion: string;
  abreviado?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TiposCompraService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.apiUrl}/tipos-compra`;
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
            errorMessage = 'El tipo de compra no fue encontrado';
            break;
          case 400:
            errorMessage = 'Datos inválidos para el tipo de compra';
            break;
          case 500:
            errorMessage = 'Error interno del servidor';
            break;
        }
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  getTiposCompra(): Observable<TipoDeCompraDTO[]> {
    return this.http.get<ApiResponse<TipoDeCompraDTO[]>>(this.apiUrl).pipe(
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

  getTipoCompra(id: number): Observable<TipoDeCompraDTO> {
    return this.http.get<ApiResponse<TipoDeCompraDTO>>(`${this.apiUrl}/${id}`).pipe(
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

  crearTipoCompra(tipoCompra: Omit<TipoDeCompraDTO, 'idTipoCompra'>): Observable<TipoDeCompraDTO> {
    return this.http.post<ApiResponse<TipoDeCompraDTO>>(this.apiUrl, tipoCompra).pipe(
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

  actualizarTipoCompra(id: number, tipoCompra: TipoDeCompraDTO): Observable<TipoDeCompraDTO> {
    return this.http.put<ApiResponse<TipoDeCompraDTO>>(`${this.apiUrl}/${id}`, tipoCompra).pipe(
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

  eliminarTipoCompra(id: number): Observable<void> {
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