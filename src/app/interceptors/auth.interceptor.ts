import { HttpRequest, HttpHandlerFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, switchMap, catchError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export function AuthInterceptor(request: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const token = authService.getToken();
  
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
        const refreshToken = authService.getRefreshToken();
        
        if (refreshToken) {
          // Intentar renovar el token
          return authService.refreshToken().pipe(
            switchMap(response => {
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
              authService.logout();
              router.navigate(['/login']);
              return throwError(() => refreshError);
            })
          );
        } else {
          // No hay refresh token, cerrar sesión
          authService.logout();
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
} 