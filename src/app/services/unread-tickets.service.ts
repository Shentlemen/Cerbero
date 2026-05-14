import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, interval, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { PermissionsService } from './permissions.service';
import { TicketsService } from './tickets.service';

/**
 * Estado global de "tickets no leidos" para mi bandeja.
 *
 * Fuente de la cuenta: backend `GET /api/tickets/no-leidos` (filtrado a LABORATORIO para GM/Admin y al
 * area del rol efectivo para el resto; USER siempre devuelve 0).
 *
 * Estrategia:
 *  - Polling cada {@link POLL_INTERVAL_MS} (45 s) mientras hay sesion.
 *  - Re-dispara on demand via `refresh()` (al abrir detalle de ticket, al cerrar, al cambiar `vistaComo`).
 *  - Errores silenciosos (mantiene el ultimo valor; no muestra notifs).
 */
@Injectable({ providedIn: 'root' })
export class UnreadTicketsService implements OnDestroy {
  private static readonly POLL_INTERVAL_MS = 45_000;

  private readonly unreadSubject = new BehaviorSubject<number>(0);
  readonly unreadCount$: Observable<number> = this.unreadSubject.asObservable();

  private pollSub?: Subscription;
  private authSub?: Subscription;
  private viewAsSub?: Subscription;

  constructor(
    private ticketsService: TicketsService,
    private authService: AuthService,
    private permissionsService: PermissionsService
  ) {
    this.authSub = this.authService.currentUser$.subscribe((user) => {
      if (user) {
        this.startPolling();
        this.refresh();
      } else {
        this.stopPolling();
        this.unreadSubject.next(0);
      }
    });
    this.viewAsSub = this.permissionsService.viewAs$.subscribe(() => {
      if (this.permissionsService.getCurrentUser()) {
        this.refresh();
      }
    });
  }

  /** Refresco inmediato (no resetea el contador previo si falla). */
  refresh(): void {
    this.ticketsService
      .contarNoLeidos()
      .pipe(catchError(() => of(null)))
      .subscribe((response) => {
        if (!response) return;
        const next =
          response.success && response.data && typeof response.data.count === 'number'
            ? response.data.count
            : 0;
        if (next !== this.unreadSubject.value) {
          this.unreadSubject.next(next);
        }
      });
  }

  /** Snapshot sincronico (util para pruebas o lectura puntual). */
  getCurrentCount(): number {
    return this.unreadSubject.value;
  }

  private startPolling(): void {
    if (this.pollSub) return;
    this.pollSub = interval(UnreadTicketsService.POLL_INTERVAL_MS)
      .pipe(
        switchMap(() =>
          this.ticketsService.contarNoLeidos().pipe(catchError(() => of(null)))
        )
      )
      .subscribe((response) => {
        if (!response) return;
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
    this.stopPolling();
    this.authSub?.unsubscribe();
    this.viewAsSub?.unsubscribe();
  }
}
