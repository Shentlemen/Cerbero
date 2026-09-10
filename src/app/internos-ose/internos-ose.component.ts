import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { InternosOseService, InternoOseDTO, InternoOsePayload } from '../services/internos-ose.service';
import { PermissionsService } from '../services/permissions.service';
import { AuthService } from '../services/auth.service';
import { ContactoUsuario, User } from '../interfaces/auth.interface';
import { TourRegistryService } from '../services/tour-registry.service';
import { GuidedTourHostService } from '../services/guided-tour-host.service';
import { TicketAreaDTO, TicketAreaService } from '../services/ticket-area.service';

type InternoSortColumn = 'box' | 'area' | 'persona' | 'interno' | 'app';
type GuiaPestana = 'equipo' | 'internos';

interface GrupoContactos {
  key: string;
  label: string;
  usuarios: ContactoUsuario[];
}

const GRUPO_GM = 'GM';
const GRUPO_SIN_AREA = '__SIN_AREA__';

@Component({
  selector: 'app-internos-ose',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './internos-ose.component.html',
  styleUrls: ['./internos-ose.component.css']
})
export class InternosOseComponent implements OnInit, OnDestroy {
  internosList: InternoOseDTO[] = [];
  internosFiltrados: InternoOseDTO[] = [];
  internoForm: FormGroup;
  pestana: GuiaPestana = 'equipo';
  usuariosList: ContactoUsuario[] = [];
  searchUsuarios = '';
  loadingUsuarios = false;
  errorUsuarios: string | null = null;
  searchTerm = '';
  soloActivos = false;
  sortColumn: InternoSortColumn = 'area';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 25;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  internoSeleccionado: InternoOseDTO | null = null;
  showConfirmDialog = false;
  internoToDelete: InternoOseDTO | null = null;
  areasGuia: TicketAreaDTO[] = [];
  private tourCleanup?: () => void;

  constructor(
    private internosOseService: InternosOseService,
    private permissionsService: PermissionsService,
    private authService: AuthService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private tourRegistry: TourRegistryService,
    private guidedTourHost: GuidedTourHostService,
    private ticketAreaService: TicketAreaService
  ) {
    this.internoForm = this.fb.group({
      box: [''],
      area: ['', Validators.required],
      persona: [''],
      interno: [''],
      app: [''],
      esColectivo: [false],
      activo: [true]
    });
  }

  ngOnInit(): void {
    this.loadUsuarios();
    this.loadInternos();
    this.ticketAreaService.refreshAreasActivas().subscribe({
      next: (list) => {
        this.areasGuia = list ?? [];
      }
    });
    this.tourCleanup = this.tourRegistry.register('internos-ose', [
      {
        id: 'guia-equipo-overview',
        title: 'Tour del equipo Cerbero',
        icon: 'fa-route',
        run: () => this.runTourEquipo()
      },
      {
        id: 'guia-internos-overview',
        title: 'Tour de internos',
        icon: 'fa-phone-alt',
        run: () => this.runTourInternos()
      }
    ]);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
  }

  private runTourEquipo(): void {
    this.pestana = 'equipo';
    window.setTimeout(() => {
      const steps = this.guidedTourHost.buildSteps([
        { selector: '#tour-guia-title', title: 'Guía de contactos', description: 'Directorio interno: el equipo de Cerbero y los internos telefónicos de la organización.', side: 'bottom' },
        { selector: '#tour-guia-tabs', title: 'Dos secciones', description: '«Equipo Cerbero» muestra las personas del sistema agrupadas por área. «Internos» es el directorio telefónico (box, área, interno).', side: 'bottom' },
        { selector: '#tour-guia-equipo-search', title: 'Búsqueda', description: 'Filtrá por nombre, usuario, correo o área. Los grupos se actualizan al instante.', side: 'bottom' },
        { selector: '#tour-guia-equipo-grid', title: 'Tarjetas de contacto', description: 'Cada tarjeta muestra foto o iniciales, usuario, correo y área. La tuya aparece marcada como «Vos».', side: 'top' }
      ]);
      this.guidedTourHost.startTour(steps);
    }, 80);
  }

  private runTourInternos(): void {
    this.pestana = 'internos';
    window.setTimeout(() => {
      const steps = this.guidedTourHost.buildSteps([
        { selector: '#tour-guia-tabs', title: 'Internos telefónicos', description: 'Esta pestaña lista box, área, persona, número interno y app. Es independiente de las cuentas de login.', side: 'bottom' },
        { selector: '#tour-guia-interno-nuevo', title: 'Nuevo interno', description: 'Alta de un interno (área, persona, número, si es colectivo). Sólo visible si tenés permiso de gestión.', side: 'left' },
        { selector: '#tour-guia-internos-search', title: 'Búsqueda y activos', description: 'Buscá por box, área, persona, interno o app. «Solo activos» oculta los dados de baja.', side: 'bottom' },
        { selector: '#tour-guia-internos-table', title: 'Listado', description: 'Ordená por columna. Con permiso de gestión, editá o eliminá desde las acciones de cada fila.', side: 'top' }
      ]);
      this.guidedTourHost.startTour(steps);
    }, 80);
  }

  cambiarPestana(pestana: GuiaPestana): void {
    this.pestana = pestana;
  }

  loadUsuarios(): void {
    this.loadingUsuarios = true;
    this.errorUsuarios = null;
    const fuente$: Observable<ContactoUsuario[]> = this.permissionsService.canManageUsers()
      ? this.authService.getAllUsers().pipe(
          map((users) => users.filter((u) => u.enabled).map((u) => this.toContacto(u)))
        )
      : this.authService.getDirectorioUsuarios().pipe(
          map((users) => users.map((u) => this.toContacto(u)))
        );
    fuente$.subscribe({
      next: (usuarios) => {
        this.usuariosList = usuarios;
        this.loadingUsuarios = false;
      },
      error: (err: Error) => {
        this.errorUsuarios = err.message || 'Error al cargar el equipo.';
        this.loadingUsuarios = false;
      }
    });
  }

  private toContacto(u: ContactoUsuario | User): ContactoUsuario {
    const user = u as User;
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      hasAvatar: !!u.hasAvatar,
      areaId: user.areaId ?? null,
      areaCodigo: user.areaCodigo ?? user.ticketAreaCodigo ?? null,
      areaNombre: user.areaNombre ?? null,
      areaColor: user.areaColor ?? null
    };
  }

  get usuariosFiltrados(): ContactoUsuario[] {
    const term = this.normalizeForSearch(this.searchUsuarios);
    if (!term) {
      return this.usuariosList;
    }
    return this.usuariosList.filter((u) => this.matchesUsuarioSearch(u, term));
  }

  get gruposUsuarios(): GrupoContactos[] {
    const filtered = this.usuariosFiltrados;
    const porGrupo = new Map<string, GrupoContactos>();
    for (const u of filtered) {
      const { key, label } = this.grupoDeUsuario(u);
      const grupo = porGrupo.get(key) ?? { key, label, usuarios: [] };
      grupo.usuarios.push(u);
      porGrupo.set(key, grupo);
    }
    return [...porGrupo.values()].sort((a, b) => {
      if (a.key === GRUPO_GM) return -1;
      if (b.key === GRUPO_GM) return 1;
      if (a.key === GRUPO_SIN_AREA) return 1;
      if (b.key === GRUPO_SIN_AREA) return -1;
      return a.label.localeCompare(b.label, 'es');
    });
  }

  onSearchUsuariosChange(): void {
    /* getter usuariosFiltrados reacciona al ngModel */
  }

  clearSearchUsuarios(): void {
    this.searchUsuarios = '';
  }

  nombreVisible(u: ContactoUsuario): string {
    const n = [u.firstName, u.lastName].filter((p) => (p || '').trim()).join(' ').trim();
    return n || u.username || 'Usuario';
  }

  inicialesUsuario(u: ContactoUsuario): string {
    const first = (u.firstName || '').trim();
    const last = (u.lastName || '').trim();
    if (first && last) {
      return (first[0] + last[0]).toUpperCase();
    }
    const label = (first || last || u.username || '?').trim();
    return label.slice(0, 2).toUpperCase();
  }

  avatarUrl(userId: number): string {
    return this.authService.getAvatarUrl(userId);
  }

  onUsuarioAvatarError(u: ContactoUsuario): void {
    u.hasAvatar = false;
  }

  esUsuarioActual(u: ContactoUsuario): boolean {
    return this.authService.getCurrentUser()?.id === u.id;
  }

  etiquetaPersona(u: ContactoUsuario): string {
    if ((u.role || '').toUpperCase() === 'GM') {
      return 'Game Master';
    }
    const area = this.resolverAreaPersona(u);
    if (area?.nombre) {
      return area.nombre;
    }
    return 'Sin área';
  }

  claseRolPersona(u: ContactoUsuario): string {
    if ((u.role || '').toUpperCase() === 'GM') {
      return 'guia-persona-rol--gm';
    }
    const area = this.resolverAreaPersona(u);
    const codigo = (area?.codigo || u.areaCodigo || '').toLowerCase();
    const known = [
      'admin', 'almacen', 'inventario', 'compras', 'gestion_equip', 'impresion', 'garantia', 'laboratorio'
    ];
    if (known.includes(codigo) && !this.colorPersona(u)) {
      return `guia-persona-rol--${codigo}`;
    }
    return area || this.colorPersona(u) ? 'guia-persona-rol--area' : 'guia-persona-rol--user';
  }

  colorPersona(u: ContactoUsuario): string | null {
    const propio = (u.areaColor || '').trim();
    if (propio) {
      return propio;
    }
    return (this.resolverAreaPersona(u)?.color || '').trim() || null;
  }

  private resolverAreaPersona(u: ContactoUsuario): { codigo: string; nombre: string; color?: string | null } | null {
    const codigo = (u.areaCodigo || '').trim().toUpperCase()
      || this.codigoAreaDesdeRol(u.role);
    if (u.areaNombre?.trim()) {
      return {
        codigo: codigo || (u.areaNombre || '').trim().toUpperCase(),
        nombre: u.areaNombre.trim(),
        color: u.areaColor
      };
    }
    if (!codigo) {
      return null;
    }
    const found = this.areasGuia.find((a) => (a.codigo || '').toUpperCase() === codigo)
      ?? this.ticketAreaService.getAreasActivasSnapshot()
        .find((a) => (a.codigo || '').toUpperCase() === codigo);
    if (found) {
      return { codigo: found.codigo, nombre: found.nombre, color: found.color };
    }
    const label = this.getRoleLabel(codigo);
    if (label && label.toUpperCase() !== 'USUARIO' && label.toUpperCase() !== 'USER') {
      return { codigo, nombre: label, color: u.areaColor };
    }
    return { codigo, nombre: codigo, color: u.areaColor };
  }

  private codigoAreaDesdeRol(role?: string | null): string {
    const r = (role || '').toUpperCase();
    if (!r || r === 'USER' || r === 'GM') {
      return '';
    }
    if (r === 'ADMIN') {
      return 'LABORATORIO';
    }
    return r;
  }

  private grupoDeUsuario(u: ContactoUsuario): { key: string; label: string } {
    if ((u.role || '').toUpperCase() === 'GM') {
      return { key: GRUPO_GM, label: 'Game Master' };
    }
    const area = this.resolverAreaPersona(u);
    if (area) {
      return { key: (area.codigo || area.nombre).toUpperCase(), label: area.nombre };
    }
    return { key: GRUPO_SIN_AREA, label: 'Sin área' };
  }

  getRoleLabel(role: string): string {
    switch ((role || '').toUpperCase()) {
      case 'GM': return 'Game Master';
      case 'ADMIN': return 'Administrador';
      case 'USER': return 'Usuario';
      case 'ALMACEN': return 'Almacén';
      case 'INVENTARIO': return 'Inventario';
      case 'COMPRAS': return 'Compras';
      case 'GESTION_EQUIP': return 'Gestión de equipos';
      case 'IMPRESION': return 'Impresión';
      case 'GARANTIA': return 'Garantía';
      case 'LABORATORIO': return 'Laboratorio';
      default: return role || '—';
    }
  }

  iconoGrupo(key: string): string {
    switch ((key || '').toUpperCase()) {
      case 'GM': return 'fas fa-crown';
      case 'ADMIN':
      case 'LABORATORIO': return 'fas fa-user-shield';
      case 'ALMACEN': return 'fas fa-warehouse';
      case 'INVENTARIO': return 'fas fa-boxes-stacked';
      case 'COMPRAS': return 'fas fa-cart-shopping';
      case 'GESTION_EQUIP': return 'fas fa-laptop-code';
      case 'IMPRESION': return 'fas fa-print';
      case 'GARANTIA': return 'fas fa-screwdriver-wrench';
      case GRUPO_SIN_AREA: return 'fas fa-user';
      default: return 'fas fa-layer-group';
    }
  }

  private matchesUsuarioSearch(u: ContactoUsuario, term: string): boolean {
    const haystack = [
      u.firstName,
      u.lastName,
      `${u.firstName || ''} ${u.lastName || ''}`,
      u.username,
      u.email,
      u.role,
      u.areaNombre,
      u.areaCodigo,
      this.etiquetaPersona(u)
    ]
      .map((v) => this.normalizeForSearch(v))
      .join(' ');
    return haystack.includes(term);
  }

  canManageInternos(): boolean {
    return this.permissionsService.canManageInternosOse();
  }

  canDeleteInternos(): boolean {
    return this.permissionsService.canDeleteInternosOse();
  }

  loadInternos(): void {
    this.loading = true;
    this.error = null;

    this.internosOseService.getInternos().subscribe({
      next: (internos: InternoOseDTO[]) => {
        this.internosList = internos;
        this.aplicarFiltrosYOrden();
        this.loading = false;
      },
      error: (err: Error) => {
        console.error('Error al cargar internos OSE:', err);
        this.error = err.message || 'Error al cargar los internos. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  get pagedInternos(): InternoOseDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    return this.internosFiltrados.slice(startItem, startItem + this.pageSize);
  }

  get rangoDesde(): number {
    if (this.collectionSize === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get rangoHasta(): number {
    return Math.min(this.page * this.pageSize, this.collectionSize);
  }

  onSearchTermChange(): void {
    this.page = 1;
    this.aplicarFiltrosYOrden();
  }

  onSoloActivosChange(): void {
    this.page = 1;
    this.aplicarFiltrosYOrden();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchTermChange();
  }

  sortData(column: InternoSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.page = 1;
    this.ordenarLista(this.internosFiltrados);
  }

  getSortIcon(column: InternoSortColumn): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  isSortActive(column: InternoSortColumn): boolean {
    return this.sortColumn === column;
  }

  private aplicarFiltrosYOrden(): void {
    const term = this.normalizeForSearch(this.searchTerm);
    this.internosFiltrados = this.internosList.filter((item) => {
      if (this.soloActivos && !item.activo) {
        return false;
      }
      if (!term) {
        return true;
      }
      return this.matchesSearch(item, term);
    });
    this.ordenarLista(this.internosFiltrados);
    this.collectionSize = this.internosFiltrados.length;
    const maxPage = Math.max(1, Math.ceil(this.collectionSize / this.pageSize) || 1);
    if (this.page > maxPage) {
      this.page = maxPage;
    }
  }

  private normalizeForSearch(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private matchesSearch(item: InternoOseDTO, term: string): boolean {
    const haystack = [
      item.box,
      item.area,
      item.persona,
      item.interno,
      item.app
    ]
      .map((v) => this.normalizeForSearch(v))
      .join(' ');
    return haystack.includes(term);
  }

  private ordenarLista(lista: InternoOseDTO[]): void {
    const col = this.sortColumn;
    const mult = this.sortDirection === 'asc' ? 1 : -1;
    lista.sort((a, b) => {
      const valA = this.getSortValue(a, col);
      const valB = this.getSortValue(b, col);
      return valA.localeCompare(valB, 'es', { sensitivity: 'base' }) * mult;
    });
  }

  private getSortValue(item: InternoOseDTO, col: InternoSortColumn): string {
    switch (col) {
      case 'box':
        return this.normalizeForSearch(item.box);
      case 'persona':
        return this.normalizeForSearch(item.persona);
      case 'interno':
        return this.normalizeForSearch(item.interno);
      case 'app':
        return this.normalizeForSearch(item.app);
      default:
        return this.normalizeForSearch(item.area);
    }
  }

  abrirModal(modal: unknown, interno?: InternoOseDTO): void {
    const accion = interno ? 'editar internos' : 'crear internos';
    if (this.permissionsService.denyUnless(this.canManageInternos(), accion)) {
      return;
    }
    if (interno) {
      this.modoEdicion = true;
      this.internoSeleccionado = interno;
      this.internoForm.patchValue({
        box: interno.box ?? '',
        area: interno.area ?? '',
        persona: interno.persona ?? '',
        interno: interno.interno ?? '',
        app: interno.app ?? '',
        esColectivo: !!interno.esColectivo,
        activo: interno.activo !== false
      });
    } else {
      this.modoEdicion = false;
      this.internoSeleccionado = null;
      this.internoForm.reset({
        box: '',
        area: '',
        persona: '',
        interno: '',
        app: '',
        esColectivo: false,
        activo: true
      });
    }
    this.modalService.open(modal, { size: 'lg', backdrop: true });
  }

  guardarInterno(): void {
    if (!this.internoForm.valid) {
      Object.keys(this.internoForm.controls).forEach(key => this.internoForm.get(key)?.markAsTouched());
      return;
    }

    const payload = this.buildPayload();
    if (!payload.area) {
      this.error = 'El área es obligatoria';
      return;
    }

    if (this.modoEdicion && this.internoSeleccionado) {
      this.internosOseService.actualizarInterno(this.internoSeleccionado.id, payload).subscribe({
        next: () => {
          this.loadInternos();
          this.modalService.dismissAll();
          this.error = null;
        },
        error: (err: Error) => {
          console.error('Error al actualizar interno:', err);
          this.error = err.message || 'Error al actualizar el interno.';
        }
      });
    } else {
      this.internosOseService.crearInterno(payload).subscribe({
        next: () => {
          this.loadInternos();
          this.modalService.dismissAll();
          this.error = null;
        },
        error: (err: Error) => {
          console.error('Error al crear interno:', err);
          this.error = err.message || 'Error al crear el interno.';
        }
      });
    }
  }

  private buildPayload(): InternoOsePayload {
    const raw = this.internoForm.value;
    const trim = (v: unknown) => {
      const s = String(v ?? '').trim();
      return s.length ? s : null;
    };
    return {
      box: trim(raw.box),
      area: String(raw.area ?? '').trim(),
      persona: trim(raw.persona),
      interno: trim(raw.interno),
      app: trim(raw.app),
      esColectivo: !!raw.esColectivo,
      activo: raw.activo !== false
    };
  }

  eliminarInterno(interno: InternoOseDTO): void {
    if (this.permissionsService.denyUnless(this.canDeleteInternos(), 'eliminar este interno')) {
      return;
    }
    this.internoToDelete = interno;
    this.showConfirmDialog = true;
  }

  confirmarEliminacion(): void {
    if (!this.internoToDelete) {
      return;
    }
    this.internosOseService.eliminarInterno(this.internoToDelete.id).subscribe({
      next: () => {
        this.loadInternos();
        this.showConfirmDialog = false;
        this.internoToDelete = null;
        this.error = null;
      },
      error: (err: Error) => {
        console.error('Error al eliminar interno:', err);
        this.error = err.message || 'Error al eliminar el interno.';
        this.showConfirmDialog = false;
        this.internoToDelete = null;
      }
    });
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.internoToDelete = null;
  }

  displayValue(value?: string | null): string {
    return value && value.trim() ? value : '-';
  }
}
