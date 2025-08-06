import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export abstract class BaseRestService {
  protected abstract apiUrl: string;

  constructor(
    protected http: HttpClient,
    protected notificationService: NotificationService
  ) {}

  /**
   * Maneja las respuestas exitosas del API
   */
  protected handleSuccessResponse<T>(response: ApiResponse<T>): T {
    if (!response.success) {
      throw new Error(response.message || 'Error en la operación');
    }
    return response.data;
  }

  /**
   * Maneja los errores HTTP de manera consistente
   */
  protected handleError(error: HttpErrorResponse, context: string = 'Operación'): Observable<never> {
    let errorMessage = 'Ha ocurrido un error inesperado';

    if (error.error instanceof ErrorEvent) {
      // Error del cliente
      errorMessage = `Error de conexión: ${error.error.message}`;
    } else {
      // Error del servidor
      if (error.error && typeof error.error === 'object') {
        if ('message' in error.error) {
          errorMessage = error.error.message;
        } else if ('success' in error.error && !error.error.success) {
          errorMessage = error.error.message || 'Error en la operación';
        }
      } else {
        // Manejar códigos de estado HTTP específicos
        switch (error.status) {
          case 400:
            errorMessage = 'Solicitud inválida';
            break;
          case 401:
            errorMessage = 'No autorizado';
            break;
          case 403:
            errorMessage = 'Acceso denegado';
            break;
          case 404:
            errorMessage = 'Recurso no encontrado';
            break;
          case 409:
            errorMessage = 'Conflicto de datos';
            break;
          case 422:
            errorMessage = 'Datos de validación incorrectos';
            break;
          case 500:
            errorMessage = 'Error interno del servidor';
            break;
          default:
            errorMessage = `Error ${error.status}: ${error.statusText}`;
        }
      }
    }

    // Mostrar notificación de error
    this.notificationService.showError('Error', `${context}: ${errorMessage}`);
    
    return throwError(() => new Error(errorMessage));
  }

  /**
   * GET genérico con manejo de respuestas
   */
  protected get<T>(endpoint: string = ''): Observable<T> {
    const url = endpoint ? `${this.apiUrl}/${endpoint}` : this.apiUrl;
    return this.http.get<ApiResponse<T>>(url).pipe(
      map(response => this.handleSuccessResponse(response)),
      catchError(error => this.handleError(error, 'Obtener datos'))
    );
  }

  /**
   * GET para obtener lista con paginación
   */
  protected getList<T>(endpoint: string = '', params?: any): Observable<T[]> {
    const url = endpoint ? `${this.apiUrl}/${endpoint}` : this.apiUrl;
    return this.http.get<ApiResponse<T[]>>(url, { params }).pipe(
      map(response => this.handleSuccessResponse(response)),
      catchError(error => this.handleError(error, 'Obtener lista'))
    );
  }

  /**
   * GET para obtener un elemento por ID
   */
  protected getById<T>(id: number | string, endpoint: string = ''): Observable<T> {
    const url = endpoint ? `${this.apiUrl}/${endpoint}/${id}` : `${this.apiUrl}/${id}`;
    return this.http.get<ApiResponse<T>>(url).pipe(
      map(response => this.handleSuccessResponse(response)),
      catchError(error => this.handleError(error, 'Obtener elemento'))
    );
  }

  /**
   * POST genérico
   */
  protected post<T>(data: any, endpoint: string = ''): Observable<T> {
    const url = endpoint ? `${this.apiUrl}/${endpoint}` : this.apiUrl;
    return this.http.post<ApiResponse<T>>(url, data).pipe(
      map(response => this.handleSuccessResponse(response)),
      catchError(error => this.handleError(error, 'Crear elemento'))
    );
  }

  /**
   * PUT genérico
   */
  protected put<T>(id: number | string, data: any, endpoint: string = ''): Observable<T> {
    const url = endpoint ? `${this.apiUrl}/${endpoint}/${id}` : `${this.apiUrl}/${id}`;
    return this.http.put<ApiResponse<T>>(url, data).pipe(
      map(response => this.handleSuccessResponse(response)),
      catchError(error => this.handleError(error, 'Actualizar elemento'))
    );
  }

  /**
   * DELETE genérico
   */
  protected delete<T>(id: number | string, endpoint: string = ''): Observable<T> {
    const url = endpoint ? `${this.apiUrl}/${endpoint}/${id}` : `${this.apiUrl}/${id}`;
    return this.http.delete<ApiResponse<T>>(url).pipe(
      map(response => this.handleSuccessResponse(response)),
      catchError(error => this.handleError(error, 'Eliminar elemento'))
    );
  }

  /**
   * PATCH genérico para actualizaciones parciales
   */
  protected patch<T>(id: number | string, data: any, endpoint: string = ''): Observable<T> {
    const url = endpoint ? `${this.apiUrl}/${endpoint}/${id}` : `${this.apiUrl}/${id}`;
    return this.http.patch<ApiResponse<T>>(url, data).pipe(
      map(response => this.handleSuccessResponse(response)),
      catchError(error => this.handleError(error, 'Actualizar elemento'))
    );
  }

  /**
   * Método para mostrar notificaciones de éxito
   */
  protected showSuccessMessage(message: string): void {
    this.notificationService.showSuccessMessage(message);
  }

  /**
   * Método para mostrar notificaciones de error específicas
   */
  protected showErrorMessage(title: string, message: string): void {
    this.notificationService.showError(title, message);
  }
} 