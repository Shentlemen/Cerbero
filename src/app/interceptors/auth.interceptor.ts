import { HttpRequest, HttpHandlerFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, switchMap, catchError } from 'rxjs';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import { MaintenanceService } from '../services/maintenance.service';

export function AuthInterceptor(request: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  const router = inject(Router);
  const http = inject(HttpClient);
  const authService = inject(AuthService);
  const maintenanceService = inject(MaintenanceService);
  
  // Obtener token directamente de localStorage para evitar dependencia circular
  const token = localStorage.getItem('token');
  
  // Verificar si el token está expirado antes de enviarlo
  if (token && authService.isTokenExpired()) {
    console.log('🔄 Token expirado detectado en interceptor - limpiando sesión');
    authService.clearSession();
    router.navigate(['/login']);
    return throwError(() => new Error('Token expirado'));
  }
  
  if (token) {
    request = request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Manejar modo mantenimiento (503 Service Unavailable)
      if (error.status === 503 && error.error?.error === 'MAINTENANCE_MODE') {
        console.log('🔧 Sistema en modo mantenimiento:', error.error.reason);
        maintenanceService.setMaintenanceMode(true, error.error.reason);
        return throwError(() => error);
      }
      
      if (error.status === 401) {
        // Verificar si es un error específico de token expirado
        if (error.error && error.error.error === 'TOKEN_EXPIRED') {
          console.log('🔄 Token expirado confirmado por backend - limpiando sesión');
          authService.clearSession();
          router.navigate(['/login']);
          return throwError(() => error);
        }
        
        // Token expirado o inválido
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (refreshToken) {
          // Intentar renovar el token
          return http.post<any>(`${environment.apiUrl}/auth/refresh`, { refreshToken }).pipe(
            switchMap(response => {
              // Guardar el nuevo token
              localStorage.setItem('token', response.token);
              localStorage.setItem('refreshToken', response.refreshToken);
              
              // Crear nueva request con el token renovado
              const newRequest = request.clone({
                setHeaders: {
                  Authorization: `Bearer ${response.token}`
                }
              });
              return next(newRequest);
            }),
            catchError(refreshError => {
              // Si falla la renovación, cerrar sesión y limpiar todo
              console.error('Error renovando token:', refreshError);
              authService.clearSession();
              router.navigate(['/login']);
              return throwError(() => refreshError);
            })
          );
        } else {
          // No hay refresh token, cerrar sesión y limpiar todo
          authService.clearSession();
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
} 