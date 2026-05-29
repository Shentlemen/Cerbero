import { Component, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
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
  private movedToBody = false;

  constructor(
    private notificationService: NotificationService,
    private elementRef: ElementRef<HTMLElement>,
    private renderer: Renderer2
  ) {}

  ngOnInit() {
    this.renderer.appendChild(document.body, this.elementRef.nativeElement);
    this.movedToBody = true;

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
    if (this.movedToBody && this.elementRef.nativeElement.parentNode) {
      this.renderer.removeChild(
        this.elementRef.nativeElement.parentNode,
        this.elementRef.nativeElement
      );
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