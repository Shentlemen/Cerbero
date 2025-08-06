import { HttpRequest, HttpHandlerFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, switchMap, catchError } from 'rxjs';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export function AuthInterceptor(request: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  const router = inject(Router);
  
  // Obtener token directamente de localStorage para evitar dependencia circular
  const token = localStorage.getItem('token');
  
  if (token) {
    request = request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Token expirado o inválido
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (refreshToken) {
          // Intentar renovar el token usando una nueva instancia de HttpClient
          // para evitar la dependencia circular
          const http = inject(HttpClient);
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
              // Si falla la renovación, cerrar sesión
              console.error('Error renovando token:', refreshError);
              logout();
              router.navigate(['/login']);
              return throwError(() => refreshError);
            })
          );
        } else {
          // No hay refresh token, cerrar sesión
          logout();
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
}

// Función auxiliar para logout sin dependencia circular
function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('currentUser');
} 