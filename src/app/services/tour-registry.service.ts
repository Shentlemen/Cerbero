import { Injectable, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject, Observable, Subscription, filter } from 'rxjs';
import type { Driver, DriveStep } from 'driver.js';
import { GuidedTourHostService, GuidedTourStepDef } from './guided-tour-host.service';

/**
 * Definición de un tour registrado por un componente.
 *
 * - Para tours puramente declarativos basta con `steps` (selector + textos).
 * - Si el tour necesita closures sobre el componente (callbacks `onNextClick`,
 *   acceso a estado, navegación condicional, etc.) usar `buildSteps` que tiene
 *   precedencia sobre `steps`.
 */
export interface TourDefinition {
  /** Id único dentro de la sección. */
  id: string;
  /** Texto que se muestra al pasar el mouse / dentro del botón radial. */
  title: string;
  /** Descripción opcional (no se muestra todavía, queda disponible). */
  description?: string;
  /** Clase FontAwesome del ícono (ej. 'fa-route'). Default: 'fa-route'. */
  icon?: string;
  steps?: GuidedTourStepDef[];
  buildSteps?: () => DriveStep[];
  /** Hook que corre antes de iniciar el tour (ej. resetear scroll). */
  beforeStart?: () => void;
  /** Hook que corre cuando el tour termina/cierra (limpieza visual). */
  afterEnd?: () => void;
  /**
   * Toma control total del ciclo del tour (creación, drive, destrucción).
   * Útil para tours que necesitan configuración custom de `driver.js`
   * (overlayClickBehavior, onDestroyed, etc.). Si está definido, tiene
   * precedencia sobre `steps`/`buildSteps` y los hooks de arriba.
   */
  run?: () => void;
}

interface Registration {
  section: string;
  tours: TourDefinition[];
}

/**
 * Registro central de tours guiados por sección.
 *
 * Flujo:
 * 1. Cada componente, al inicializarse, llama `register(section, tours)` y
 *    guarda el cleanup devuelto para llamarlo en `ngOnDestroy`.
 * 2. Cuando la ruta cambia, el servicio recalcula `currentTours$` matcheando
 *    el segmento (o los dos últimos) de la URL contra las secciones registradas.
 * 3. El `HelperDogComponent` consume `getCurrentTours()` para mostrar el menú
 *    radial y dispara `runTour(id)` cuando el usuario elige uno.
 */
@Injectable({ providedIn: 'root' })
export class TourRegistryService implements OnDestroy {
  private registrations = new Map<string, Registration>();
  private currentSection$ = new BehaviorSubject<string>('');
  private currentTours$ = new BehaviorSubject<TourDefinition[]>([]);
  private activeDriver?: Driver;
  private routerSub: Subscription;

  constructor(
    private router: Router,
    private host: GuidedTourHostService
  ) {
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.recompute());
    this.recompute();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.activeDriver?.destroy();
  }

  /**
   * Registra los tours de una sección. Devuelve una función de limpieza
   * que debe llamarse en `ngOnDestroy` del componente.
   *
   * `section` debe coincidir con el último segmento de la URL (ej. `'assets'`,
   * `'compras'`) o los dos últimos (ej. `'procurement/compras'`).
   */
  register(section: string, tours: TourDefinition[]): () => void {
    const key = this.normalize(section);
    this.registrations.set(key, { section: key, tours });
    this.recompute();
    return () => this.unregister(section);
  }

  unregister(section: string): void {
    this.registrations.delete(this.normalize(section));
    this.recompute();
  }

  getCurrentSection(): Observable<string> {
    return this.currentSection$.asObservable();
  }

  getCurrentTours(): Observable<TourDefinition[]> {
    return this.currentTours$.asObservable();
  }

  /** Cierra cualquier tour vivo y arranca el indicado por id, si existe en la sección actual. */
  runTour(tourId: string): void {
    const tour = this.currentTours$.getValue().find(t => t.id === tourId);
    if (!tour) {
      return;
    }

    this.activeDriver?.destroy();
    this.activeDriver = undefined;

    if (tour.run) {
      tour.run();
      return;
    }

    let steps: DriveStep[] = [];
    if (tour.buildSteps) {
      steps = tour.buildSteps();
    } else if (tour.steps) {
      steps = this.host.buildSteps(tour.steps);
    }
    if (steps.length === 0) {
      return;
    }

    tour.beforeStart?.();

    const inst = this.host.startTour(steps, () => {
      this.activeDriver = undefined;
      tour.afterEnd?.();
    });
    if (inst) {
      this.activeDriver = inst;
    }
  }

  private recompute(): void {
    const section = this.matchSectionFromUrl(this.router.url);
    this.currentSection$.next(section);
    const matched = section ? this.registrations.get(section)?.tours : undefined;
    if (matched && matched.length > 0) {
      this.currentTours$.next(matched);
      return;
    }
    // Fallback: si no hay match por URL, exponer todos los tours actualmente
    // registrados. En Angular típicamente sólo un componente con tour está
    // montado a la vez, así que esto evita perder el tour ante rutas con
    // parámetros dinámicos (ej. `/menu/asset-details/:id`).
    const all: TourDefinition[] = [];
    this.registrations.forEach(reg => all.push(...reg.tours));
    this.currentTours$.next(all);
  }

  /** Devuelve la clave registrada que matchea la URL actual, o '' si ninguna. */
  private matchSectionFromUrl(url: string): string {
    const segments = url
      .split('?')[0]
      .split('#')[0]
      .split('/')
      .filter(Boolean);
    if (segments.length === 0) {
      return '';
    }
    // Probar primero los dos últimos segmentos (ej. 'procurement/compras').
    if (segments.length >= 2) {
      const last2 = `${segments[segments.length - 2]}/${segments[segments.length - 1]}`;
      if (this.registrations.has(last2)) {
        return last2;
      }
    }
    const last = segments[segments.length - 1];
    if (this.registrations.has(last)) {
      return last;
    }
    // Si el último segmento parece un id dinámico (numérico o uuid), probar el penúltimo.
    if (this.looksLikeDynamicSegment(last) && segments.length >= 2) {
      const prev = segments[segments.length - 2];
      if (this.registrations.has(prev)) {
        return prev;
      }
    }
    return '';
  }

  private looksLikeDynamicSegment(segment: string): boolean {
    return /^[0-9]+$/.test(segment) || /^[0-9a-f-]{8,}$/i.test(segment);
  }

  private normalize(section: string): string {
    return section.replace(/^\/+|\/+$/g, '').toLowerCase();
  }
}
