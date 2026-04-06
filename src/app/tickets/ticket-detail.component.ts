import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { NotificationService } from '../services/notification.service';
import { PermissionsService } from '../services/permissions.service';
import {
  Ticket,
  TicketComentario,
  TicketComentarioView,
  TicketEstado,
  TicketMovimiento,
  TicketMovimientoView,
  TicketsService
} from '../services/tickets.service';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NotificationContainerComponent],
  templateUrl: './ticket-detail.component.html',
  styleUrls: ['./ticket-detail.component.css']
})
export class TicketDetailComponent implements OnInit {
  ticketId!: number;
  ticket: Ticket | null = null;
  movimientos: TicketMovimiento[] = [];
  comentarios: TicketComentario[] = [];
  loading = false;

  nuevoEstado: TicketEstado | '' = '';
  nuevaArea = '';
  notaEstado = '';
  notaArea = '';
  comentario = '';

  readonly estados: TicketEstado[] = [
    'NUEVO',
    'EN_REVISION',
    'EN_GESTION',
    'DERIVADO',
    'RESUELTO',
    'CERRADO',
    'REABIERTO'
  ];
  readonly areas = ['ALMACEN', 'INVENTARIO', 'COMPRAS', 'GESTION_EQUIP', 'IMPRESION', 'GARANTIA'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ticketsService: TicketsService,
    private notificationService: NotificationService,
    private permissionsService: PermissionsService
  ) {}

  ngOnInit(): void {
    this.ticketId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.ticketId) {
      this.notificationService.showError('Error', 'ID de ticket inválido.');
      return;
    }
    this.cargarTodo();
  }

  cargarTodo(): void {
    this.loading = true;
    forkJoin({
      ticket: this.ticketsService.obtener(this.ticketId),
      historial: this.ticketsService.historial(this.ticketId),
      comentarios: this.ticketsService.comentarios(this.ticketId)
    }).subscribe({
      next: (response) => {
        this.ticket = response.ticket.data;
        const historial = (response.historial.data || []) as TicketMovimientoView[];
        const comentarios = (response.comentarios.data || []) as TicketComentarioView[];
        this.movimientos = historial.map(h => ({
          ...h.movimiento,
          usuarioNombre: h.usuarioNombre
        } as TicketMovimiento & { usuarioNombre?: string }));
        this.comentarios = comentarios.map(c => ({
          ...c.comentario,
          usuarioNombre: c.usuarioNombre
        } as TicketComentario & { usuarioNombre?: string }));
        this.nuevoEstado = this.ticket?.estado || '';
      },
      error: (error) => {
        this.notificationService.showError('Error', error?.error?.message || 'No se pudo cargar el ticket');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  cambiarEstado(): void {
    if (!this.ticket || !this.nuevoEstado) return;
    this.ticketsService.cambiarEstado(this.ticket.id, this.nuevoEstado, this.notaEstado.trim() || undefined).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.showSuccessMessage('Estado actualizado.');
          this.notaEstado = '';
          this.cargarTodo();
        } else {
          this.notificationService.showError('Error', response.message || 'No se pudo cambiar estado.');
        }
      },
      error: (error) => {
        this.notificationService.showError('Error', error?.error?.message || 'No se pudo cambiar estado.');
      }
    });
  }

  cambiarArea(): void {
    if (!this.ticket || !this.nuevaArea) return;
    this.ticketsService.cambiarArea(this.ticket.id, this.nuevaArea, this.notaArea.trim() || undefined).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.showSuccessMessage('Área actualizada. Volviendo a la bandeja...');
          this.nuevaArea = '';
          this.notaArea = '';
          this.router.navigate(['/menu/tickets']);
        } else {
          this.notificationService.showError('Error', response.message || 'No se pudo cambiar área.');
        }
      },
      error: (error) => {
        this.notificationService.showError('Error', error?.error?.message || 'No se pudo cambiar área.');
      }
    });
  }

  agregarComentario(): void {
    if (!this.ticket || !this.comentario.trim()) return;
    this.ticketsService.agregarComentario(this.ticket.id, this.comentario.trim(), false).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.showSuccessMessage('Comentario agregado.');
          this.comentario = '';
          this.cargarTodo();
        } else {
          this.notificationService.showError('Error', response.message || 'No se pudo agregar comentario.');
        }
      },
      error: (error) => {
        this.notificationService.showError('Error', error?.error?.message || 'No se pudo agregar comentario.');
      }
    });
  }

  canProcessCurrentTicket(): boolean {
    if (!this.ticket) return false;
    return this.permissionsService.canProcessTicketsForArea(this.ticket.areaActual);
  }

  /** Alineado con el backend: comentar solo creador, área actual o GM/Admin. */
  canAddCommentOnTicket(): boolean {
    if (!this.ticket) return false;
    const u = this.permissionsService.getCurrentUser();
    if (!u?.id) return false;
    if (this.permissionsService.isGMOrAdmin()) return true;
    if (this.permissionsService.isUser()) return this.ticket.creadoPorUserId === u.id;
    return u.role === this.ticket.areaActual;
  }

  getEstadoLabel(estado?: string | null): string {
    if (!estado) return '-';
    return estado
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  }

  getMovimientoUsuario(mov: TicketMovimiento): string {
    const nombre = (mov as TicketMovimiento & { usuarioNombre?: string }).usuarioNombre;
    return nombre || `Usuario ${mov.usuarioId || 'N/A'}`;
  }

  getComentarioUsuario(c: TicketComentario): string {
    const nombre = (c as TicketComentario & { usuarioNombre?: string }).usuarioNombre;
    return nombre || `Usuario ${c.usuarioId}`;
  }
}

