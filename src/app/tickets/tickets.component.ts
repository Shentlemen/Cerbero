import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { NotificationService } from '../services/notification.service';
import { PermissionsService } from '../services/permissions.service';
import { Ticket, TicketEstado, TicketsService } from '../services/tickets.service';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NotificationContainerComponent],
  templateUrl: './tickets.component.html',
  styleUrls: ['./tickets.component.css']
})
export class TicketsComponent implements OnInit {
  tickets: Ticket[] = [];
  loading = false;
  estadoFiltro: '' | TicketEstado = '';

  readonly estados: TicketEstado[] = [
    'NUEVO',
    'EN_REVISION',
    'EN_GESTION',
    'DERIVADO',
    'RESUELTO',
    'CERRADO',
    'REABIERTO'
  ];

  constructor(
    private ticketsService: TicketsService,
    private notificationService: NotificationService,
    private permissionsService: PermissionsService
  ) {}

  ngOnInit(): void {
    this.cargarTickets();
  }

  cargarTickets(): void {
    this.loading = true;
    const estado = this.estadoFiltro || undefined;
    this.ticketsService.listar(estado).subscribe({
      next: (response) => {
        if (response.success) {
          this.tickets = response.data || [];
        } else {
          this.notificationService.showError('Error', response.message || 'No se pudieron cargar tickets');
        }
      },
      error: (error) => {
        this.notificationService.showError('Error', error?.error?.message || 'No se pudieron cargar tickets');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  getEstadoClass(estado: TicketEstado): string {
    const map: Record<TicketEstado, string> = {
      NUEVO: 'badge bg-secondary',
      EN_REVISION: 'badge bg-info text-dark',
      EN_GESTION: 'badge bg-primary',
      DERIVADO: 'badge bg-warning text-dark',
      RESUELTO: 'badge bg-success',
      CERRADO: 'badge bg-dark',
      REABIERTO: 'badge bg-danger'
    };
    return map[estado];
  }

  getPrioridadClass(prioridad: string): string {
    const map: Record<string, string> = {
      BAJA: 'badge bg-light text-dark border',
      MEDIA: 'badge bg-info text-dark',
      ALTA: 'badge bg-warning text-dark',
      CRITICA: 'badge bg-danger'
    };
    return map[prioridad] || 'badge bg-secondary';
  }

  canCreateTickets(): boolean {
    return this.permissionsService.canCreateTickets();
  }

  getEstadoLabel(estado: TicketEstado): string {
    return estado
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  }
}

