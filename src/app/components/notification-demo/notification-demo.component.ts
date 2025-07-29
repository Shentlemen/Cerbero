import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../notification-container/notification-container.component';

@Component({
  selector: 'app-notification-demo',
  standalone: true,
  imports: [CommonModule, NotificationContainerComponent],
  template: `
    <div class="demo-container">
      <!-- Contenedor de notificaciones -->
      <app-notification-container></app-notification-container>
      
      <div class="demo-content">
        <h1>Demostración de Notificaciones</h1>
        <p>Haz clic en los botones para ver las diferentes notificaciones:</p>
        
        <div class="demo-buttons">
          <button class="btn btn-success" (click)="showSuccess()">
            <i class="fas fa-check"></i> Éxito
          </button>
          
          <button class="btn btn-danger" (click)="showError()">
            <i class="fas fa-exclamation-circle"></i> Error
          </button>
          
          <button class="btn btn-warning" (click)="showWarning()">
            <i class="fas fa-exclamation-triangle"></i> Advertencia
          </button>
          
          <button class="btn btn-info" (click)="showInfo()">
            <i class="fas fa-info-circle"></i> Información
          </button>
          
          <button class="btn btn-secondary" (click)="showConflictError()">
            <i class="fas fa-users"></i> Conflicto
          </button>
          
          <button class="btn btn-dark" (click)="showNotFoundError()">
            <i class="fas fa-search"></i> No Encontrado
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./notification-demo.component.css']
})
export class NotificationDemoComponent {
  constructor(private notificationService: NotificationService) {}

  showSuccess(): void {
    this.notificationService.showSuccessMessage('¡Operación completada exitosamente!');
  }

  showError(): void {
    this.notificationService.showError(
      'Error del Sistema',
      'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.'
    );
  }

  showWarning(): void {
    this.notificationService.showWarning(
      'Advertencia',
      'Esta acción puede tener consecuencias importantes. ¿Estás seguro?'
    );
  }

  showInfo(): void {
    this.notificationService.showInfo(
      'Información',
      'Este es un mensaje informativo para el usuario.'
    );
  }

  showConflictError(): void {
    this.notificationService.showConflictError();
  }

  showNotFoundError(): void {
    this.notificationService.showNotFoundError();
  }
} 