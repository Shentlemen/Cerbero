import { Injectable, OnDestroy } from '@angular/core';

/**
 * Servicio global que ajusta automáticamente el tamaño del backdrop de todos los modales
 * Funciona correctamente incluso con zoom aplicado al body
 */
@Injectable({
  providedIn: 'root'
})
export class ModalBackdropFixService implements OnDestroy {
  private observer: MutationObserver | null = null;
  private resizeListener: (() => void) | null = null;
  private fixInterval: any = null;

  constructor() {
    this.initializeGlobalBackdropFix();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Inicializa el ajuste global de backdrops
   */
  private initializeGlobalBackdropFix(): void {
    // Función para ajustar todos los backdrops
    const fixAllBackdrops = () => {
      const backdrops = document.querySelectorAll('.modal-backdrop');
      
      if (backdrops.length === 0) {
        return;
      }
      
      // Obtener las dimensiones reales de la ventana (sin afectar por zoom)
      const realWidth = Math.max(
        document.documentElement.clientWidth || 0,
        window.innerWidth || 0,
        document.body.clientWidth || 0
      );
      const realHeight = Math.max(
        document.documentElement.clientHeight || 0,
        window.innerHeight || 0,
        document.body.clientHeight || 0
      );
      
      backdrops.forEach((backdrop) => {
        const backdropElement = backdrop as HTMLElement;
        if (backdropElement) {
          backdropElement.style.setProperty('position', 'fixed', 'important');
          backdropElement.style.setProperty('top', '0', 'important');
          backdropElement.style.setProperty('left', '0', 'important');
          backdropElement.style.setProperty('right', '0', 'important');
          backdropElement.style.setProperty('bottom', '0', 'important');
          backdropElement.style.setProperty('width', `${realWidth}px`, 'important');
          backdropElement.style.setProperty('height', `${realHeight}px`, 'important');
          backdropElement.style.setProperty('margin', '0', 'important');
          backdropElement.style.setProperty('padding', '0', 'important');
          backdropElement.style.setProperty('z-index', '1040', 'important');
          backdropElement.style.setProperty('transform', 'none', 'important');
          backdropElement.style.setProperty('overflow', 'hidden', 'important');
          backdropElement.style.setProperty('max-width', 'none', 'important');
          backdropElement.style.setProperty('max-height', 'none', 'important');
          backdropElement.style.setProperty('min-width', `${realWidth}px`, 'important');
          backdropElement.style.setProperty('min-height', `${realHeight}px`, 'important');
        }
      });
    };

    // Observar cuando se agregan backdrops al DOM
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            if (element.classList && element.classList.contains('modal-backdrop')) {
              // Usar requestAnimationFrame para asegurar que se aplique después del render
              requestAnimationFrame(() => {
                fixAllBackdrops();
              });
            }
          }
        });
      });
    });

    // Observar cambios en el body
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    // Listener para cambios de tamaño de ventana
    this.resizeListener = () => {
      fixAllBackdrops();
    };
    window.addEventListener('resize', this.resizeListener);

    // También usar un intervalo como respaldo (cada 200ms mientras haya backdrops)
    // Solo se ejecuta cuando hay backdrops visibles para optimizar rendimiento
    this.fixInterval = setInterval(() => {
      const backdrops = document.querySelectorAll('.modal-backdrop');
      if (backdrops.length > 0) {
        fixAllBackdrops();
      }
    }, 200);

    // Ajustar inmediatamente si ya hay backdrops
    setTimeout(() => {
      fixAllBackdrops();
    }, 0);
  }

  /**
   * Limpia los listeners y observers
   */
  private cleanup(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
    
    if (this.fixInterval) {
      clearInterval(this.fixInterval);
      this.fixInterval = null;
    }
  }
}

