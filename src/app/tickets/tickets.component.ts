import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { NotificationService } from '../services/notification.service';
import { PermissionsService } from '../services/permissions.service';
import { Ticket, TicketEstado, TicketPrioridad, TicketsService } from '../services/tickets.service';
import { forkJoin, Subscription } from 'rxjs';
import { GuidedTourHostService, type GuidedTourStepDef } from '../services/guided-tour-host.service';
import { TourRegistryService } from '../services/tour-registry.service';
import type { DriveStep, Driver } from 'driver.js';

type TicketsOrdenColumna = 'titulo' | 'areaActual' | 'estado' | 'prioridad' | 'fechaActualizacion';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NgbModalModule, NotificationContainerComponent],
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

  ordenColumna: TicketsOrdenColumna | null = null;
  ordenAsc = true;

  /** Áreas para filtro local (incl. Laboratorio: el creador puede tener tickets derivados allí). */
  readonly areasTicket: string[] = [
    'ALMACEN',
    'INVENTARIO',
    'COMPRAS',
    'GESTION_EQUIP',
    'IMPRESION',
    'GARANTIA',
    'LABORATORIO'
  ];

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
  private lastViewAsRole: string | null = null;
  private pageTour?: Driver;
  private tourCleanup?: () => void;

  @ViewChild('ticketNuevoModal') ticketNuevoModalTpl!: TemplateRef<unknown>;

  /** Modal nuevo ticket (mismo flujo que el antiguo ticket-create). */
  creandoTicket = false;
  /** Avisos de validación o error API dentro del modal (no solo toast detrás del backdrop). */
  ticketNuevoValidacion: { titulo: string; lineas: string[]; esError: boolean } | null = null;
  ticketNuevoForm = {
    titulo: '',
    descripcion: '',
    areaDestino: '',
    prioridad: 'MEDIA' as TicketPrioridad,
    nota: ''
  };
  readonly prioridadesTicket: TicketPrioridad[] = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];

  constructor(
    private ticketsService: TicketsService,
    private notificationService: NotificationService,
    private permissionsService: PermissionsService,
    private modalService: NgbModal,
    private router: Router,
    private guidedTourHost: GuidedTourHostService,
    private tourRegistry: TourRegistryService
  ) {}

  ngOnInit(): void {
    this.lastViewAsRole = this.permissionsService.getViewAsRole();
    this.actualizarTodo();
    this.viewAsSub = this.permissionsService.viewAs$.subscribe((nextRole) => {
      if (nextRole === this.lastViewAsRole) {
        return;
      }
      this.lastViewAsRole = nextRole;
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
  }

  ngOnDestroy(): void {
    this.viewAsSub?.unsubscribe();
    this.tourCleanup?.();
    this.tourCleanup = undefined;
    this.pageTour?.destroy();
    this.pageTour = undefined;
  }

  actualizarTodo(): void {
    this.cargarTickets();
    this.cargarCerrados();
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
    return this.formatBadgeLabel(area);
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
    this.ticketNuevoForm = {
      titulo: '',
      descripcion: '',
      areaDestino: '',
      prioridad: 'MEDIA',
      nota: ''
    };
    this.ticketNuevoValidacion = null;
  }

  limpiarFeedbackTicketNuevo(): void {
    this.ticketNuevoValidacion = null;
  }

  /** Misma regla que `armarValidacionClienteTicketNuevo` (hover ámbar en el botón cuando falta algo). */
  esTicketNuevoFormValido(): boolean {
    const f = this.ticketNuevoForm;
    return !!(f.titulo?.trim() && f.descripcion?.trim() && f.areaDestino);
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
    if (!f.areaDestino) {
      lineas.push('Seleccioná el área destino.');
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
        areaDestino: f.areaDestino,
        prioridad: f.prioridad,
        nota: f.nota.trim() || undefined
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
          'Estado, área y búsqueda por código o título filtran las tres bandejas sobre los datos ya cargados.',
        side: 'bottom'
      },
      {
        selector: '#tour-tickets-panels',
        title: 'Bandejas',
        description:
          'Tickets del área según tu rol, los que creaste vos y el historial de cerrados. Abrí el detalle desde «Abrir» en cada fila.',
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

