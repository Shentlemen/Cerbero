import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Observable, Subscription, interval, of } from 'rxjs';
import { catchError, filter } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { PermissionsService } from './permissions.service';

export interface OcsDuplicatesSummary {
  groupCount: number;
  extraRecords: number;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

import {
  COMIC_BUBBLE_FIRST_LOGIN_MS,
  COMIC_BUBBLE_MS
} from './helper-dog-bubble.constants';

const LOGIN_BUBBLE_SESSION_KEY = 'cerbero_ocs_dup_login_bubble_shown';

/** @deprecated Usar COMIC_BUBBLE_MS */
export const OCS_DUP_LOGIN_BUBBLE_MS = COMIC_BUBBLE_MS;
/** @deprecated Usar COMIC_BUBBLE_FIRST_LOGIN_MS */
export const OCS_DUP_LOGIN_BUBBLE_FIRST_MS = COMIC_BUBBLE_FIRST_LOGIN_MS;

/**
 * Aviso global para GM y ADMIN: equipos con nombre repetido en la base OCS.
 * Alimenta el badge naranja del helper-dog y un globo de texto al iniciar sesión
 * (una vez por pestaña). El gate usa el rol EFECTIVO: si un GM activa "ver como"
 * un rol sin permiso (p. ej. USER), el badge desaparece hasta que vuelva a su
 * rol; al volver, el polling se reanuda automáticamente.
 */
@Injectable({ providedIn: 'root' })
export class OcsDuplicatesAlertService implements OnDestroy {
  private static readonly POLL_INTERVAL_MS = 600_000; // 10 min

  private readonly summarySubject = new BehaviorSubject<OcsDuplicatesSummary | null>(null);
  readonly summary$: Observable<OcsDuplicatesSummary | null> = this.summarySubject.asObservable();


  private pollSub?: Subscription;
  private authSub?: Subscription;
  private routerSub?: Subscription;
  private viewAsSub?: Subscription;
  private loginRetryTimers: number[] = [];
  /** Ventana tras login: los reintentos también pueden disparar el globo inicial. */
  private loginCheckUntil = 0;
  /** Globo pendiente hasta que helper-dog lo consume (p. ej. si el resumen llega antes del menú). */
  private loginBubblePending = false;

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private authService: AuthService,
    private permissionsService: PermissionsService,
    private router: Router
  ) {
    this.authSub = this.authService.currentUser$.subscribe((user) => {
      if (user && this.isSessionGmOrAdmin()) {
        this.startPolling();
        this.scheduleLoginCheck();
      } else {
        this.clearLoginRetries();
        this.stopPolling();
        this.loginCheckUntil = 0;
        this.loginBubblePending = false;
        this.summarySubject.next(null);
        sessionStorage.removeItem(LOGIN_BUBBLE_SESSION_KEY);
      }
    });

    // Si un GM activa/desactiva "ver como otro rol", reaccionamos en vivo:
    // - simula rol sin permiso → detenemos polling y limpiamos badge
    // - vuelve a su rol → reanudamos polling y refrescamos
    this.viewAsSub = this.permissionsService.viewAs$.subscribe(() => {
      if (this.isSessionGmOrAdmin()) {
        this.startPolling();
        this.refresh(false);
      } else {
        this.clearLoginRetries();
        this.stopPolling();
        this.loginBubblePending = false;
        this.summarySubject.next(null);
      }
    });

    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const path = e.urlAfterRedirects || e.url;
        if (path.includes('/menu') && this.isSessionGmOrAdmin()) {
          this.refresh(false);
        }
      });
  }

  /**
   * GM o ADMIN según el rol EFECTIVO (respeta "ver como" del GM).
   * Así, un GM que simula USER pierde la alerta hasta que vuelva a su rol.
   */
  private isSessionGmOrAdmin(): boolean {
    return this.permissionsService.isGMOrAdmin();
  }

  /**
   * Tras login o recarga con JWT: varios intentos por si el token o el layout
   * del menú aún no están listos (el servicio antes solo se activaba al abrir Configuración).
   */
  scheduleLoginCheck(): void {
    if (!this.isSessionGmOrAdmin()) {
      return;
    }
    this.clearLoginRetries();
    this.loginCheckUntil = Date.now() + 3500;
    this.refresh(true);
    this.loginRetryTimers.push(
      window.setTimeout(() => this.refresh(false), 400),
      window.setTimeout(() => this.refresh(false), 1200),
      window.setTimeout(() => this.refresh(false), 3000)
    );
  }

  private clearLoginRetries(): void {
    for (const id of this.loginRetryTimers) {
      window.clearTimeout(id);
    }
    this.loginRetryTimers = [];
  }

  getGroupCount(): number {
    return this.summarySubject.value?.groupCount ?? 0;
  }

  hasDuplicates(): boolean {
    return this.getGroupCount() > 0;
  }

  /**
   * Texto del globo inicial al login, si quedó pendiente (una vez por pestaña hasta consumir).
   * Marca la sesión como avisada al consumir.
   */
  consumeLoginBubbleRequest(): string | null {
    if (!this.loginBubblePending) {
      return null;
    }
    this.loginBubblePending = false;
    const summary = this.summarySubject.value;
    if (!summary || summary.groupCount <= 0) {
      return null;
    }
    sessionStorage.setItem(LOGIN_BUBBLE_SESSION_KEY, '1');
    return this.buildBubbleMessage(summary);
  }

  /** Refresco inmediato; tras login puede dejar pendiente el globo cómic si hay duplicados. */
  refresh(showLoginBubble = false): void {
    if (!this.isSessionGmOrAdmin() || !this.authService.getToken()) {
      this.summarySubject.next(null);
      return;
    }

    const url = `${this.configService.getApiUrl()}/sync/duplicates/ocs/summary`;
    this.http
      .get<ApiResponse<OcsDuplicatesSummary>>(url)
      .pipe(
        catchError((err) => {
          console.warn('[OCS duplicados] No se pudo consultar resumen:', err?.status ?? err);
          return of(null);
        })
      )
      .subscribe((response) => {
        const next = this.parseSummaryResponse(response);
        if (!next) {
          return;
        }
        this.summarySubject.next(next);

        const inLoginWindow = showLoginBubble || Date.now() < this.loginCheckUntil;
        if (
          inLoginWindow &&
          next.groupCount > 0 &&
          !sessionStorage.getItem(LOGIN_BUBBLE_SESSION_KEY)
        ) {
          this.loginBubblePending = true;
        }
      });
  }

  private parseSummaryResponse(response: ApiResponse<OcsDuplicatesSummary> | null): OcsDuplicatesSummary | null {
    if (!response) {
      return null;
    }
    const raw = (response as { data?: OcsDuplicatesSummary }).data ?? (response as unknown as OcsDuplicatesSummary);
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    if (response.success === false) {
      return null;
    }
    const groupCount = Number((raw as OcsDuplicatesSummary).groupCount ?? 0);
    const extraRecords = Number((raw as OcsDuplicatesSummary).extraRecords ?? 0);
    if (!Number.isFinite(groupCount) || !Number.isFinite(extraRecords)) {
      return null;
    }
    return { groupCount, extraRecords };
  }

  /** Texto del globo cómic según el resumen actual (null si no hay duplicados). */
  getBubbleMessage(): string | null {
    const summary = this.summarySubject.value;
    if (!summary || summary.groupCount <= 0) {
      return null;
    }
    return this.buildBubbleMessage(summary);
  }

  buildBubbleMessage(summary: OcsDuplicatesSummary): string {
    const grupos = summary.groupCount;
    const extra = summary.extraRecords;
    const detalleExtra =
      extra > 0 ? ` (${extra} registro${extra === 1 ? '' : 's'} de más)` : '';
    return (
      `¡Oye! Hay ${grupos} grupo${grupos === 1 ? '' : 's'} de equipos con el mismo nombre en OCS${detalleExtra}. ` +
      'Tocá mi badge naranja para revisarlos.'
    );
  }

  private startPolling(): void {
    if (this.pollSub) {
      return;
    }
    this.pollSub = interval(OcsDuplicatesAlertService.POLL_INTERVAL_MS).subscribe(() =>
      this.refresh(false)
    );
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }

  ngOnDestroy(): void {
    this.clearLoginRetries();
    this.stopPolling();
    this.authSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.viewAsSub?.unsubscribe();
  }
}
