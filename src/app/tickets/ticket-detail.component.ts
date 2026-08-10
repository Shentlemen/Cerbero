import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { NotificationService } from '../services/notification.service';
import { PermissionsService } from '../services/permissions.service';
import { UnreadTicketsService } from '../services/unread-tickets.service';
import { TicketAreaService } from '../services/ticket-area.service';
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
  TicketFlujoAccion,
  TicketMovimiento,
  TicketMovimientoView,
  TicketPrioridad,
  TicketsService
} from '../services/tickets.service';
import { TicketAreaDTO } from '../services/ticket-area.service';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NotificationContainerComponent],
  templateUrl: './ticket-detail.component.html',
  styleUrls: ['./ticket-detail.component.css'],
  inputs: ['embedded', 'ticketIdInput', 'areasActivasInput', 'scrollFragment']
})
export class TicketDetailComponent implements OnInit, OnDestroy, OnChanges {
  /** Vista embebida en la bandeja (split view). */
  @Input() embedded = false;
  @Input() ticketIdInput: number | null = null;
  /** Misma lista que el filtro de área de la bandeja (split view). */
  @Input() areasActivasInput: TicketAreaDTO[] | null = null;
  /** Fragmento a scrollear tras cargar (p. ej. `adjuntos`). */
  @Input() scrollFragment: string | null = null;
  @Output() ticketChanged = new EventEmitter<void>();
  @Output() accessDenied = new EventEmitter<void>();

  ticketId = 0;
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
  /** Acciones del flujo congelado (botones). */
  flujoAcciones: TicketFlujoAccion[] = [];
  flujoConFlujo = false;
  notaFlujoExtra = '';
  aplicandoFlujo = false;

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
  areasDerivacion: TicketAreaDTO[] = [];
  private areasActivasSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ticketsService: TicketsService,
    private ticketAreaService: TicketAreaService,
    private notificationService: NotificationService,
    private permissionsService: PermissionsService,
    private unreadTicketsService: UnreadTicketsService
  ) {}

  ngOnInit(): void {
    this.areasActivasSub = this.ticketAreaService.areasActivas$.subscribe((areas) => {
      this.areasDerivacion = areas;
    });
    this.ticketAreaService.refreshAreasActivas().subscribe();
    if (!this.resolverTicketId()) {
      if (!this.embedded) {
        this.notificationService.showError('Error', 'ID de ticket inválido.');
      }
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
    this.areasActivasSub?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.embedded) {
      return;
    }
    if (changes['ticketIdInput'] && !changes['ticketIdInput'].firstChange) {
      const next = this.ticketIdInput;
      if (next && next !== this.ticketId) {
        this.ticketId = next;
        this.cargarTodo();
      }
    }
    if (changes['scrollFragment'] && this.scrollFragment) {
      this.scrollAlFragmentoSiCorresponde();
    }
  }

  private resolverTicketId(): boolean {
    if (this.embedded && this.ticketIdInput) {
      this.ticketId = this.ticketIdInput;
      return true;
    }
    const fromRoute = Number(this.route.snapshot.paramMap.get('id'));
    if (fromRoute && !Number.isNaN(fromRoute)) {
      this.ticketId = fromRoute;
      return true;
    }
    return false;
  }

  areasParaDerivar(): TicketAreaDTO[] {
    const byCodigo = new Map<string, TicketAreaDTO>();
    for (const a of this.areasDerivacion) {
      if (a?.codigo) {
        byCodigo.set(a.codigo, a);
      }
    }
    for (const a of this.areasActivasInput ?? []) {
      if (a?.codigo) {
        byCodigo.set(a.codigo, a);
      }
    }
    return Array.from(byCodigo.values()).sort((a, b) =>
      (a.nombre || a.codigo).localeCompare(b.nombre || b.codigo, 'es')
    );
  }

  labelAreaDerivacion(area: TicketAreaDTO): string {
    const nombre = (area.nombre || '').trim();
    if (nombre) {
      return this.formatClaveLegible(nombre);
    }
    return this.formatClaveLegible(area.codigo);
  }

  cargarTodo(): void {
    this.ticketAreaService.refreshAreasActivas().subscribe();
    this.loading = true;
    this.flujoAcciones = [];
    this.flujoConFlujo = false;
    forkJoin({
      ticket: this.ticketsService.obtener(this.ticketId),
      historial: this.ticketsService.historial(this.ticketId),
      comentarios: this.ticketsService.comentarios(this.ticketId),
      adjuntos: this.ticketsService.listarAdjuntos(this.ticketId),
      flujo: this.ticketsService.listarAccionesFlujo(this.ticketId).pipe(
        catchError(() =>
          of({
            success: true,
            message: '',
            data: { conFlujo: false, acciones: [] }
          })
        )
      )
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
        const flujo = response.flujo?.data;
        this.flujoConFlujo = !!flujo?.conFlujo;
        this.flujoAcciones = flujo?.acciones || [];
      },
      error: (error) => {
        this.loading = false;
        // El rol simulado (o real) no tiene permisos para leer este ticket: volvemos a la bandeja.
        const status = error?.status;
        if (status === 401 || status === 403) {
          this.notificationService.showError(
            'Sin acceso',
            'El rol seleccionado no tiene permisos para ver este ticket.'
          );
          if (this.embedded) {
            this.accessDenied.emit();
          } else {
            this.router.navigate(['/menu/tickets']);
          }
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
    const fragment = this.scrollFragment || this.route.snapshot.fragment;
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
    if (this.esTicketConFlujo()) {
      this.notificationService.showError(
        'Flujo activo',
        'Este ticket sigue un flujo. Usá los botones de avance en lugar de la gestión manual.'
      );
      return;
    }

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
              this.finalizarGestionExitosa('Estado y área actualizados.', true);
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
            this.finalizarGestionExitosa('Área actualizada.', true);
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
          this.finalizarGestionExitosa('Estado actualizado.', false);
        } else {
          this.notificationService.showError('Error', response.message || 'No se pudo cambiar estado.');
        }
      },
      error: (error) => {
        this.notificationService.showError('Error', error?.error?.message || 'No se pudo cambiar estado.');
      }
    });
  }

  /**
   * Tras gestionar el ticket: en split view recargamos acá y avisamos al padre; en pantalla
   * completa volvemos a la bandeja cuando el flujo lo pedía antes.
   */
  private finalizarGestionExitosa(mensaje: string, volverABandeja: boolean): void {
    this.notaGestion = '';
    this.nuevaArea = '';
    this.notificationService.showSuccessMessage(mensaje);
    if (this.embedded) {
      this.ticketChanged.emit();
      this.cargarTodo();
      return;
    }
    if (volverABandeja) {
      this.router.navigate(['/menu/tickets']);
      return;
    }
    this.cargarTodo();
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
    // Cerrados con flujo: solo lectura (no hay gestión manual).
    // Cerrados comunes: el área/GM puede reabrir vía el panel manual.
    if (this.ticket.estado === 'CERRADO' && this.esTicketConFlujo()) {
      return false;
    }
    return this.permissionsService.canProcessTicketsForArea(this.ticket.areaActual);
  }

  /** Ticket ligado a una versión de flujo (no es tipo común). */
  esTicketConFlujo(): boolean {
    return !!(this.ticket?.flujoVersionId) || this.flujoConFlujo;
  }

  /** Gestión por botones del flujo (oculta el panel manual). */
  usaGestionPorFlujo(): boolean {
    return this.canProcessCurrentTicket() && this.esTicketConFlujo() && this.flujoAcciones.length > 0;
  }

  /** Ticket con flujo pero sin botones en este paso (p. ej. fin RESUELTO). */
  mostrarFlujoSinAcciones(): boolean {
    return this.canProcessCurrentTicket() && this.esTicketConFlujo() && this.flujoAcciones.length === 0;
  }

  /** Solo tickets comunes: estado/derivar a mano. */
  mostrarGestionManual(): boolean {
    return this.canProcessCurrentTicket() && !this.esTicketConFlujo();
  }

  aplicarAccionFlujo(accion: TicketFlujoAccion): void {
    if (!this.ticket || this.aplicandoFlujo) {
      return;
    }
    this.aplicandoFlujo = true;
    this.ticketsService
      .aplicarAccionFlujo(this.ticket.id, accion.edgeId, this.notaFlujoExtra.trim() || undefined)
      .subscribe({
        next: (response) => {
          this.aplicandoFlujo = false;
          if (response.success) {
            this.notificationService.showSuccessMessage(`Acción aplicada: ${accion.label}`);
            this.notaFlujoExtra = '';
            this.cargarTodo();
            this.ticketChanged.emit();
          } else {
            this.notificationService.showError('Error', response.message || 'No se pudo aplicar la acción.');
          }
        },
        error: (error) => {
          this.aplicandoFlujo = false;
          this.notificationService.showError(
            'Error',
            error?.error?.message || 'No se pudo aplicar la acción de flujo.'
          );
        }
      });
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
    if (this.permissionsService.hasUserTicketBandeja()) {
      return this.permissionsService.canProcessTicketsForArea(this.ticket.areaActual);
    }
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
    if (tipo === 'FLUJO_ACCION') {
      return 'Acción de flujo';
    }
    return this.formatClaveLegible(tipo);
  }

  getMovimientoTimelineIcon(tipo?: string | null): string {
    const t = (tipo || '').toUpperCase();
    if (t === 'CREACION') {
      return 'fa-plus-circle';
    }
    if (t.includes('ESTADO') && t.includes('AREA')) {
      return 'fa-exchange-alt';
    }
    if (t.includes('ESTADO')) {
      return 'fa-flag';
    }
    if (t.includes('FLUJO')) {
      return 'fa-project-diagram';
    }
    if (t.includes('AREA') || t.includes('DERIV')) {
      return 'fa-sitemap';
    }
    return 'fa-history';
  }

  getMovimientoTimelineKind(tipo?: string | null): string {
    const t = (tipo || '').toUpperCase();
    if (t === 'CREACION') {
      return 'ticket-timeline-entry--create';
    }
    if (t.includes('ESTADO') && t.includes('AREA')) {
      return 'ticket-timeline-entry--both';
    }
    if (t.includes('ESTADO')) {
      return 'ticket-timeline-entry--state';
    }
    if (t.includes('AREA') || t.includes('DERIV')) {
      return 'ticket-timeline-entry--area';
    }
    return 'ticket-timeline-entry--default';
  }

  getEstadoPillClass(estado?: string | null): string {
    if (!estado) {
      return 'ticket-pill ticket-pill--muted';
    }
    return `ticket-pill ticket-pill--estado ${this.getHeroEstadoClass(estado as TicketEstado)}`;
  }

  getAreaPillClass(area?: string | null): string {
    if (!area) {
      return 'ticket-pill ticket-pill--muted';
    }
    return `ticket-pill ticket-pill--area ${this.getHeroAreaClass(area)}`;
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

