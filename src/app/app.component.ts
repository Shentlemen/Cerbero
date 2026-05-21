import { Component, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, Subscription } from 'rxjs';
import { MaintenanceOverlayComponent } from './components/maintenance-overlay/maintenance-overlay.component';
import { ModalBackdropFixService } from './services/modal-backdrop-fix.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MaintenanceOverlayComponent],
  template: `
    <div class="app-container">
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
    <app-maintenance-overlay></app-maintenance-overlay>
  `,
  styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
  `]
})
export class AppComponent implements OnDestroy {
  private routerSub: Subscription;

  constructor(
    private modalBackdropFixService: ModalBackdropFixService,
    private router: Router
  ) {
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        const path = this.router.url.split('?')[0];
        if (path.includes('secret-game')) {
          document.body.classList.add('no-global-zoom');
        } else {
          document.body.classList.remove('no-global-zoom');
        }
      });
    this.applyZoomClassFromUrl(this.router.url);
  }

  ngOnDestroy(): void {
    this.routerSub.unsubscribe();
    document.body.classList.remove('no-global-zoom');
  }

  private applyZoomClassFromUrl(url: string): void {
    const path = url.split('?')[0];
    if (path.includes('secret-game')) {
      document.body.classList.add('no-global-zoom');
    } else {
      document.body.classList.remove('no-global-zoom');
    }
  }
}
