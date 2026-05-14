import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { NotificationService } from '../services/notification.service';
import { PermissionsService } from '../services/permissions.service';
import { UnreadTicketsService } from '../services/unread-tickets.service';
import {
  Ticket,
  TICKET_ADJUNTOS_EXT_PERMITIDAS,
  TICKET_ADJUNTOS_MAX_BYTES,
  TICKET_ADJUNTOS_MIME_PERMITIDOS,
  TicketAdjunto,
  TicketAdjuntoView,
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
export class TicketDetailComponent implements OnInit, OnDestroy {
  ticketId!: number;
  ticket: Ticket | null = null;
  movimientos: TicketMovimiento[] = [];
  comentarios: TicketComentario[] = [];
  adjuntos: (TicketAdjunto & { usuarioNombre?: string })[] = [];
  loading = false;

  private viewAsSub?: Subscription;
  private lastViewAsRole: string | null = null;

  nuevoEstado: TicketEstado | '' = '';
  /** Vacío = no derivar; solo cambiar estado. */
  nuevaArea = '';
  /** Nota única para el panel de gestión (obligatoria si hay derivación). */
  notaGestion = '';
  comentario = '';
  /** Nota opcional al cerrar o reabrir como creador (estado RESUELTO). */
  notaCierreCreador = '';

  archivoSeleccionado: File | null = null;
  descripcionAdjunto = '';
  subiendoAdjunto = false;
  readonly adjuntoMaxBytes = TICKET_ADJUNTOS_MAX_BYTES;
  readonly adjuntoExtensionesPermitidas = TICKET_ADJUNTOS_EXT_PERMITIDAS;
  readonly adjuntoAccept = '.pdf,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/jpeg,image/png,image/gif,image/webp';

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
    private permissionsService: PermissionsService,
    private unreadTicketsService: UnreadTicketsService
  ) {}

  ngOnInit(): void {
    this.ticketId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.ticketId) {
      this.notificationService.showError('Error', 'ID de ticket inválido.');
      return;
    }
    this.lastViewAsRole = this.permissionsService.getViewAsRole();
    this.cargarTodo();
    // Recargar el detalle cuando el GM cambia "Ver como otro usuario" en el header.
    // Sin esto los botones de gestión se reevalúan pero el ticket y sus datos se quedan
    // con la respuesta del rol anterior (e incluso los permisos del backend no
    // se validan hasta la próxima acción). Si el rol simulado no puede leer este ticket,
    // el backend rechaza con 4xx y volvemos a la bandeja con un aviso.
    this.viewAsSub = this.permissionsService.viewAs$.subscribe((nextRole) => {
      if (nextRole === this.lastViewAsRole) {
        return;
      }
      this.lastViewAsRole = nextRole;
      this.cargarTodo();
    });
  }

  ngOnDestroy(): void {
    this.viewAsSub?.unsubscribe();
  }

  cargarTodo(): void {
    this.loading = true;
    forkJoin({
      ticket: this.ticketsService.obtener(this.ticketId),
      historial: this.ticketsService.historial(this.ticketId),
      comentarios: this.ticketsService.comentarios(this.ticketId),
      adjuntos: this.ticketsService.listarAdjuntos(this.ticketId)
    }).subscribe({
      next: (response) => {
        this.ticket = response.ticket.data;
        const historial = (response.historial.data || []) as TicketMovimientoView[];
        const comentarios = (response.comentarios.data || []) as TicketComentarioView[];
        const adjuntos = (response.adjuntos.data || []) as TicketAdjuntoView[];
        this.movimientos = historial.map(h => ({
          ...h.movimiento,
          usuarioNombre: h.usuarioNombre
        } as TicketMovimiento & { usuarioNombre?: string }));
        this.comentarios = comentarios.map(c => ({
          ...c.comentario,
          usuarioNombre: c.usuarioNombre
        } as TicketComentario & { usuarioNombre?: string }));
        this.adjuntos = adjuntos.map(a => ({
          ...a.adjunto,
          usuarioNombre: a.usuarioNombre
        }));
        this.nuevoEstado = this.ticket?.estado || '';
      },
      error: (error) => {
        this.loading = false;
        // El rol simulado (o real) no tiene permisos para leer este ticket: volvemos a la bandeja.
        const status = error?.status;
        if (status === 401 || status === 403) {
          this.notificationService.showError(
            'Sin acceso',
            'El rol seleccionado no tiene permisos para ver este ticket. Volviendo a la bandeja.'
          );
          this.router.navigate(['/menu/tickets']);
          return;
        }
        this.notificationService.showError('Error', error?.error?.message || 'No se pudo cargar el ticket');
      },
      complete: () => {
        this.loading = false;
        this.marcarTicketComoLeido();
        this.scrollAlFragmentoSiCorresponde();
      }
    });
  }

  /**
   * Si la URL tiene fragment `#adjuntos` (la bandeja lo pone cuando el usuario clickea el clip),
   * hacemos scroll a la sección apenas terminamos de cargar. El `setTimeout` da un tick para
   * que Angular pinte la sección antes de buscar el elemento.
   */
  private scrollAlFragmentoSiCorresponde(): void {
    const fragment = this.route.snapshot.fragment;
    if (!fragment) return;
    setTimeout(() => {
      const el = document.getElementById(fragment);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }

  /**
   * Marca este ticket como leído por el usuario actual (patrón Gmail: solo al abrir el detalle)
   * y refresca el contador global del helper dog. Silencioso: si el endpoint falla no molestamos
   * con un toast porque es secundario al render del ticket.
   */
  private marcarTicketComoLeido(): void {
    if (!this.ticketId) return;
    this.ticketsService.marcarTicketLeido(this.ticketId).subscribe({
      next: () => this.unreadTicketsService.refresh(),
      error: () => { /* silencioso */ }
    });
  }

  recargarAdjuntos(): void {
    this.ticketsService.listarAdjuntos(this.ticketId).subscribe({
      next: (response) => {
        const adjuntos = (response.data || []) as TicketAdjuntoView[];
        this.adjuntos = adjuntos.map(a => ({
          ...a.adjunto,
          usuarioNombre: a.usuarioNombre
        }));
      },
      error: (error) => {
        this.notificationService.showError(
          'Error',
          error?.error?.message || 'No se pudieron cargar los adjuntos'
        );
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

  /** Misma regla que comentar: creador, área actual o GM/Admin, y ticket no cerrado. */
  puedeSubirAdjuntos(): boolean {
    if (!this.ticket) return false;
    if (this.ticket.estado === 'CERRADO') return false;
    return this.canAddCommentOnTicket();
  }

  /** Solo el autor del adjunto o GM/Admin; nunca en ticket cerrado. */
  puedeEliminarAdjunto(adj: TicketAdjunto): boolean {
    if (!this.ticket || this.ticket.estado === 'CERRADO') return false;
    if (this.permissionsService.isGMOrAdmin()) return true;
    const u = this.permissionsService.getCurrentUser();
    return !!u?.id && adj.usuarioId === u.id;
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    if (!file) {
      this.archivoSeleccionado = null;
      return;
    }
    const error = this.validarArchivoCliente(file);
    if (error) {
      this.notificationService.showError('Archivo no permitido', error);
      this.archivoSeleccionado = null;
      input.value = '';
      return;
    }
    this.archivoSeleccionado = file;
  }

  /** Doble validación (MIME + extensión) por si el navegador no manda content-type. */
  private validarArchivoCliente(file: File): string | null {
    const mime = (file.type || '').toLowerCase();
    const nombre = file.name || '';
    const ext = nombre.includes('.') ? nombre.split('.').pop()!.toLowerCase() : '';
    const mimeOk = TICKET_ADJUNTOS_MIME_PERMITIDOS.includes(mime);
    const extOk = this.adjuntoExtensionesPermitidas.includes(ext);
    if (!mimeOk && !extOk) {
      return 'Tipo de archivo no permitido. Solo se aceptan PDF, JPG, PNG, GIF o WEBP.';
    }
    if (file.size > this.adjuntoMaxBytes) {
      const pesoMb = (file.size / (1024 * 1024)).toFixed(1);
      return `El archivo supera el límite de 10 MB (este pesa ${pesoMb} MB). Comprimilo o subilo dividido.`;
    }
    if (file.size === 0) {
      return 'El archivo seleccionado está vacío.';
    }
    return null;
  }

  subirAdjunto(): void {
    if (!this.ticket) return;
    if (!this.archivoSeleccionado) {
      this.notificationService.showError('Sin archivo', 'Seleccioná un archivo antes de adjuntar.');
      return;
    }
    const error = this.validarArchivoCliente(this.archivoSeleccionado);
    if (error) {
      this.notificationService.showError('Archivo no permitido', error);
      return;
    }
    this.subiendoAdjunto = true;
    this.ticketsService
      .subirAdjunto(this.ticket.id, this.archivoSeleccionado, this.descripcionAdjunto)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.notificationService.showSuccessMessage('Adjunto subido correctamente.');
            this.archivoSeleccionado = null;
            this.descripcionAdjunto = '';
            const input = document.getElementById('ticket-adjunto-input') as HTMLInputElement | null;
            if (input) input.value = '';
            this.recargarAdjuntos();
          } else {
            this.notificationService.showError(
              'Error',
              response.message || 'No se pudo subir el adjunto.'
            );
          }
        },
        error: (err) => {
          this.notificationService.showError(
            'Error',
            err?.error?.message || 'No se pudo subir el adjunto.'
          );
        },
        complete: () => {
          this.subiendoAdjunto = false;
        }
      });
  }

  eliminarAdjunto(adj: TicketAdjunto): void {
    if (!this.puedeEliminarAdjunto(adj)) return;
    const ok = window.confirm(`¿Eliminar el adjunto "${adj.nombreArchivoOriginal}"?`);
    if (!ok) return;
    this.ticketsService.eliminarAdjunto(adj.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.showSuccessMessage('Adjunto eliminado.');
          this.recargarAdjuntos();
        } else {
          this.notificationService.showError(
            'Error',
            response.message || 'No se pudo eliminar el adjunto.'
          );
        }
      },
      error: (err) => {
        this.notificationService.showError(
          'Error',
          err?.error?.message || 'No se pudo eliminar el adjunto.'
        );
      }
    });
  }

  esAdjuntoImagen(adj: TicketAdjunto): boolean {
    return (adj.tipoArchivo || '').toLowerCase().startsWith('image/');
  }

  esAdjuntoPdf(adj: TicketAdjunto): boolean {
    return (adj.tipoArchivo || '').toLowerCase() === 'application/pdf';
  }

  getAdjuntoBadgeLabel(adj: TicketAdjunto): string {
    if (this.esAdjuntoPdf(adj)) return 'PDF';
    if (this.esAdjuntoImagen(adj)) return 'IMG';
    return 'ARCHIVO';
  }

  getAdjuntoBadgeClass(adj: TicketAdjunto): string {
    if (this.esAdjuntoPdf(adj)) return 'attach-badge attach-badge--pdf';
    if (this.esAdjuntoImagen(adj)) return 'attach-badge attach-badge--img';
    return 'attach-badge attach-badge--default';
  }

  getAdjuntoUsuario(adj: TicketAdjunto): string {
    const nombre = (adj as TicketAdjunto & { usuarioNombre?: string }).usuarioNombre;
    return nombre || `Usuario ${adj.usuarioId}`;
  }

  getAdjuntoVerUrl(adj: TicketAdjunto): string {
    return this.ticketsService.getAdjuntoVerUrl(adj.id);
  }

  getAdjuntoDescargarUrl(adj: TicketAdjunto): string {
    return this.ticketsService.getAdjuntoDescargarUrl(adj.id);
  }

  formatearTamanoAdjunto(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const unidades = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), unidades.length - 1);
    const valor = bytes / Math.pow(k, i);
    return `${valor.toFixed(valor >= 10 || i === 0 ? 0 : 1)} ${unidades[i]}`;
  }
}

