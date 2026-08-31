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

@Injectable({ providedIn: 'root' })
export class GuidedTourHostService {
  constructor(@Inject(DOCUMENT) private document: Document) {}

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
    const inst = driver({
      allowClose: true,
      /** Solo cerramos con la X del popover (no clic en el oscuro ni Escape). */
      overlayClickBehavior: () => undefined,
      allowKeyboardControl: false,
      showProgress: true,
      animate: false,
      smoothScroll: false,
      stagePadding: 10,
      overlayOpacity: 0.6,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      onDestroyed: () => {
        onDestroyedExtra?.();
      },
      steps
    });
    requestAnimationFrame(() => {
      inst.drive();
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
