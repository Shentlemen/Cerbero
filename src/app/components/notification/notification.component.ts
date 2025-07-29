import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  showClose?: boolean;
}

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notification-container" [class]="'notification-' + notification.type">
      <div class="notification-icon">
        <i [class]="getIconClass()"></i>
      </div>
      <div class="notification-content">
        <div class="notification-title">{{ notification.title }}</div>
        <div class="notification-message">{{ notification.message }}</div>
      </div>
      <div class="notification-actions">
        <button 
          *ngIf="notification.showClose !== false" 
          class="notification-close" 
          (click)="close()"
          title="Cerrar notificación">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="notification-progress" *ngIf="notification.duration">
        <div class="progress-bar" [style.animation-duration]="notification.duration + 'ms'"></div>
      </div>
    </div>
  `,
  styleUrls: ['./notification.component.css']
})
export class NotificationComponent implements OnInit, OnDestroy {
  @Input() notification!: Notification;
  @Output() closeNotification = new EventEmitter<string>();

  private timeoutId?: number;

  ngOnInit() {
    if (this.notification.duration && this.notification.duration > 0) {
      this.timeoutId = window.setTimeout(() => {
        this.close();
      }, this.notification.duration);
    }
  }

  ngOnDestroy() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  close() {
    this.closeNotification.emit(this.notification.id);
  }

  getIconClass(): string {
    switch (this.notification.type) {
      case 'success':
        return 'fas fa-check-circle';
      case 'error':
        return 'fas fa-exclamation-circle';
      case 'warning':
        return 'fas fa-exclamation-triangle';
      case 'info':
        return 'fas fa-info-circle';
      default:
        return 'fas fa-bell';
    }
  }
} 