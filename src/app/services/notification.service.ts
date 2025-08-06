import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notification } from '../components/notification/notification.component';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications = new BehaviorSubject<Notification[]>([]);
  private nextId = 1;
  private lastNotificationId: string | null = null;

  getNotifications(): Observable<Notification[]> {
    return this.notifications.asObservable();
  }

  showSuccess(title: string, message: string, duration: number = 3333): string {
    return this.showNotification({
      type: 'success',
      title,
      message,
      duration
    });
  }

  showError(title: string, message: string, duration: number = 5333): string {
    return this.showNotification({
      type: 'error',
      title,
      message,
      duration
    });
  }

  showWarning(title: string, message: string, duration: number = 4000): string {
    return this.showNotification({
      type: 'warning',
      title,
      message,
      duration
    });
  }

  showInfo(title: string, message: string, duration: number = 3333): string {
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

    // Cerrar la notificación anterior si existe
    if (this.lastNotificationId) {
      this.removeNotification(this.lastNotificationId);
    }

    const currentNotifications = this.notifications.value;
    this.notifications.next([...currentNotifications, fullNotification]);

    // Guardar la referencia de la nueva notificación
    this.lastNotificationId = id;

    return id;
  }

  removeNotification(id: string): void {
    const currentNotifications = this.notifications.value;
    const updatedNotifications = currentNotifications.filter(n => n.id !== id);
    this.notifications.next(updatedNotifications);
    
    // Limpiar la referencia si es la notificación actual
    if (this.lastNotificationId === id) {
      this.lastNotificationId = null;
    }
  }

  clearAll(): void {
    this.notifications.next([]);
    this.lastNotificationId = null;
  }

  // Método para mostrar notificación sin cerrar la anterior (útil para errores críticos)
  showNotificationWithoutReplacing(notification: Omit<Notification, 'id'>): string {
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

  // Métodos específicos para errores comunes
  showConflictError(message: string = 'La alerta ya fue confirmada por otro usuario'): string {
    return this.showError(
      'Conflicto de Concurrencia',
      message,
      4000
    );
  }

  showNotFoundError(message: string = 'La alerta ya no existe o ya fue confirmada'): string {
    return this.showError(
      'Alerta No Encontrada',
      message,
      4000
    );
  }

  showServerError(message: string = 'Error interno del servidor'): string {
    return this.showError(
      'Error del Servidor',
      message,
      5333
    );
  }

  showValidationError(message: string = 'Solicitud inválida'): string {
    return this.showError(
      'Error de Validación',
      message,
      4000
    );
  }

  showOperationInProgress(message: string = 'Ya hay una operación en ejecución. Por favor, espera a que termine.'): string {
    return this.showWarning(
      'Operación en Progreso',
      message,
      3333
    );
  }

  showSuccessMessage(message: string = 'Operación completada exitosamente'): string {
    return this.showSuccess(
      '¡Éxito!',
      message,
      2667
    );
  }
} 