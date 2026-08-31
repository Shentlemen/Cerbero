import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const STORAGE_KEY = 'cerbero-theme';

export type AppTheme = 'light' | 'dark';

/**
 * Modo oscuro de superficies (fondos). No altera iconos ni acentos de color.
 * Pone `theme-dark` en html, body y app-root. Los tokens `--ds-*`
 * (styles-tokens.css) y `--theme-*` (alias) pintan claro y oscuro.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal(false);
  private readonly document = inject(DOCUMENT);

  constructor() {
    this.apply(this.read(), false);
  }

  toggle(): void {
    this.apply(this.isDark() ? 'light' : 'dark');
  }

  setTheme(theme: AppTheme): void {
    this.apply(theme);
  }

  private read(): AppTheme {
    try {
      return this.document.defaultView?.localStorage.getItem(STORAGE_KEY) === 'dark'
        ? 'dark'
        : 'light';
    } catch {
      return 'light';
    }
  }

  private apply(theme: AppTheme, persist = true): void {
    const dark = theme === 'dark';
    this.isDark.set(dark);
    const root = this.document.documentElement;
    root.classList.toggle('theme-dark', dark);
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = dark ? 'dark' : 'light';
    this.document.body?.classList.toggle('theme-dark', dark);
    this.document.querySelector('app-root')?.classList.toggle('theme-dark', dark);
    if (persist) {
      try {
        this.document.defaultView?.localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* ignore quota / private mode */
      }
    }
  }
}
