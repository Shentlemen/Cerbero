import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notification } from '../components/notification/notification.component';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications = new BehaviorSubject<Notification[]>([]);
  private nextId = 1;

  getNotifications(): Observable<Notification[]> {
    return this.notifications.asObservable();
  }

  showSuccess(title: string, message: string, duration: number = 5000): string {
    return this.showNotification({
      type: 'success',
      title,
      message,
      duration
    });
  }

  showError(title: string, message: string, duration: number = 8000): string {
    return this.showNotification({
      type: 'error',
      title,
      message,
      duration
    });
  }

  showWarning(title: string, message: string, duration: number = 6000): string {
    return this.showNotification({
      type: 'warning',
      title,
      message,
      duration
    });
  }

  showInfo(title: string, message: string, duration: number = 5000): string {
    return this.showNotification({
      type: 'info',
      title,
      message,
      duration
    });
  }

  private showNotification(notification: Omit<Notification, 'id'>): string {
    const id = `notification-${this.nextId++}`;
    const fullNotification: Notification = {
      ...notification,
      id,
      showClose: notification.showClose !== false
    };

    const currentNotifications = this.notifications.value;
    this.notifications.next([...currentNotifications, fullNotification]);

    return id;
  }

  removeNotification(id: string): void {
    const currentNotifications = this.notifications.value;
    const updatedNotifications = currentNotifications.filter(n => n.id !== id);
    this.notifications.next(updatedNotifications);
  }

  clearAll(): void {
    this.notifications.next([]);
  }

  // Métodos específicos para errores comunes
  showConflictError(message: string = 'La alerta ya fue confirmada por otro usuario'): string {
    return this.showError(
      'Conflicto de Concurrencia',
      message,
      6000
    );
  }

  showNotFoundError(message: string = 'La alerta ya no existe o ya fue confirmada'): string {
    return this.showError(
      'Alerta No Encontrada',
      message,
      6000
    );
  }

  showServerError(message: string = 'Error interno del servidor'): string {
    return this.showError(
      'Error del Servidor',
      message,
      8000
    );
  }

  showValidationError(message: string = 'Solicitud inválida'): string {
    return this.showError(
      'Error de Validación',
      message,
      6000
    );
  }

  showOperationInProgress(message: string = 'Ya hay una operación en ejecución. Por favor, espera a que termine.'): string {
    return this.showWarning(
      'Operación en Progreso',
      message,
      5000
    );
  }

  showSuccessMessage(message: string = 'Operación completada exitosamente'): string {
    return this.showSuccess(
      '¡Éxito!',
      message,
      4000
    );
  }
} 