import { HttpRequest, HttpHandlerFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, switchMap, catchError, EMPTY } from 'rxjs';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';
import { MaintenanceService } from '../services/maintenance.service';
import { NotificationService } from '../services/notification.service';
import { SessionIdleService } from '../services/session-idle.service';

function isPublicUrl(url: string): boolean {
  return ['/auth/login', '/auth/refresh', '/api/public'].some((u) => url.includes(u));
}

/** Subida/borrado/lectura de foto de perfil: un 401 no debe echar al login. */
function isAvatarRequest(url: string): boolean {
  return url.includes('/users/profile/avatar') || /\/users\/\d+\/avatar(?:\?|$)/.test(url);
}

/** Aviso de duplicados OCS: solo GM en backend; ADMIN no debe perder la sesión por este 401. */
function isOcsDuplicatesSummaryRequest(url: string): boolean {
  return url.includes('/sync/duplicates/ocs/summary') || url.includes('/sync/duplicates-ocs/summary');
}

/** Enriquecimiento de Terminales: un 401 no debe echar al login. */
function isActivosByNameRequest(url: string): boolean {
  return url.includes('/activos/by-name/');
}

function shouldNotKickOn401(url: string): boolean {
  return isAvatarRequest(url) || isOcsDuplicatesSummaryRequest(url) || isActivosByNameRequest(url);
}

function isMaintenanceStatusUrl(url: string): boolean {
  return url.includes('/maintenance/status');
}

function isMaintenanceHttpError(error: HttpErrorResponse): boolean {
  if (error.status !== 503) {
    return false;
  }
  const body = error.error;
  if (body && typeof body === 'object' && (body.error === 'MAINTENANCE_MODE' || body.maintenance === true)) {
    return true;
  }
  if (typeof body === 'string' && (body.includes('MAINTENANCE_MODE') || body.toLowerCase().includes('mantenimiento'))) {
    return true;
  }
  return false;
}

function maintenanceReasonFromError(error: HttpErrorResponse): string {
  const body = error.error;
  if (body && typeof body === 'object') {
    return body.reason || body.message || 'Operación en progreso';
  }
  return 'Operación en progreso';
}

function attachBearer(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}

export function AuthInterceptor(request: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  const router = inject(Router);
  const http = inject(HttpClient);
  const authService = inject(AuthService);
  const maintenanceService = inject(MaintenanceService);
  const notificationService = inject(NotificationService);

  const token = localStorage.getItem('token');
  const publicUrl = isPublicUrl(request.url);

  const kickToLogin = (): void => {
    const alreadyLoggedOut = !localStorage.getItem('token') && !localStorage.getItem('refreshToken');
    if (alreadyLoggedOut) {
      return;
    }
    authService.clearSession();
    const currentUrl = router.url;
    if (!currentUrl.includes('/login') && !currentUrl.includes('-demo')) {
      router.navigate(['/login']);
    }
  };

  const failWithoutKick = (error: unknown): Observable<HttpEvent<unknown>> => {
    return throwError(() => error);
  };

  const refreshAndRetry = (original: HttpRequest<unknown>): Observable<HttpEvent<unknown>> | null => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return null;
    }
    return http.post<{ token?: string; refreshToken?: string }>(
      `${environment.apiUrl}/auth/refresh`,
      { refreshToken }
    ).pipe(
      switchMap((response) => {
        if (!response?.token) {
          throw new Error('No se pudo renovar la sesión');
        }
        localStorage.setItem('token', response.token);
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        return next(attachBearer(original, response.token));
      }),
      catchError((refreshError) => {
        if (maintenanceService.isMaintenanceModeActive() || isMaintenanceHttpError(refreshError as HttpErrorResponse)) {
          return EMPTY;
        }
        if (shouldNotKickOn401(original.url)) {
          return failWithoutKick(refreshError);
        }
        kickToLogin();
        return throwError(() => refreshError);
      })
    );
  };

  if (token && authService.isTokenExpired() && !publicUrl) {
    if (maintenanceService.isMaintenanceModeActive()) {
      return EMPTY;
    }
    const retry = refreshAndRetry(request);
    if (retry) {
      return retry;
    }
    if (shouldNotKickOn401(request.url)) {
      return failWithoutKick(new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        url: request.url,
        error: {
          error: 'UNAUTHORIZED',
          message: 'Se requiere autenticación válida. Volvé a iniciar sesión e intentá de nuevo.'
        }
      }));
    }
    kickToLogin();
    return throwError(() => new Error('Token expirado'));
  }

  if (token) {
    request = attachBearer(request, token);
    if (!publicUrl) {
      try {
        const sessionIdle = inject(SessionIdleService);
        if (!sessionIdle.isBackgroundIdleRequest(request.url)) {
          sessionIdle.extendSession();
        }
      } catch {
        /* servicio no disponible aún */
      }
    }
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isMaintenanceHttpError(error)) {
        maintenanceService.onMaintenanceDetectedFrom503(maintenanceReasonFromError(error));
        notificationService.clearAll();
        return EMPTY;
      }

      if (maintenanceService.isMaintenanceModeActive() && !isMaintenanceStatusUrl(request.url)) {
        notificationService.clearAll();
        return EMPTY;
      }

      if (error.status === 401 && !publicUrl) {
        const retry = refreshAndRetry(request);
        if (retry) {
          return retry;
        }
        if (shouldNotKickOn401(request.url)) {
          return failWithoutKick(error);
        }
        kickToLogin();
      }
      return throwError(() => error);
    })
  );
}
