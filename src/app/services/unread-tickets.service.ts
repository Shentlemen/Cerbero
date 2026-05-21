import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, interval, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { PermissionsService } from './permissions.service';
import { TicketsService } from './tickets.service';

const LOGIN_BUBBLE_SESSION_KEY = 'cerbero_tickets_login_bubble_shown';

/**
 * Estado global de "tickets no leidos" para mi bandeja.
 *
 * Fuente de la cuenta: backend `GET /api/tickets/no-leidos` (filtrado a LABORATORIO para GM/Admin y al
 * area del rol efectivo para el resto; USER siempre devuelve 0).
 *
 * Estrategia:
 *  - Polling cada {@link POLL_INTERVAL_MS} (45 s) mientras hay sesion.
 *  - Re-dispara on demand via `refresh()` (al abrir detalle de ticket, al cerrar, al cambiar `vistaComo`).
 *  - Globo cómic al login si hay pendientes (una vez por pestaña).
 */
@Injectable({ providedIn: 'root' })
export class UnreadTicketsService implements OnDestroy {
  private static readonly POLL_INTERVAL_MS = 45_000;

  private readonly unreadSubject = new BehaviorSubject<number>(0);
  readonly unreadCount$: Observable<number> = this.unreadSubject.asObservable();

  private pollSub?: Subscription;
  private authSub?: Subscription;
  private viewAsSub?: Subscription;
  private loginRetryTimers: number[] = [];
  private loginCheckUntil = 0;
  private loginBubblePending = false;

  constructor(
    private ticketsService: TicketsService,
    private authService: AuthService,
    private permissionsService: PermissionsService
  ) {
    this.authSub = this.authService.currentUser$.subscribe((user) => {
      if (user) {
        this.startPolling();
        this.scheduleLoginCheck();
      } else {
        this.clearLoginRetries();
        this.stopPolling();
        this.loginCheckUntil = 0;
        this.loginBubblePending = false;
        this.unreadSubject.next(0);
        sessionStorage.removeItem(LOGIN_BUBBLE_SESSION_KEY);
      }
    });
    this.viewAsSub = this.permissionsService.viewAs$.subscribe(() => {
      if (this.permissionsService.getCurrentUser()) {
        this.refresh(false);
      }
    });
  }

  /**
   * Tras login o recarga con JWT: reintentos por si el menú aún no está listo.
   */
  scheduleLoginCheck(): void {
    if (!this.authService.getToken() || !this.canReceiveBandejaAlerts()) {
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

  consumeLoginBubbleRequest(): string | null {
    if (!this.loginBubblePending) {
      return null;
    }
    this.loginBubblePending = false;
    const count = this.unreadSubject.value;
    if (count <= 0) {
      return null;
    }
    sessionStorage.setItem(LOGIN_BUBBLE_SESSION_KEY, '1');
    return this.buildBubbleMessage(count);
  }

  getBubbleMessage(): string | null {
    const count = this.unreadSubject.value;
    if (count <= 0) {
      return null;
    }
    return this.buildBubbleMessage(count);
  }

  buildBubbleMessage(count: number): string {
    const area = this.getBandejaAreaLabel();
    const n = count;
    return (
      `¡Guau! Tenés ${n} ticket${n === 1 ? '' : 's'} sin leer en la bandeja de ${area}. ` +
      'Tocá mi badge rojo para ir a revisarlos.'
    );
  }

  /** Nombre legible del área de bandeja (alineado con backend TicketNotificacionService). */
  getBandejaAreaLabel(): string {
    if (this.permissionsService.isGMOrAdmin()) {
      return 'Laboratorio';
    }
    const role = this.permissionsService.getEffectiveRole();
    if (!role || role === 'USER') {
      return 'tu área';
    }
    const labels: Record<string, string> = {
      ALMACEN: 'Almacén',
      INVENTARIO: 'Inventario',
      COMPRAS: 'Compras',
      GESTION_EQUIP: 'Gestión de equipos',
      IMPRESION: 'Impresión',
      GARANTIA: 'Garantía',
      LABORATORIO: 'Laboratorio'
    };
    return labels[role] ?? role.replace(/_/g, ' ');
  }

  private canReceiveBandejaAlerts(): boolean {
    const role = this.permissionsService.getEffectiveRole();
    return !!role && role !== 'USER';
  }

  /** Refresco inmediato (no resetea el contador previo si falla). */
  refresh(showLoginBubble = false): void {
    if (!this.authService.getToken() || !this.canReceiveBandejaAlerts()) {
      if (!this.authService.getToken()) {
        this.unreadSubject.next(0);
      }
      return;
    }

    this.ticketsService
      .contarNoLeidos()
      .pipe(catchError(() => of(null)))
      .subscribe((response) => {
        if (!response) {
          return;
        }
        const next =
          response.success && response.data && typeof response.data.count === 'number'
            ? response.data.count
            : 0;
        this.unreadSubject.next(next);

        const inLoginWindow = showLoginBubble || Date.now() < this.loginCheckUntil;
        if (
          inLoginWindow &&
          next > 0 &&
          !sessionStorage.getItem(LOGIN_BUBBLE_SESSION_KEY)
        ) {
          this.loginBubblePending = true;
        }
      });
  }

  /** Snapshot sincronico (util para pruebas o lectura puntual). */
  getCurrentCount(): number {
    return this.unreadSubject.value;
  }

  private startPolling(): void {
    if (this.pollSub) {
      return;
    }
    this.pollSub = interval(UnreadTicketsService.POLL_INTERVAL_MS)
      .pipe(
        switchMap(() =>
          this.ticketsService.contarNoLeidos().pipe(catchError(() => of(null)))
        )
      )
      .subscribe((response) => {
        if (!response) {
          return;
        }
        const next =
          response.success && response.data && typeof response.data.count === 'number'
            ? response.data.count
            : 0;
        if (next !== this.unreadSubject.value) {
          this.unreadSubject.next(next);
        }
      });
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }

  ngOnDestroy(): void {
    this.clearLoginRetries();
    this.stopPolling();
    this.authSub?.unsubscribe();
    this.viewAsSub?.unsubscribe();
  }
}
