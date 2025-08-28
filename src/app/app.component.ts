import { Component } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AppFooterComponent } from './components/app-footer/app-footer.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AppFooterComponent],
  template: `
    <router-outlet></router-outlet>
    <app-footer *ngIf="showFooter"></app-footer>
  `
})
export class AppComponent {
  showFooter = false;

  constructor(private router: Router) {
    // Suscribirse a cambios de ruta
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Ocultar footer en la ruta del login y en la ruta raíz
      this.showFooter = event.url !== '/login' && event.url !== '/';
    });
  }
}
