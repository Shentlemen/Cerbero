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
  TicketPrioridad,
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
  /** Vacío = no derivar; solo cambiar estado. */
  nuevaArea = '';
  /** Nota única para el panel de gestión (obligatoria si hay derivación). */
  notaGestion = '';
  comentario = '';
  /** Nota opcional al cerrar o reabrir como creador (estado RESUELTO). */
  notaCierreCreador = '';

  readonly estados: TicketEstado[] = [
    'NUEVO',
    'EN_REVISION',
    'EN_GESTION',
    'DERIVADO',
    'RESUELTO',
    'CERRADO',
    'REABIERTO'
  ];
  private readonly areasBase = ['ALMACEN', 'INVENTARIO', 'COMPRAS', 'GESTION_EQUIP', 'IMPRESION', 'GARANTIA'];

  /** Cualquier usuario puede derivar hacia Laboratorio (la atienden GM/Admin). */
  readonly areasDerivacion: string[] = [...this.areasBase, 'LABORATORIO'];

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

  /**
   * Un solo botón: solo estado | solo derivar (estado→DERIVADO en backend) | ambos en una llamada atómica.
   */
  aplicarGestionTicket(): void {
    if (!this.ticket || !this.nuevoEstado) return;

    const nota = this.notaGestion.trim();
    const derivar = !!this.nuevaArea && this.nuevaArea !== this.ticket.areaActual;
    const cambiaEstado = this.nuevoEstado !== this.ticket.estado;

    if (!derivar && !cambiaEstado) {
      this.notificationService.showError('Sin cambios', 'Elegí otro estado o un área de destino distinta a la actual.');
      return;
    }
    if (derivar && !nota) {
      this.notificationService.showError('Nota obligatoria', 'Al derivar a otra área tenés que indicar el motivo en la nota.');
      return;
    }

    if (derivar && cambiaEstado) {
      this.ticketsService
        .cambiarEstadoYArea(this.ticket.id, this.nuevoEstado, this.nuevaArea, nota || undefined)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.notificationService.showSuccessMessage('Estado y área actualizados. Volviendo a la bandeja...');
              this.notaGestion = '';
              this.nuevaArea = '';
              this.router.navigate(['/menu/tickets']);
            } else {
              this.notificationService.showError('Error', response.message || 'No se pudo aplicar los cambios.');
            }
          },
          error: (error) => {
            this.notificationService.showError('Error', error?.error?.message || 'No se pudo aplicar los cambios.');
          }
        });
      return;
    }

    if (derivar) {
      this.ticketsService.cambiarArea(this.ticket.id, this.nuevaArea, nota || undefined).subscribe({
        next: (response) => {
          if (response.success) {
            this.notificationService.showSuccessMessage('Área actualizada. Volviendo a la bandeja...');
            this.nuevaArea = '';
            this.notaGestion = '';
            this.router.navigate(['/menu/tickets']);
          } else {
            this.notificationService.showError('Error', response.message || 'No se pudo cambiar área.');
          }
        },
        error: (error) => {
          this.notificationService.showError('Error', error?.error?.message || 'No se pudo cambiar área.');
        }
      });
      return;
    }

    this.ticketsService.cambiarEstado(this.ticket.id, this.nuevoEstado, nota || undefined).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.showSuccessMessage('Estado actualizado.');
          this.notaGestion = '';
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

  /** Tras RESUELTO por el área, el creador puede cerrar o reabrir. */
  canCreatorCloseOrReopenResolvedTicket(): boolean {
    return !!this.ticket && this.esCreadorDelTicket() && this.ticket.estado === 'RESUELTO';
  }

  closeTicketAsCreator(): void {
    if (!this.ticket || !this.canCreatorCloseOrReopenResolvedTicket()) return;
    this.ticketsService.cambiarEstado(this.ticket.id, 'CERRADO', this.notaCierreCreador.trim() || undefined).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.showSuccessMessage('Ticket cerrado.');
          this.notaCierreCreador = '';
          this.cargarTodo();
        } else {
          this.notificationService.showError('Error', response.message || 'No se pudo cerrar el ticket.');
        }
      },
      error: (error) => {
        this.notificationService.showError('Error', error?.error?.message || 'No se pudo cerrar el ticket.');
      }
    });
  }

  reopenTicketAsCreator(): void {
    if (!this.ticket || !this.canCreatorCloseOrReopenResolvedTicket()) return;
    this.ticketsService.cambiarEstado(this.ticket.id, 'REABIERTO', this.notaCierreCreador.trim() || undefined).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.showSuccessMessage('Ticket reabierto.');
          this.notaCierreCreador = '';
          this.cargarTodo();
        } else {
          this.notificationService.showError('Error', response.message || 'No se pudo reabrir el ticket.');
        }
      },
      error: (error) => {
        this.notificationService.showError('Error', error?.error?.message || 'No se pudo reabrir el ticket.');
      }
    });
  }

  /** Derivar: solo personal del área actual o GM/Admin. */
  canDerivarTicket(): boolean {
    if (!this.ticket) return false;
    return this.canProcessCurrentTicket();
  }

  private esCreadorDelTicket(): boolean {
    if (!this.ticket) return false;
    const u = this.permissionsService.getCurrentUser();
    return u?.id != null && this.ticket.creadoPorUserId === u.id;
  }

  /** Alineado con el backend: creador en cualquier área (incl. Laboratorio), área actual o GM/Admin. */
  canAddCommentOnTicket(): boolean {
    if (!this.ticket) return false;
    const u = this.permissionsService.getCurrentUser();
    if (!u?.id) return false;
    if (this.permissionsService.isGMOrAdmin()) return true;
    if (this.ticket.creadoPorUserId === u.id) return true;
    if (this.ticket.areaActual === 'LABORATORIO') return false;
    if (this.permissionsService.isUser()) return false;
    // Misma lógica que canProcessTicketsForArea: rol efectivo (p. ej. GM «Ver como ALMACEN»).
    const efectivo = this.permissionsService.getEffectiveRole();
    return efectivo !== null && efectivo === this.ticket.areaActual;
  }

  getEstadoLabel(estado?: string | null): string {
    return this.formatClaveLegible(estado);
  }

  getHeroPrioridadLabel(prioridad?: TicketPrioridad | string | null): string {
    return this.formatClaveLegible(prioridad ?? undefined);
  }

  getHeroAreaLabel(area?: string | null): string {
    return this.formatClaveLegible(area ?? undefined);
  }

  getHeroEstadoClass(estado: TicketEstado): string {
    const map: Record<TicketEstado, string> = {
      NUEVO: 'td-estado--nuevo',
      EN_REVISION: 'td-estado--en-revision',
      EN_GESTION: 'td-estado--en-gestion',
      DERIVADO: 'td-estado--derivado',
      RESUELTO: 'td-estado--resuelto',
      CERRADO: 'td-estado--cerrado',
      REABIERTO: 'td-estado--reabierto'
    };
    return map[estado] ?? 'td-estado--nuevo';
  }

  getHeroPrioridadClass(prioridad: TicketPrioridad | string): string {
    const map: Record<string, string> = {
      BAJA: 'td-prioridad--baja',
      MEDIA: 'td-prioridad--media',
      ALTA: 'td-prioridad--alta',
      CRITICA: 'td-prioridad--critica'
    };
    return map[String(prioridad).toUpperCase()] || 'td-prioridad--default';
  }

  getHeroAreaClass(area: string): string {
    const key = (area || '').trim().toUpperCase();
    const map: Record<string, string> = {
      ALMACEN: 'td-area--almacen',
      INVENTARIO: 'td-area--inventario',
      COMPRAS: 'td-area--compras',
      GESTION_EQUIP: 'td-area--gestion-equip',
      IMPRESION: 'td-area--impresion',
      GARANTIA: 'td-area--garantia',
      LABORATORIO: 'td-area--laboratorio'
    };
    return map[key] || 'td-area--default';
  }

  /** CREACION, CAMBIO_ESTADO, etc. → texto sin guiones bajos. */
  getTipoEventoLabel(tipo?: string | null): string {
    if (tipo === 'CAMBIO_ESTADO_Y_AREA') {
      return 'Cambio de estado y área';
    }
    return this.formatClaveLegible(tipo);
  }

  private formatClaveLegible(valor?: string | null): string {
    if (!valor) return '-';
    return valor
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

