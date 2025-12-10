import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
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
export class AppComponent {
  constructor(private modalBackdropFixService: ModalBackdropFixService) {
    // El servicio se inicializa automáticamente al inyectarlo
    // Esto ajustará todos los backdrops de modales globalmente
  }
}
