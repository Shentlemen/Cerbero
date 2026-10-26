import { Injectable } from '@angular/core';

export type ListSearchScreen = 'assets' | 'devices' | 'monitors';

const STORAGE_PREFIX = 'cerbero:list-search:';

/**
 * Recuerda el texto de búsqueda de listados al salir de la pantalla
 * (cambio de pestaña del menú o recarga). sessionStorage se limpia en logout.
 */
@Injectable({ providedIn: 'root' })
export class ListSearchStateService {
  get(screen: ListSearchScreen): string {
    try {
      return sessionStorage.getItem(STORAGE_PREFIX + screen) ?? '';
    } catch {
      return '';
    }
  }

  set(screen: ListSearchScreen, query: string): void {
    try {
      const key = STORAGE_PREFIX + screen;
      const value = query ?? '';
      if (!value) {
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
      }
    } catch {
      // sessionStorage puede no estar disponible (modo privado estricto, etc.)
    }
  }
}
