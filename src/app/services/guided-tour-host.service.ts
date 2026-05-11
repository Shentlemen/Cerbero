import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { driver, type Driver, type DriveStep } from 'driver.js';

export type GuidedTourSide = 'top' | 'bottom' | 'left' | 'right';

/** Definición mínima para armar pasos (se omiten selectores ausentes en el DOM). */
export interface GuidedTourStepDef {
  selector: string;
  title: string;
  description: string;
  side?: GuidedTourSide;
}

/**
 * Zoom global (`body:not(.no-global-zoom) { zoom: 0.8 }`) desajusta driver hasta refrescos manuales.
 * Suspende zoom durante el tour y restaura al destruirse (refcount por si se anidan flujos).
 */
@Injectable({ providedIn: 'root' })
export class GuidedTourHostService {
  private zoomSuspendCount = 0;

  constructor(@Inject(DOCUMENT) private document: Document) {}

  suspendGlobalZoom(): void {
    this.zoomSuspendCount += 1;
    this.document.body.classList.add('no-global-zoom');
  }

  restoreGlobalZoom(): void {
    this.zoomSuspendCount = Math.max(0, this.zoomSuspendCount - 1);
    if (this.zoomSuspendCount === 0) {
      this.document.body.classList.remove('no-global-zoom');
    }
  }

  /** Arma pasos solo para elementos que existen en el DOM. */
  buildSteps(defs: GuidedTourStepDef[]): DriveStep[] {
    const steps: DriveStep[] = [];
    for (const d of defs) {
      if (!this.document.querySelector(d.selector)) {
        continue;
      }
      steps.push({
        element: d.selector,
        popover: {
          title: d.title,
          description: d.description,
          side: d.side ?? 'bottom',
          align: 'start'
        }
      });
    }
    return steps;
  }

  startTour(steps: DriveStep[], onDestroyedExtra?: () => void): Driver | null {
    if (steps.length === 0) {
      return null;
    }
    this.suspendGlobalZoom();
    const inst = driver({
      allowClose: true,
      /** Solo cerramos con la X del popover (no clic en el oscuro ni Escape). */
      overlayClickBehavior: () => undefined,
      allowKeyboardControl: false,
      showProgress: true,
      /** Sin tween entre pasos: con zoom global que se suspende al abrir, animar suele pegar la UI. */
      animate: false,
      /** Evita animar scroll al cambiar paso: menos jank y el spotlight/popover coinciden con el DOM estable. */
      smoothScroll: false,
      stagePadding: 10,
      overlayOpacity: 0.6,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      onDestroyed: () => {
        onDestroyedExtra?.();
        this.restoreGlobalZoom();
      },
      steps
    });
    // Tras `no-global-zoom` el layout cambia de escala; medir en el mismo tick desalinea el spotlight.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        inst.drive();
      });
    });
    return inst;
  }

  /**
   * Una sola recalculación tras el siguiente frame de pintado (evita llamar refresh() docenas de veces
   * en paralelo → pegaba la UI y a veces dejaba el overlay desalineado).
   */
  refreshPopoverLayout(driverInstance: Driver | undefined): void {
    if (!driverInstance) {
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        driverInstance.refresh();
      });
    });
  }
}
