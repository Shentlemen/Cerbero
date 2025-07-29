import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { NotificationComponent, Notification } from '../notification/notification.component';

@Component({
  selector: 'app-notification-container',
  standalone: true,
  imports: [CommonModule, NotificationComponent],
  template: `
    <div class="notification-wrapper">
      <div 
        *ngFor="let notification of notifications" 
        class="notification-item"
        [class.removing]="removingNotifications.has(notification.id)">
        <app-notification 
          [notification]="notification"
          (closeNotification)="removeNotification($event)">
        </app-notification>
      </div>
    </div>
  `,
  styleUrls: ['./notification-container.component.css']
})
export class NotificationContainerComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  removingNotifications = new Set<string>();
  private subscription?: Subscription;

  constructor(private notificationService: NotificationService) {}

  ngOnInit() {
    this.subscription = this.notificationService.getNotifications().subscribe(
      notifications => {
        this.notifications = notifications;
      }
    );
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  removeNotification(id: string) {
    this.removingNotifications.add(id);
    
    // Esperar a que termine la animación antes de remover
    setTimeout(() => {
      this.notificationService.removeNotification(id);
      this.removingNotifications.delete(id);
    }, 300);
  }
} 