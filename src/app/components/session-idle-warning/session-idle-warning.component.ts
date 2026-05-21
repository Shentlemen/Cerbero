import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionIdleService } from '../../services/session-idle.service';

@Component({
  selector: 'app-session-idle-warning',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-idle-warning.component.html',
  styleUrls: ['./session-idle-warning.component.css']
})
export class SessionIdleWarningComponent {
  private readonly sessionIdle = inject(SessionIdleService);
  readonly warningVisible$ = this.sessionIdle.warningVisible$;
  readonly secondsLeft$ = this.sessionIdle.secondsLeft$;

  stayConnected(): void {
    this.sessionIdle.extendSession(true);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) {
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
    return `${s}s`;
  }
}
