import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject, Subscription, filter } from 'rxjs';
import { AuthService } from './auth.service';

/** Tiempo total sin actividad antes de cerrar sesión (1 hora). */
export const SESSION_IDLE_MS = 60 * 60 * 1000;
/** Aviso en los últimos N ms de inactividad (5 min antes del cierre). */
export const SESSION_IDLE_WARNING_BEFORE_MS = 5 * 60 * 1000;
const WARNING_AT_MS = SESSION_IDLE_MS - SESSION_IDLE_WARNING_BEFORE_MS;

const ACTIVITY_THROTTLE_MS = 1000;

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'click',
  'scroll',
  'touchstart',
  'wheel'
] as const;

@Injectable({ providedIn: 'root' })
export class SessionIdleService implements OnDestroy {
  private readonly warningVisibleSubject = new BehaviorSubject<boolean>(false);
  readonly warningVisible$ = this.warningVisibleSubject.asObservable();

  private readonly secondsLeftSubject = new BehaviorSubject<number>(0);
  readonly secondsLeft$ = this.secondsLeftSubject.asObservable();

  private monitoring = false;
  /** Prueba desde Configuración: no reiniciar por HTTP ni movimiento del mouse. */
  private testWarningMode = false;
  private lastActivityAt = 0;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private logoutTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private lastThrottleAt = 0;
  private boundOnActivity = () => this.onActivity();
  private authSub?: Subscription;
  private routerSub?: Subscription;
  private onPublicRoute = true;

  constructor(
    private authService: AuthService,
    private router: Router,
    private zone: NgZone
  ) {
    this.authSub = this.authService.currentUser$.subscribe((user) => {
      if (user && !this.onPublicRoute) {
        this.start();
      } else {
        this.stop();
      }
    });

    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.onPublicRoute = this.isPublicPath(e.urlAfterRedirects || e.url);
        const user = this.authService.getCurrentUser();
        if (user && !this.onPublicRoute) {
          this.start();
        } else {
          this.stop();
        }
      });

    this.onPublicRoute = this.isPublicPath(this.router.url);
    if (this.authService.getCurrentUser() && !this.onPublicRoute) {
      this.start();
    }
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.stop();
  }

  isSessionMonitored(): boolean {
    return this.monitoring;
  }

  /** El refresh automático del JWT solo si hubo actividad reciente. */
  shouldAllowTokenRefresh(): boolean {
    if (!this.monitoring) return true;
    return Date.now() - this.lastActivityAt < SESSION_IDLE_MS;
  }

  /**
   * Extiende la sesión. Durante la prueba de inactividad solo cuenta si el usuario
   * pulsó «Seguir conectado» (userInitiated); las peticiones HTTP no deben cerrar el aviso.
   */
  extendSession(userInitiated = false): void {
    if (this.testWarningMode && !userInitiated) {
      return;
    }
    this.testWarningMode = false;
    this.recordActivity();
  }

  /**
   * Prueba desde Configuración (GM): muestra el aviso con cuenta regresiva ~30 s y cierra sesión al terminar.
   * No modifica los tiempos reales de producción (1 h / 5 min de aviso).
   */
  simulateIdleWarningForTest(): void {
    if (!this.authService.getCurrentUser()) return;
    this.testWarningMode = true;
    this.ensureMonitoring();
    const testLogoutMs = 30_000;
    this.clearTimers();
    this.lastActivityAt = Date.now() + testLogoutMs - SESSION_IDLE_MS;
    this.zone.run(() => {
      this.showWarning();
      this.logoutTimer = setTimeout(() => {
        this.testWarningMode = false;
        this.zone.run(() => this.logoutDueToInactivity());
      }, testLogoutMs);
    });
  }

  /** Prueba inmediata: cierra sesión como por inactividad (sin esperar). */
  simulateIdleLogoutForTest(): void {
    if (!this.authService.getCurrentUser()) return;
    this.zone.run(() => this.logoutDueToInactivity());
  }

  private isPublicPath(url: string): boolean {
    let path = url || '';
    const hashIdx = path.indexOf('#');
    if (hashIdx >= 0) {
      path = path.substring(hashIdx + 1);
    }
    path = path.split('?')[0];
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    return (
      path === '/login' ||
      path === '/' ||
      path === '/register' ||
      path.includes('secret-game') ||
      path.includes('notification-demo')
    );
  }

  private start(): void {
    if (this.monitoring) {
      this.recordActivity();
      return;
    }
    this.ensureMonitoring();
    this.recordActivity();
  }

  private ensureMonitoring(): void {
    if (this.monitoring) return;
    this.monitoring = true;
    this.zone.runOutsideAngular(() => {
      for (const ev of ACTIVITY_EVENTS) {
        document.addEventListener(ev, this.boundOnActivity, { passive: true });
      }
    });
  }

  private stop(): void {
    this.testWarningMode = false;
    this.monitoring = false;
    for (const ev of ACTIVITY_EVENTS) {
      document.removeEventListener(ev, this.boundOnActivity);
    }
    this.clearTimers();
    this.warningVisibleSubject.next(false);
    this.secondsLeftSubject.next(0);
  }

  private onActivity(): void {
    const now = Date.now();
    if (now - this.lastThrottleAt < ACTIVITY_THROTTLE_MS) return;
    this.lastThrottleAt = now;
    this.zone.run(() => this.recordActivity());
  }

  private recordActivity(): void {
    if (!this.monitoring || this.testWarningMode) return;
    this.lastActivityAt = Date.now();
    this.warningVisibleSubject.next(false);
    this.scheduleTimers();
  }

  private scheduleTimers(): void {
    this.clearTimers();
    this.warningTimer = setTimeout(() => {
      this.zone.run(() => this.showWarning());
    }, WARNING_AT_MS);
    this.logoutTimer = setTimeout(() => {
      this.zone.run(() => this.logoutDueToInactivity());
    }, SESSION_IDLE_MS);
  }

  private showWarning(): void {
    if (!this.monitoring) return;
    this.warningVisibleSubject.next(true);
    this.updateCountdown();
    this.countdownInterval = setInterval(() => {
      this.zone.run(() => this.updateCountdown());
    }, 1000);
  }

  private updateCountdown(): void {
    const logoutAt = this.lastActivityAt + SESSION_IDLE_MS;
    const left = Math.max(0, Math.ceil((logoutAt - Date.now()) / 1000));
    this.secondsLeftSubject.next(left);
    if (left <= 0) {
      this.clearCountdownInterval();
    }
  }

  private logoutDueToInactivity(): void {
    this.stop();
    this.authService.clearSession();
    void this.router.navigate(['/login'], {
      queryParams: { sesionExpirada: 'inactividad' }
    });
  }

  private clearTimers(): void {
    if (this.warningTimer !== null) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.logoutTimer !== null) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = null;
    }
    this.clearCountdownInterval();
  }

  private clearCountdownInterval(): void {
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}
