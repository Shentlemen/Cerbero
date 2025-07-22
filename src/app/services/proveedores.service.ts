import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { map, catchError, tap } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';

export interface ProveedorDTO {
    idProveedores: number;     // ID único del proveedor
    nombre: string;            // Nombre del proveedor
    correoContacto: string;    // Correo electrónico de contacto
    telefonoContacto: string;  // Teléfono de contacto
    nombreComercial: string;   // Nombre comercial del proveedor
}

@Injectable({
  providedIn: 'root'
})
export class ProveedoresService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/proveedores`;
  }

  private handleError(error: HttpErrorResponse) {
    // Si el error tiene una respuesta del servidor con el formato ApiResponse
    if (error.error && typeof error.error === 'object' && 'success' in error.error) {
      return throwError(() => new Error(error.error.message));
    }
    
    // Para otros tipos de errores
    let errorMessage = 'Ha ocurrido un error en la operación';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      switch (error.status) {
        case 404:
          errorMessage = 'El proveedor no fue encontrado';
          break;
        case 400:
          errorMessage = error.error?.message || 'Datos inválidos para el proveedor';
          break;
        case 500:
          errorMessage = 'Error interno del servidor';
          break;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  getProveedores(): Observable<ProveedorDTO[]> {
    return this.http.get<ApiResponse<ProveedorDTO[]>>(this.apiUrl).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error(response.message);
      }),
      catchError(this.handleError)
    );
  }

  getProveedor(id: number): Observable<ProveedorDTO> {
    return this.http.get<ApiResponse<ProveedorDTO>>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error(response.message);
      }),
      catchError(this.handleError)
    );
  }

  crearProveedor(proveedor: Omit<ProveedorDTO, 'idProveedores'>): Observable<ProveedorDTO> {
    return this.http.post<ApiResponse<ProveedorDTO>>(this.apiUrl, proveedor, { 
      observe: 'response',
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      map(response => {
        if (response.status === 201 || response.status === 200) {
          const apiResponse = response.body;
          if (apiResponse && apiResponse.success) {
            return apiResponse.data;
          }
          throw new Error(apiResponse?.message || 'Error al crear el proveedor');
        }
        throw new Error(response.body?.message || 'Error al crear el proveedor');
      }),
      catchError(error => {
        if (error.error && typeof error.error === 'object') {
          return throwError(() => new Error(error.error.message || 'Error al crear el proveedor'));
        }
        return throwError(() => new Error('Error al crear el proveedor'));
      })
    );
  }

  actualizarProveedor(id: number, proveedor: ProveedorDTO): Observable<ProveedorDTO> {
    return this.http.put<ApiResponse<ProveedorDTO>>(`${this.apiUrl}/${id}`, proveedor, { 
      observe: 'response',
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      map(response => {
        if (response.status === 200) {
          const apiResponse = response.body;
          if (apiResponse && apiResponse.success) {
            return apiResponse.data;
          }
          throw new Error(apiResponse?.message || 'Error al actualizar el proveedor');
        }
        throw new Error(response.body?.message || 'Error al actualizar el proveedor');
      }),
      catchError(error => {
        if (error.error && typeof error.error === 'object') {
          return throwError(() => new Error(error.error.message || 'Error al actualizar el proveedor'));
        }
        return throwError(() => new Error('Error al actualizar el proveedor'));
      })
    );
  }

  eliminarProveedor(id: number): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`, { 
      observe: 'response',
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      map(response => {
        // El backend puede devolver 200 OK o 204 No Content
        if (response.status === 200 || response.status === 204) {
          const apiResponse = response.body;
          // Si no hay body (204) o si hay éxito en la respuesta
          if (!apiResponse || (apiResponse && apiResponse.success)) {
            return;
          }
          throw new Error(apiResponse?.message || 'Error al eliminar el proveedor');
        }
        throw new Error(response.body?.message || 'Error al eliminar el proveedor');
      }),
      catchError(error => {
        if (error.error && typeof error.error === 'object') {
          return throwError(() => new Error(error.error.message || 'Error al eliminar el proveedor'));
        }
        return throwError(() => new Error('Error al eliminar el proveedor'));
      })
    );
  }
} 