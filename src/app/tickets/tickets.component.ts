import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { NotificationService } from '../services/notification.service';
import { PermissionsService } from '../services/permissions.service';
import { Ticket, TicketEstado, TicketPrioridad, TicketsService } from '../services/tickets.service';
import { forkJoin, Subscription } from 'rxjs';
import { GuidedTourHostService, type GuidedTourStepDef } from '../services/guided-tour-host.service';
import { TourRegistryService } from '../services/tour-registry.service';
import { TicketAreaService, TicketAreaDTO } from '../services/ticket-area.service';
import { TicketTipoDTO, TicketTipoService } from '../services/ticket-tipo.service';
import type { DriveStep, Driver } from 'driver.js';
import { TicketDetailComponent } from './ticket-detail.component';

type TicketsOrdenColumna = 'titulo' | 'areaActual' | 'estado' | 'prioridad' | 'fechaActualizacion';
type TicketsVistaBandeja = 'area' | 'mios' | 'cerrados';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    NgbModalModule,
    NotificationContainerComponent,
    TicketDetailComponent
  ],
  templateUrl: './tickets.component.html',
  styleUrls: ['./tickets.component.css']
})
export class TicketsComponent implements OnInit, OnDestroy {
  /** Tickets en el área del rol (o todos para GM/Admin). */
  ticketsArea: Ticket[] = [];
  /** Tickets abiertos por el usuario (seguimiento hasta cierre). */
  ticketsMisCreados: Ticket[] = [];
  ticketsCerrados: Ticket[] = [];
  loading = false;
  loadingCerrados = false;
  estadoFiltro: '' | TicketEstado = '';

  /** Filtro de área aplicado a todas las bandejas (sobre datos ya cargados). */
  filtroArea = '';
  /** Filtro en vivo por código o título sobre las tres bandejas (datos ya cargados). */
  busquedaCodigoTitulo = '';

  /** Pestaña activa: una bandeja por vista. */
  vistaBandeja: TicketsVistaBandeja = 'area';

  /** Ticket abierto en el panel derecho (sincronizado con la ruta `/tickets/:id`). */
  selectedTicketId: number | null = null;
  detailScrollFragment: string | null = null;

  /**
   * Mapa `ticketId -> cantidad de adjuntos activos`. Si un ticket no tiene clave aqui, no tiene adjuntos.
   * Lo refrescamos junto con la lista, pero su fallo es no critico (las tablas siguen funcionando).
   */
  adjuntosCountPorTicket: Record<number, number> = {};

  /**
   * IDs de tickets activos que aun no lei (o que cambiaron desde mi ultima lectura).
   * Lo usamos para aplicar la clase visual "no leido" en las tablas tipo email.
   */
  private idsNoLeidos: Set<number> = new Set();

  ordenColumna: TicketsOrdenColumna | null = null;
  ordenAsc = true;

  /** Áreas para filtro local (incl. Laboratorio: el creador puede tener tickets derivados allí). */
  /** Áreas activas (API ticket_areas). */
  areasTicket: string[] = [];
  areasTicketActivas: TicketAreaDTO[] = [];
  private areaNombrePorCodigo = new Map<string, string>();
  private areasActivasSub?: Subscription;

  private readonly prioridadOrden: Record<string, number> = {
    BAJA: 0,
    MEDIA: 1,
    ALTA: 2,
    CRITICA: 3
  };

  /** Filtro de la bandeja activa (sin CERRADO; los cerrados van en la tabla inferior). */
  readonly estadosBandeja: TicketEstado[] = [
    'NUEVO',
    'EN_REVISION',
    'EN_GESTION',
    'DERIVADO',
    'RESUELTO',
    'REABIERTO'
  ];
  private viewAsSub?: Subscription;
  private routeParamSub?: Subscription;
  private routeFragmentSub?: Subscription;
  private lastViewAsRole: string | null = null;
  private pageTour?: Driver;
  private tourCleanup?: () => void;

  @ViewChild('ticketNuevoModal') ticketNuevoModalTpl!: TemplateRef<unknown>;

  /**
   * Diálogo de confirmación al eliminar (mismo patrón que proveedores/compras):
   * `showConfirmDialog` controla la visibilidad del overlay, `ticketToDelete` guarda el
   * ticket pendiente de borrar para poder mostrar su código en el mensaje.
   */
  showConfirmDialog = false;
  ticketToDelete: Ticket | null = null;
  eliminando = false;

  /** Modal nuevo ticket (mismo flujo que el antiguo ticket-create). */
  creandoTicket = false;
  /** Avisos de validación o error API dentro del modal (no solo toast detrás del backdrop). */
  ticketNuevoValidacion: { titulo: string; lineas: string[]; esError: boolean } | null = null;
  ticketNuevoForm = {
    titulo: '',
    descripcion: '',
    areaDestino: '',
    prioridad: 'MEDIA' as TicketPrioridad,
    nota: '',
    ticketTipoId: null as number | null
  };
  readonly prioridadesTicket: TicketPrioridad[] = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
  tiposTicket: TicketTipoDTO[] = [];

  constructor(
    private ticketsService: TicketsService,
    private notificationService: NotificationService,
    private permissionsService: PermissionsService,
    private modalService: NgbModal,
    private router: Router,
    private route: ActivatedRoute,
    private guidedTourHost: GuidedTourHostService,
    private tourRegistry: TourRegistryService,
    private ticketAreaService: TicketAreaService,
    private ticketTipoService: TicketTipoService
  ) {}

  ngOnInit(): void {
    this.syncAreasDesdeServicio(this.ticketAreaService.getAreasActivasSnapshot());
    this.areasActivasSub = this.ticketAreaService.areasActivas$.subscribe((areas) => {
      this.syncAreasDesdeServicio(areas);
    });
    this.cargarAreasTicket();
    this.cargarTiposTicket();
    this.ordenColumna = 'fechaActualizacion';
    this.ordenAsc = false;
    this.lastViewAsRole = this.permissionsService.getViewAsRole();
    this.aplicarFiltroAreaDefault(false);
    this.actualizarTodo();
    this.viewAsSub = this.permissionsService.viewAs$.subscribe((nextRole) => {
      if (nextRole === this.lastViewAsRole) {
        return;
      }
      this.lastViewAsRole = nextRole;
      // Forzamos: cambió el rol efectivo, el filtro local previo (manual o no)
      // ya no aplica al nuevo contexto. Si dejamos el filtro pegado, las listas
      // se ven vacías y el usuario interpreta que "ver como" no funciona.
      this.aplicarFiltroAreaDefault(true);
      this.actualizarTodo();
    });
    const tours = [
      {
        id: 'tickets-overview',
        title: 'Tour de tickets',
        icon: 'fa-route',
        run: () => this.runTourTickets(),
      },
      ...(this.canCreateTickets()
        ? [{
            id: 'tickets-crear',
            title: 'Cómo crear un ticket',
            icon: 'fa-plus-circle',
            description: 'Abre el modal de alta y explica cada campo.',
            run: () => this.runTourCrearTicket(),
          }]
        : []),
    ];
    this.tourCleanup = this.tourRegistry.register('tickets', tours);
    this.routeParamSub = this.route.paramMap.subscribe((params) => {
      const raw = params.get('id');
      if (!raw) {
        this.selectedTicketId = null;
        return;
      }
      const id = Number(raw);
      this.selectedTicketId = Number.isNaN(id) ? null : id;
      if (this.selectedTicketId !== null) {
        this.cargarAreasTicket();
      }
    });
    this.routeFragmentSub = this.route.fragment.subscribe((fragment) => {
      this.detailScrollFragment = fragment;
    });
  }

  ngOnDestroy(): void {
    this.viewAsSub?.unsubscribe();
    this.areasActivasSub?.unsubscribe();
    this.routeParamSub?.unsubscribe();
    this.routeFragmentSub?.unsubscribe();
    this.tourCleanup?.();
    this.tourCleanup = undefined;
    this.pageTour?.destroy();
    this.pageTour = undefined;
  }

  actualizarTodo(): void {
    this.cargarAreasTicket();
    this.cargarTickets();
    this.cargarCerrados();
  }

  private cargarAreasTicket(): void {
    this.ticketAreaService.refreshAreasActivas().subscribe();
  }

  private syncAreasDesdeServicio(areas: TicketAreaDTO[]): void {
    this.areasTicketActivas = areas;
    this.areaNombrePorCodigo.clear();
    for (const a of areas) {
      if (a.codigo) {
        this.areaNombrePorCodigo.set(a.codigo, a.nombre);
      }
    }
    this.areasTicket = areas.map((a) => a.codigo).filter((c): c is string => !!c);
  }

  /**
   * Default del filtro de área:
   * - GM/Admin (rol efectivo): pre-selecciona LABORATORIO porque son quienes atienden esa bandeja.
   * - Otros roles: sin filtro de área por defecto.
   *
   * @param forzarReset cuando es {@code true}, descarta la elección manual previa del usuario
   *   y vuelve al default. Lo usamos al cambiar "Ver como" para que el nuevo contexto
   *   muestre los tickets esperados (si dejábamos el filtro pegado, las listas quedaban vacías).
   *   En el primer render llamamos con {@code false} para respetar lo que el usuario tenía elegido.
   */
  private aplicarFiltroAreaDefault(forzarReset: boolean): void {
    if (this.permissionsService.isGMOrAdmin()) {
      if (forzarReset || !this.filtroArea || this.filtroArea === 'LABORATORIO') {
        this.filtroArea = 'LABORATORIO';
      }
      return;
    }
    if (forzarReset || this.filtroArea === 'LABORATORIO') {
      this.filtroArea = '';
    }
  }

  cargarTickets(): void {
    this.loading = true;
    const estado = this.estadoFiltro || undefined;
    forkJoin({
      area: this.ticketsService.listar(estado, 'area'),
      creados: this.ticketsService.listar(estado, 'creados')
    }).subscribe({
      next: (res) => {
        if (res.area.success) {
          this.ticketsArea = res.area.data || [];
        } else {
          this.ticketsArea = [];
          this.notificationService.showError('Error', res.area.message || 'No se pudo cargar la bandeja del área.');
        }
        if (res.creados.success) {
          this.ticketsMisCreados = res.creados.data || [];
        } else {
          this.ticketsMisCreados = [];
          this.notificationService.showError('Error', res.creados.message || 'No se pudieron cargar tus tickets.');
        }
      },
      error: (error) => {
        this.ticketsArea = [];
        this.ticketsMisCreados = [];
        this.notificationService.showError('Error', error?.error?.message || 'No se pudieron cargar tickets');
      },
      complete: () => {
        this.loading = false;
      }
    });
    this.cargarAdjuntosCount();
    this.cargarIdsNoLeidos();
  }

  cargarCerrados(): void {
    this.loadingCerrados = true;
    this.ticketsService.listarCerrados().subscribe({
      next: (response) => {
        if (response.success) {
          this.ticketsCerrados = response.data || [];
        } else {
          this.notificationService.showError('Error', response.message || 'No se pudieron cargar tickets cerrados');
        }
      },
      error: (error) => {
        this.notificationService.showError('Error', error?.error?.message || 'No se pudieron cargar tickets cerrados');
      },
      complete: () => {
        this.loadingCerrados = false;
      }
    });
  }

  /**
   * Carga el mapa `ticketId -> cantidad de adjuntos activos` que alimenta el icono de clip por fila.
   * Falla silenciosa: si el endpoint no responde, simplemente no mostramos el icono (vaciamos el cache).
   */
  private cargarAdjuntosCount(): void {
    this.ticketsService.contarAdjuntosPorTicket().subscribe({
      next: (response) => {
        if (!response?.success || !response.data) {
          this.adjuntosCountPorTicket = {};
          return;
        }
        const mapa: Record<number, number> = {};
        for (const [key, value] of Object.entries(response.data)) {
          const id = Number(key);
          const total = Number(value);
          if (!Number.isNaN(id) && total > 0) {
            mapa[id] = total;
          }
        }
        this.adjuntosCountPorTicket = mapa;
      },
      error: () => {
        this.adjuntosCountPorTicket = {};
      }
    });
  }

  /** True si el ticket tiene al menos un adjunto activo (usado por el icono fa-paperclip en la lista). */
  tieneAdjuntos(ticketId: number): boolean {
    return (this.adjuntosCountPorTicket[ticketId] || 0) > 0;
  }

  /** Cantidad de adjuntos para mostrar como badge al lado del clip. */
  cantidadAdjuntos(ticketId: number): number {
    return this.adjuntosCountPorTicket[ticketId] || 0;
  }

  /**
   * Carga el set de IDs de tickets activos que aun no lei. Fallo silencioso: si el endpoint
   * no responde, simplemente no resaltamos nada (el set queda vacio).
   */
  private cargarIdsNoLeidos(): void {
    this.ticketsService.obtenerIdsNoLeidos().subscribe({
      next: (response) => {
        if (!response?.success || !Array.isArray(response.data)) {
          this.idsNoLeidos = new Set();
          return;
        }
        this.idsNoLeidos = new Set(response.data.map((id) => Number(id)).filter((id) => !Number.isNaN(id)));
      },
      error: () => {
        this.idsNoLeidos = new Set();
      }
    });
  }

  /** True si el usuario actual no abrio este ticket o si tuvo cambios desde la ultima lectura. */
  esNoLeido(ticketId: number): boolean {
    return this.idsNoLeidos.has(ticketId);
  }

  /** Bandeja del área: filtrada y ordenada (solo vista). */
  get ticketsAreaVista(): Ticket[] {
    return this.ordenarLista(this.filtrarLista(this.ticketsArea), false);
  }

  /** Mis tickets: filtrada y ordenada (solo vista). */
  get ticketsMisCreadosVista(): Ticket[] {
    return this.ordenarLista(this.filtrarLista(this.ticketsMisCreados), false);
  }

  /** Cerrados filtrados y ordenados (solo vista). */
  get ticketsCerradosVista(): Ticket[] {
    return this.ordenarLista(this.filtrarLista(this.ticketsCerrados), true);
  }

  /** Tickets visibles según pestaña activa (filtros globales ya aplicados). */
  get ticketsVistaActiva(): Ticket[] {
    switch (this.vistaBandeja) {
      case 'mios':
        return this.ticketsMisCreadosVista;
      case 'cerrados':
        return this.ticketsCerradosVista;
      default:
        return this.ticketsAreaVista;
    }
  }

  get esVistaCerrados(): boolean {
    return this.vistaBandeja === 'cerrados';
  }

  get cargandoVistaActiva(): boolean {
    return this.esVistaCerrados ? this.loadingCerrados : this.loading;
  }

  cambiarVistaBandeja(vista: TicketsVistaBandeja): void {
    this.vistaBandeja = vista;
  }

  /** Filtros locales (área / búsqueda): la vista reactiva se actualiza sola. */
  onFiltroVistaLocalChange(): void {}

  contadorVista(vista: TicketsVistaBandeja): number {
    switch (vista) {
      case 'mios':
        return this.ticketsMisCreadosVista.length;
      case 'cerrados':
        return this.ticketsCerradosVista.length;
      default:
        return this.ticketsAreaVista.length;
    }
  }

  contadorNoLeidos(vista: 'area' | 'mios'): number {
    const lista = vista === 'area' ? this.ticketsAreaVista : this.ticketsMisCreadosVista;
    return lista.filter((t) => this.esNoLeido(t.id)).length;
  }

  toggleOrden(col: TicketsOrdenColumna): void {
    if (this.ordenColumna === col) {
      this.ordenAsc = !this.ordenAsc;
    } else {
      this.ordenColumna = col;
      this.ordenAsc = true;
    }
  }

  onSortKeyDown(event: KeyboardEvent, col: TicketsOrdenColumna): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleOrden(col);
    }
  }

  sortIconClass(col: TicketsOrdenColumna): string {
    if (this.ordenColumna !== col) {
      return 'fa-sort tickets-sort-icon tickets-sort-icon--inactive';
    }
    return this.ordenAsc ? 'fa-sort-up tickets-sort-icon' : 'fa-sort-down tickets-sort-icon';
  }

  ariaSortFor(col: TicketsOrdenColumna): 'ascending' | 'descending' | 'none' {
    if (this.ordenColumna !== col) {
      return 'none';
    }
    return this.ordenAsc ? 'ascending' : 'descending';
  }

  private filtrarLista(list: Ticket[]): Ticket[] {
    let out = list;
    const q = this.busquedaCodigoTitulo.trim();
    if (q) {
      const u = q.toUpperCase();
      out = out.filter(
        (t) =>
          (t.codigo || '').toUpperCase().includes(u) || (t.titulo || '').toUpperCase().includes(u)
      );
    }
    if (this.filtroArea) {
      out = out.filter((t) => t.areaActual === this.filtroArea);
    }
    return out;
  }

  private ordenarLista(list: Ticket[], listaCerrados: boolean): Ticket[] {
    if (!this.ordenColumna || list.length === 0) {
      return [...list];
    }
    const col = this.ordenColumna;
    const dir = this.ordenAsc ? 1 : -1;
    return [...list].sort((a, b) => {
      if (col === 'fechaActualizacion') {
        const ta = this.fechaOrdenMs(a, listaCerrados);
        const tb = this.fechaOrdenMs(b, listaCerrados);
        if (ta !== tb) {
          return ta < tb ? -dir : dir;
        }
        return a.codigo.localeCompare(b.codigo, 'es');
      }
      if (col === 'prioridad') {
        const va = this.prioridadOrden[a.prioridad] ?? 99;
        const vb = this.prioridadOrden[b.prioridad] ?? 99;
        if (va !== vb) {
          return va < vb ? -dir : dir;
        }
        return a.codigo.localeCompare(b.codigo, 'es');
      }
      const va = String(a[col]).toUpperCase();
      const vb = String(b[col]).toUpperCase();
      const c = va.localeCompare(vb, 'es');
      if (c !== 0) {
        return c * dir;
      }
      return a.codigo.localeCompare(b.codigo, 'es') * dir;
    });
  }

  /** Bandeja: `fechaActualizacion`. Cerrados: misma fecha que en pantalla (`fechaCierre` si existe). */
  private fechaOrdenMs(t: Ticket, listaCerrados: boolean): number {
    const iso = listaCerrados ? t.fechaCierre || t.fechaActualizacion : t.fechaActualizacion;
    const ms = iso ? new Date(iso).getTime() : 0;
    return Number.isNaN(ms) ? 0 : ms;
  }

  getEstadoClass(estado: TicketEstado): string {
    const map: Record<TicketEstado, string> = {
      NUEVO: 'tickets-estado-badge tickets-estado--nuevo',
      EN_REVISION: 'tickets-estado-badge tickets-estado--en-revision',
      EN_GESTION: 'tickets-estado-badge tickets-estado--en-gestion',
      DERIVADO: 'tickets-estado-badge tickets-estado--derivado',
      RESUELTO: 'tickets-estado-badge tickets-estado--resuelto',
      CERRADO: 'tickets-estado-badge tickets-estado--cerrado',
      REABIERTO: 'tickets-estado-badge tickets-estado--reabierto'
    };
    return map[estado];
  }

  getPrioridadClass(prioridad: string): string {
    const map: Record<string, string> = {
      BAJA: 'tickets-prioridad-badge tickets-prioridad--baja',
      MEDIA: 'tickets-prioridad-badge tickets-prioridad--media',
      ALTA: 'tickets-prioridad-badge tickets-prioridad--alta',
      CRITICA: 'tickets-prioridad-badge tickets-prioridad--critica'
    };
    return map[prioridad] || 'tickets-prioridad-badge tickets-prioridad--default';
  }

  getPrioridadLabel(prioridad: string): string {
    return this.formatBadgeLabel(prioridad);
  }

  /** Inicial(es) para la lista compacta del split view. */
  getPrioridadShort(prioridad: string): string {
    const map: Record<string, string> = {
      BAJA: 'B',
      MEDIA: 'M',
      ALTA: 'A',
      CRITICA: 'CR'
    };
    return map[(prioridad || '').toUpperCase()] || '?';
  }

  /** Pastilla de color por área (lista de tickets). */
  getAreaPillClass(area: string): string {
    const key = (area || '').trim().toUpperCase();
    const map: Record<string, string> = {
      ALMACEN: 'tickets-area-pill tickets-area--almacen',
      INVENTARIO: 'tickets-area-pill tickets-area--inventario',
      COMPRAS: 'tickets-area-pill tickets-area--compras',
      GESTION_EQUIP: 'tickets-area-pill tickets-area--gestion-equip',
      IMPRESION: 'tickets-area-pill tickets-area--impresion',
      GARANTIA: 'tickets-area-pill tickets-area--garantia',
      LABORATORIO: 'tickets-area-pill tickets-area--laboratorio'
    };
    return map[key] || 'tickets-area-pill tickets-area--default';
  }

  getAreaLabel(area: string): string {
    const key = (area || '').trim().toUpperCase();
    return this.areaNombrePorCodigo.get(key) || this.formatBadgeLabel(area);
  }

  canCreateTickets(): boolean {
    return this.permissionsService.canCreateTickets();
  }

  abrirModalTicketNuevo(contenido?: TemplateRef<unknown>): void {
    const tpl = contenido ?? this.ticketNuevoModalTpl;
    if (!tpl) {
      return;
    }
    if (!this.canCreateTickets()) {
      this.notificationService.showError('Sin permisos', 'No tenés permisos para crear tickets.');
      return;
    }
    this.resetTicketNuevoForm();
    this.modalService.open(tpl, {
      size: 'lg',
      backdrop: 'static',
      centered: false,
      scrollable: true,
      windowClass: 'tickets-nuevo-modal-window',
      modalDialogClass: 'tickets-nuevo-modal-dialog'
    });
  }

  private resetTicketNuevoForm(): void {
    const comun = this.tiposTicket.find((t) => t.esComun) || this.tiposTicket[0] || null;
    this.ticketNuevoForm = {
      titulo: '',
      descripcion: '',
      areaDestino: '',
      prioridad: 'MEDIA',
      nota: '',
      ticketTipoId: comun?.id ?? null
    };
    this.ticketNuevoValidacion = null;
  }

  cargarTiposTicket(): void {
    this.ticketTipoService.listarActivos().subscribe({
      next: (tipos) => {
        this.tiposTicket = tipos.filter((t) => t.esComun || t.tieneFlujoPublicado);
        if (!this.ticketNuevoForm.ticketTipoId && this.tiposTicket.length) {
          const comun = this.tiposTicket.find((t) => t.esComun) || this.tiposTicket[0];
          this.ticketNuevoForm.ticketTipoId = comun.id;
        }
      },
      error: () => {
        this.tiposTicket = [];
      }
    });
  }

  tipoTicketSeleccionado(): TicketTipoDTO | null {
    const id = this.ticketNuevoForm.ticketTipoId;
    if (id == null) {
      return null;
    }
    return this.tiposTicket.find((t) => t.id === id) || null;
  }

  esTipoComunSeleccionado(): boolean {
    const t = this.tipoTicketSeleccionado();
    return !t || t.esComun;
  }

  onTipoTicketChange(): void {
    this.limpiarFeedbackTicketNuevo();
    if (!this.esTipoComunSeleccionado()) {
      this.ticketNuevoForm.areaDestino = '';
    }
  }

  limpiarFeedbackTicketNuevo(): void {
    this.ticketNuevoValidacion = null;
  }

  /** Misma regla que `armarValidacionClienteTicketNuevo` (hover ámbar en el botón cuando falta algo). */
  esTicketNuevoFormValido(): boolean {
    const f = this.ticketNuevoForm;
    const tipoOk = f.ticketTipoId != null;
    const areaOk = !this.esTipoComunSeleccionado() || !!f.areaDestino;
    return !!(f.titulo?.trim() && f.descripcion?.trim() && tipoOk && areaOk);
  }

  private armarValidacionClienteTicketNuevo(): { titulo: string; lineas: string[] } | null {
    const f = this.ticketNuevoForm;
    const lineas: string[] = [];
    if (!f.titulo.trim()) {
      lineas.push('El título es obligatorio.');
    }
    if (!f.descripcion.trim()) {
      lineas.push('La descripción es obligatoria.');
    }
    if (f.ticketTipoId == null) {
      lineas.push('Seleccioná el tipo de ticket.');
    }
    if (this.esTipoComunSeleccionado() && !f.areaDestino) {
      lineas.push('Seleccioná el área destino.');
    }
    const tipo = this.tipoTicketSeleccionado();
    if (tipo && !tipo.esComun && !tipo.tieneFlujoPublicado) {
      lineas.push('Ese tipo aún no tiene un flujo publicado.');
    }
    if (lineas.length === 0) {
      return null;
    }
    return {
      titulo: 'Revisá el formulario antes de crear el ticket',
      lineas
    };
  }

  guardarTicketNuevo(modal: NgbActiveModal): void {
    const f = this.ticketNuevoForm;
    const cliente = this.armarValidacionClienteTicketNuevo();
    if (cliente) {
      this.ticketNuevoValidacion = { ...cliente, esError: false };
      return;
    }

    this.ticketNuevoValidacion = null;
    this.creandoTicket = true;
    this.ticketsService
      .crear({
        titulo: f.titulo.trim(),
        descripcion: f.descripcion.trim(),
        areaDestino: this.esTipoComunSeleccionado() ? f.areaDestino : undefined,
        prioridad: f.prioridad,
        nota: f.nota.trim() || undefined,
        ticketTipoId: f.ticketTipoId ?? undefined
      })
      .subscribe({
        next: (response) => {
          if (response.success) {
            modal.close('ok');
            this.notificationService.showSuccessMessage(`Ticket ${response.data.codigo} creado correctamente.`);
            this.actualizarTodo();
            this.router.navigate(['/menu/tickets', response.data.id]);
          } else {
            const msg = response.message || 'No se pudo crear el ticket.';
            this.ticketNuevoValidacion = {
              titulo: 'No se pudo crear el ticket',
              lineas: [msg],
              esError: true
            };
          }
        },
        error: (error) => {
          const body = error?.error as { message?: string } | string | undefined;
          const msg =
            typeof body === 'string'
              ? body
              : typeof body?.message === 'string'
                ? body.message
                : 'No se pudo crear el ticket.';
          this.ticketNuevoValidacion = {
            titulo: 'Error al crear el ticket',
            lineas: [msg],
            esError: true
          };
        },
        complete: () => {
          this.creandoTicket = false;
        }
      });
  }

  esUsuarioRolGeneral(): boolean {
    return this.permissionsService.isUser();
  }

  /**
   * Solo GM o ADMIN (rol efectivo) pueden borrar tickets. Si un GM activa "ver como" un rol
   * sin permiso, pierde el botón hasta volver a su rol normal: evita eliminar sin querer
   * mientras se simula otro perfil.
   */
  canDeleteTickets(): boolean {
    return this.permissionsService.isGMOrAdmin();
  }

  /**
   * Click en cualquier parte de la fila → abrir el detalle. Los elementos hijos que ya
   * navegan o ejecutan acciones (papelera, pill de adjuntos) usan `stopPropagation` para
   * no disparar este handler dos veces.
   */
  abrirDetalle(ticketId: number, fragment?: string): void {
    this.router.navigate(['/menu/tickets', ticketId], {
      fragment: fragment || undefined
    });
  }

  abrirAdjuntos(ticketId: number, event: Event): void {
    event.stopPropagation();
    this.abrirDetalle(ticketId, 'adjuntos');
  }

  esTicketSeleccionado(ticketId: number): boolean {
    return this.selectedTicketId === ticketId;
  }

  cerrarDetalle(): void {
    this.router.navigate(['/menu/tickets']);
  }

  onTicketDetailChanged(): void {
    this.actualizarTodo();
  }

  onTicketDetailAccessDenied(): void {
    this.cerrarDetalle();
  }

  onRowKeyDown(event: KeyboardEvent, ticketId: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.abrirDetalle(ticketId);
    }
  }

  /**
   * Click en la papelera de una fila: pre-arma la confirmación.
   * El borrado real se ejecuta desde {@link confirmarEliminacion}.
   */
  eliminarTicket(ticket: Ticket, event: Event): void {
    event.stopPropagation();
    if (!this.canDeleteTickets()) return;
    this.ticketToDelete = ticket;
    this.showConfirmDialog = true;
  }

  /**
   * Borrado definitivo del ticket (comentarios, historial, lecturas y archivos adjuntos).
   * El backend re-valida el rol; aquí confiamos en que la papelera solo aparece para GM/Admin.
   */
  confirmarEliminacion(): void {
    if (!this.ticketToDelete || this.eliminando) return;
    const ticket = this.ticketToDelete;
    const codigo = ticket.codigo || `#${ticket.id}`;
    this.eliminando = true;
    this.ticketsService.eliminarTicket(ticket.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.showSuccessMessage(`Ticket ${codigo} eliminado.`);
          if (this.selectedTicketId === ticket.id) {
            this.cerrarDetalle();
          }
          this.actualizarTodo();
        } else {
          this.notificationService.showError(
            'Error',
            response.message || 'No se pudo eliminar el ticket.'
          );
        }
        this.cerrarConfirmacion();
      },
      error: (error) => {
        this.notificationService.showError(
          'Error',
          error?.error?.message || 'No se pudo eliminar el ticket.'
        );
        this.cerrarConfirmacion();
      }
    });
  }

  cancelarEliminacion(): void {
    if (this.eliminando) return;
    this.cerrarConfirmacion();
  }

  private cerrarConfirmacion(): void {
    this.showConfirmDialog = false;
    this.ticketToDelete = null;
    this.eliminando = false;
  }

  getEstadoLabel(estado: TicketEstado): string {
    return this.formatBadgeLabel(estado);
  }

  private formatBadgeLabel(value: string): string {
    return (value || '')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  }

  private runTourTickets(): void {
    this.pageTour?.destroy();
    this.modalService.dismissAll();

    const pasosBase: GuidedTourStepDef[] = [
      {
        selector: '#tour-tickets-title',
        title: 'Tickets / Reclamos',
        description:
          'Acá gestionás reclamos internos entre áreas (almacén, inventario, compras, laboratorio, etc.).',
        side: 'bottom'
      },
      {
        selector: '#tour-tickets-filters',
        title: 'Filtros',
        description:
          'Estado, área y búsqueda filtran la bandeja que tengas abierta en las pestañas.',
        side: 'bottom'
      },
      {
        selector: '#tour-tickets-tabs',
        title: 'Bandejas',
        description:
          'Elegí Bandeja del área, Mis tickets o Cerrados. A la izquierda la lista; a la derecha el detalle del ticket seleccionado.',
        side: 'bottom'
      },
      {
        selector: '#tour-tickets-panels',
        title: 'Lista y detalle',
        description:
          'Hacé clic en un ticket para verlo al lado (en el celular se abre a pantalla completa). Podés ordenar con los encabezados de la lista.',
        side: 'top'
      },
      ...(this.canCreateTickets()
        ? ([
            {
              selector: '#tour-tickets-nuevo',
              title: 'Botón «Nuevo ticket»',
              description:
                'Desde acá abrís el formulario de alta. Si querés un recorrido por los campos del modal, elegí «Cómo crear un ticket» en el menú del perro.',
              side: 'bottom' as const
            }
          ] satisfies GuidedTourStepDef[])
        : [])
    ];

    const steps = this.guidedTourHost.buildSteps(pasosBase);
    if (steps.length === 0) {
      return;
    }
    const inst = this.guidedTourHost.startTour(steps);
    if (inst) {
      this.pageTour = inst;
    }
  }

  private runTourCrearTicket(): void {
    this.pageTour?.destroy();
    this.modalService.dismissAll();
    if (!this.canCreateTickets()) {
      return;
    }

    this.abrirModalTicketNuevo();

    const pasosModal: GuidedTourStepDef[] = [
      {
        selector: '#tour-ticket-nuevo-titulo',
        title: 'Título (obligatorio)',
        description:
          'Resumen breve del reclamo (máximo 200 caracteres). Se usa en la grilla y en notificaciones, así que conviene un título claro y específico. Es obligatorio: sin título el botón "Crear" rechaza el formulario.',
        side: 'bottom'
      },
      {
        selector: '#tour-ticket-nuevo-area',
        title: 'Área destino (obligatorio)',
        description:
          'El área que debe atender el ticket. El reclamo llegará a su bandeja; elegí la que corresponda al tipo de pedido.',
        side: 'right'
      },
      {
        selector: '#tour-ticket-nuevo-prioridad',
        title: 'Prioridad',
        description:
          'BAJA, MEDIA, ALTA o CRÍTICA. Indicá la urgencia real para que el equipo priorice sin sobrecargar lo crítico.',
        side: 'left'
      },
      {
        selector: '#tour-ticket-nuevo-descripcion',
        title: 'Descripción (obligatorio)',
        description:
          'Detalle del problema, pasos para reproducirlo o lo que necesitás. Cuanto más contexto, más rápida puede ser la respuesta. Es obligatorio.',
        side: 'top'
      },
      {
        selector: '#tour-ticket-nuevo-nota',
        title: 'Nota inicial (opcional)',
        description:
          'Texto extra que queda en el primer movimiento del historial. Útil para enlaces o aclaraciones.',
        side: 'top'
      },
      {
        selector: '#tour-ticket-nuevo-crear',
        title: 'Crear ticket',
        description:
          'Valida que estén completos los tres campos obligatorios: título, descripción y área destino. Si falta alguno, verás un aviso en el pie del modal indicando qué corregir.',
        side: 'top'
      }
    ];

    setTimeout(() => {
      const modalSteps: DriveStep[] = pasosModal
        .filter((d) => document.querySelector(d.selector))
        .map((d) => ({
          element: d.selector,
          popover: {
            title: d.title,
            description: d.description,
            side: (d.side ?? 'bottom') as 'top' | 'bottom' | 'left' | 'right',
            align: 'start'
          }
        }));
      if (modalSteps.length === 0) {
        this.modalService.dismissAll();
        return;
      }
      const inst = this.guidedTourHost.startTour(modalSteps, () => {
        this.modalService.dismissAll();
      });
      if (inst) {
        this.pageTour = inst;
      }
    }, 320);
  }
}

