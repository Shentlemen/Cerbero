import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { NotificationService } from '../services/notification.service';
import { PermissionsService } from '../services/permissions.service';
import { Ticket, TicketEstado, TicketsService } from '../services/tickets.service';
import { forkJoin, Subscription } from 'rxjs';

type TicketsOrdenColumna = 'titulo' | 'areaActual' | 'estado' | 'prioridad' | 'fechaActualizacion';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NotificationContainerComponent],
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

  /** Filtros locales (área y código) sobre las listas ya cargadas. */
  filtroArea = '';
  filtroCodigo = '';

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

  constructor(
    private ticketsService: TicketsService,
    private notificationService: NotificationService,
    private permissionsService: PermissionsService
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
  }

  ngOnDestroy(): void {
    this.viewAsSub?.unsubscribe();
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
    const cod = this.filtroCodigo.trim().toUpperCase();
    if (cod) {
      out = out.filter((t) => t.codigo.toUpperCase().includes(cod));
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

  canCreateTickets(): boolean {
    return this.permissionsService.canCreateTickets();
  }

  esUsuarioRolGeneral(): boolean {
    return this.permissionsService.isUser();
  }

  getEstadoLabel(estado: TicketEstado): string {
    return estado
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  }
}

