import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MaintenanceOverlayComponent } from './components/maintenance-overlay/maintenance-overlay.component';
import { SessionIdleWarningComponent } from './components/session-idle-warning/session-idle-warning.component';
import { SessionIdleService } from './services/session-idle.service';
import { OcsDuplicatesAlertService } from './services/ocs-duplicates-alert.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MaintenanceOverlayComponent, SessionIdleWarningComponent],
  host: {
    '[class.theme-dark]': 'isDark()'
  },
  template: `
    <div class="app-container">
      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
    <app-maintenance-overlay></app-maintenance-overlay>
    <app-session-idle-warning></app-session-idle-warning>
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
  readonly isDark = inject(ThemeService).isDark;

  constructor(
    _sessionIdle: SessionIdleService,
    _ocsDuplicatesAlert: OcsDuplicatesAlertService,
    _theme: ThemeService
  ) {}
}
