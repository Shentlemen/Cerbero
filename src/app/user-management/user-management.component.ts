import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../services/auth.service';
import { User, CreateUserRequest, UpdateUserRequest } from '../interfaces/auth.interface';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { TourRegistryService } from '../services/tour-registry.service';
import { TicketAreaService, TicketAreaDTO } from '../services/ticket-area.service';

type UserSortColumn = 'username' | 'email' | 'nombreCompleto' | 'role' | 'enabled' | 'createdAt';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule, NotificationContainerComponent],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit, OnDestroy {
  users: User[] = [];
  userForm: FormGroup;
  filterForm: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';
  showForm = false;
  editingUser: User | null = null;
  filtroEstado: 'todos' | 'activo' | 'inactivo' = 'todos';
  filtroRol: 'todos' | string = 'todos';
  filtroTabs: { value: string; label: string }[] = [{ value: 'GM', label: 'Game Master' }];
  sortColumn: UserSortColumn | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  showDeleteDialog = false;
  userToDelete: User | null = null;
  showEstadoDialog = false;
  userToToggle: User | null = null;
  private tourCleanup?: () => void;

  usuarioModalValidacion: { titulo: string; lineas: string[]; esError: boolean } | null = null;

  bandejasUsuario: TicketAreaDTO[] = [];
  private todasAreasTicket: TicketAreaDTO[] = [];

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private notificationService: NotificationService,
    private tourRegistry: TourRegistryService,
    private ticketAreaService: TicketAreaService
  ) {
    this.filterForm = this.fb.group({
      search: ['']
    });
    this.userForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      asignacion: [null as string | number | null, [Validators.required]]
    });

    this.userForm.valueChanges.subscribe(() => this.limpiarFeedbackUsuarioModal());
  }

  get areasParaAsignar(): TicketAreaDTO[] {
    const currentId = this.editingUser?.areaId ?? null;
    return this.todasAreasTicket
      .filter((a) => a.activa || a.id === currentId)
      .slice()
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  }

  limpiarFeedbackUsuarioModal(): void {
    this.usuarioModalValidacion = null;
  }

  private rebuildFiltroTabs(): void {
    this.filtroTabs = [
      { value: 'GM', label: 'Game Master' },
      ...this.todasAreasTicket.map((a) => ({
        value: (a.codigo || '').toUpperCase(),
        label: a.nombre
      })).filter((t) => !!t.value)
    ];
  }

  trackByTabValue(_: number, tab: { value: string }): string {
    return tab.value;
  }

  getBandejaLabel(codigo: string | null | undefined): string {
    if (!codigo) return '—';
    const b = this.todasAreasTicket.find((x) => x.codigo === codigo)
      ?? this.bandejasUsuario.find((x) => x.codigo === codigo);
    return b ? b.nombre : codigo;
  }

  getBandejaEntrada(user: User): string {
    const cod = this.codigoBandejaEntrada(user);
    if (!cod) {
      if (user.role === 'USER') {
        return 'Sin bandeja';
      }
      if (user.role === 'GM') {
        return 'Sin bandeja fija';
      }
      return '—';
    }
    return this.getBandejaLabel(cod);
  }

  private codigoBandejaEntrada(user: User): string | null {
    if (user.role === 'GM') {
      return null;
    }
    const fromArea = user.areaCodigo?.trim();
    if (fromArea) {
      return fromArea.toUpperCase();
    }
    const c = user.ticketAreaCodigo?.trim();
    if (c) {
      return c.toUpperCase();
    }
    if (user.role === 'ADMIN') {
      return 'LABORATORIO';
    }
    const tiRoles = ['ALMACEN', 'INVENTARIO', 'COMPRAS', 'GESTION_EQUIP', 'IMPRESION', 'GARANTIA', 'LABORATORIO'];
    if (tiRoles.includes(user.role)) {
      return user.role;
    }
    return null;
  }

  getBandejaBadgeClass(user: User): string {
    const cod = this.codigoBandejaEntrada(user);
    if (!cod) {
      if (user.role === 'GM') {
        return 'bandeja-global';
      }
      return 'bandeja-none';
    }
    const slug = cod.toLowerCase().replace(/_/g, '-');
    const tiSlugs = [
      'almacen', 'inventario', 'compras', 'gestion-equip', 'impresion', 'garantia', 'laboratorio'
    ];
    if (tiSlugs.includes(slug)) {
      return `bandeja-${slug}`;
    }
    return this.colorDeUsuario(user) ? 'bandeja-area' : 'bandeja-ose';
  }

  private mensajeErrorHttp(error: unknown): string {
    const e = error as { error?: string | { message?: string }; message?: string };
    const body = e?.error;
    if (typeof body === 'string') {
      return body;
    }
    if (body && typeof body === 'object' && typeof body.message === 'string') {
      return body.message;
    }
    if (typeof e?.message === 'string') {
      return e.message;
    }
    return 'Ocurrió un error inesperado.';
  }

  private armarLineasValidacionUsuario(): string[] {
    const lineas: string[] = [];
    const f = this.userForm;
    const usernameCtrl = f.get('username');
    if (usernameCtrl && !usernameCtrl.disabled) {
      if (usernameCtrl.hasError('required')) {
        lineas.push('El usuario es obligatorio.');
      }
      if (usernameCtrl.hasError('minlength')) {
        lineas.push('El usuario debe tener al menos 3 caracteres.');
      }
    }
    const emailCtrl = f.get('email');
    if (emailCtrl?.hasError('required')) {
      lineas.push('El email es obligatorio.');
    }
    if (emailCtrl?.hasError('email')) {
      lineas.push('Ingresá un email válido.');
    }
    const pwd = f.get('password');
    if (!this.editingUser && pwd?.hasError('required')) {
      lineas.push('La contraseña es obligatoria.');
    }
    if (f.get('firstName')?.hasError('required')) {
      lineas.push('El nombre es obligatorio.');
    }
    if (f.get('lastName')?.hasError('required')) {
      lineas.push('El apellido es obligatorio.');
    }
    if (f.get('asignacion')?.hasError('required') || f.get('asignacion')?.value == null || f.get('asignacion')?.value === '') {
      lineas.push('Seleccioná Game Master o un área.');
    }
    return lineas;
  }

  ngOnInit(): void {
    this.loadUsers();
    this.ticketAreaService.listarAsignables().subscribe({
      next: (list) => { this.bandejasUsuario = list; }
    });
    this.ticketAreaService.listarTodasAdmin().subscribe({
      next: (list) => {
        this.todasAreasTicket = list;
        this.rebuildFiltroTabs();
      }
    });
    this.tourCleanup = this.tourRegistry.register('user-management', [{
      id: 'user-management-overview',
      title: 'Tour de usuarios Cerbero',
      icon: 'fa-route',
      steps: [
        { selector: '#tour-users-title', title: 'Usuarios Cerbero', description: 'Alta, edición y desactivación de cuentas. El área define bandeja y permisos.', side: 'bottom' },
        { selector: '#tour-users-roles', title: 'Filtro por área', description: 'Cada pestaña muestra las cuentas de ese área. «Todos» lista el directorio completo.', side: 'bottom' },
        { selector: '#tour-users-nuevo', title: 'Nuevo usuario', description: 'Abre el formulario con usuario, correo, nombre, rol y área.', side: 'left' },
        { selector: '#tour-users-filters', title: 'Búsqueda y estado', description: 'Búsqueda libre por usuario, correo o nombre, y recorte por activo/inactivo.', side: 'bottom' },
        { selector: '#tour-users-table', title: 'Tabla', description: 'Editá datos, cambiá estado activo/inactivo o eliminá según políticas de seguridad.', side: 'top' }
      ]
    }]);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
  }

  loadUsers(): void {
    this.loading = true;
    this.authService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = 'Error al cargar usuarios: ' + error.message;
        this.notificationService.showError(
          'Error al Cargar Usuarios',
          'No se pudieron cargar los usuarios: ' + error.message
        );
        this.loading = false;
      }
    });
  }

  showCreateForm(): void {
    this.usuarioModalValidacion = null;
    this.editingUser = null;
    this.showForm = true;

    this.userForm.reset();
    this.userForm.patchValue({
      asignacion: null
    });

    this.userForm.get('username')?.enable();
    this.userForm.get('password')?.setValidators([Validators.required]);
    this.userForm.get('password')?.updateValueAndValidity();
  }

  showEditForm(user: User): void {
    this.usuarioModalValidacion = null;
    this.editingUser = user;
    this.showForm = true;

    this.userForm.patchValue({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      asignacion: this.asignacionDeUsuario(user),
      password: ''
    });

    this.userForm.get('username')?.disable();
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingUser = null;
    this.userForm.reset();
    this.errorMessage = '';
    this.successMessage = '';
    this.usuarioModalValidacion = null;
  }

  onSubmit(): void {
    if (!this.userForm.valid) {
      this.userForm.markAllAsTouched();
      const lineas = this.armarLineasValidacionUsuario();
      this.usuarioModalValidacion = {
        titulo: 'Revisá el formulario antes de guardar',
        lineas: lineas.length > 0 ? lineas : ['Hay campos con datos inválidos.'],
        esError: false
      };
      return;
    }

    this.usuarioModalValidacion = null;
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const raw = this.userForm.getRawValue() as {
      username: string;
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      asignacion: string | number | null;
    };

    const { role, areaId } = this.resolverRolYArea(raw.asignacion);
    if (!role) {
      this.usuarioModalValidacion = {
        titulo: 'Revisá el formulario antes de guardar',
        lineas: ['Seleccioná Game Master o un área.'],
        esError: false
      };
      this.loading = false;
      return;
    }

    if (this.editingUser) {
      const updateData: UpdateUserRequest = {
        email: raw.email,
        firstName: raw.firstName,
        lastName: raw.lastName,
        role,
        enabled: this.editingUser.enabled,
        areaId,
        ticketAreaCodigo: null
      };

      if (raw.password && raw.password.trim() !== '') {
        updateData.password = raw.password;
      }

      this.authService.updateUser(this.editingUser.id, updateData).subscribe({
        next: () => {
          this.successMessage = 'Usuario actualizado exitosamente';
          this.notificationService.showSuccessMessage('Usuario actualizado exitosamente');
          this.loadUsers();
          setTimeout(() => this.cancelForm(), 1000);
          this.loading = false;
        },
        error: (error) => {
          const msg = this.mensajeErrorHttp(error);
          this.usuarioModalValidacion = {
            titulo: 'Error al actualizar el usuario',
            lineas: [msg],
            esError: true
          };
          this.notificationService.showError('Error al Actualizar Usuario', 'No se pudo actualizar el usuario: ' + msg);
          this.loading = false;
        }
      });
    } else {
      const createPayload: CreateUserRequest = {
        username: raw.username,
        email: raw.email,
        password: raw.password,
        firstName: raw.firstName,
        lastName: raw.lastName,
        role,
        areaId,
        ticketAreaCodigo: null
      };
      this.authService.createUser(createPayload).subscribe({
        next: () => {
          this.successMessage = 'Usuario creado exitosamente';
          this.notificationService.showSuccessMessage('Usuario creado exitosamente');
          this.loadUsers();
          setTimeout(() => this.cancelForm(), 1000);
          this.loading = false;
        },
        error: (error) => {
          const msg = this.mensajeErrorHttp(error);
          this.usuarioModalValidacion = {
            titulo: 'Error al crear el usuario',
            lineas: [msg],
            esError: true
          };
          this.notificationService.showError('Error al Crear Usuario', 'No se pudo crear el usuario: ' + msg);
          this.loading = false;
        }
      });
    }
  }

  private procesarToggleEstado(user: User): void {
    const nuevoEstado = !user.enabled;
    const accion = nuevoEstado ? 'habilitar' : 'deshabilitar';

    const updateData: UpdateUserRequest = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      enabled: nuevoEstado,
      areaId: user.areaId ?? null,
      ticketAreaCodigo: user.ticketAreaCodigo ?? null
    };

    this.authService.updateUser(user.id, updateData).subscribe({
      next: () => {
        const mensaje = `Usuario ${nuevoEstado ? 'habilitado' : 'deshabilitado'} exitosamente`;
        this.successMessage = mensaje;
        this.notificationService.showSuccessMessage(mensaje);
        this.loadUsers();
      },
      error: (error) => {
        this.errorMessage = `Error al ${accion} usuario: ` + error.message;
        this.notificationService.showError(
          `Error al ${accion} Usuario`,
          'No se pudo actualizar el usuario: ' + error.message
        );
      }
    });
  }

  toggleEstado(user: User): void {
    this.userToToggle = user;
    this.showEstadoDialog = true;
  }

  cancelToggleEstado(): void {
    this.showEstadoDialog = false;
    this.userToToggle = null;
  }

  confirmToggleEstado(): void {
    if (this.userToToggle) {
      this.procesarToggleEstado(this.userToToggle);
      this.showEstadoDialog = false;
      this.userToToggle = null;
    }
  }

  deleteUser(user: User): void {
    this.userToDelete = user;
    this.showDeleteDialog = true;
  }

  cancelDeleteUser(): void {
    this.showDeleteDialog = false;
    this.userToDelete = null;
  }

  confirmDeleteUser(): void {
    if (!this.userToDelete) {
      return;
    }

    const user = this.userToDelete;

    this.authService.deleteUser(user.id).subscribe({
      next: () => {
        this.successMessage = 'Usuario eliminado exitosamente';
        this.notificationService.showSuccessMessage('Usuario eliminado exitosamente');
        this.loadUsers();
      },
      error: (error) => {
        this.errorMessage = 'Error al eliminar usuario: ' + error.message;
        this.notificationService.showError(
          'Error al Eliminar Usuario',
          'No se pudo eliminar el usuario: ' + error.message
        );
      },
      complete: () => {
        this.showDeleteDialog = false;
        this.userToDelete = null;
      }
    });
  }

  private asignacionDeUsuario(user: User): string | number | null {
    if (user.role === 'GM') {
      return 'GM';
    }
    if (user.areaId != null) {
      return user.areaId;
    }
    const codigo = (user.areaCodigo || user.ticketAreaCodigo || (user.role !== 'USER' ? user.role : '') || '')
      .trim()
      .toUpperCase();
    if (!codigo) {
      return null;
    }
    const area = this.todasAreasTicket.find((a) => (a.codigo || '').toUpperCase() === codigo);
    return area?.id ?? null;
  }

  private resolverRolYArea(asignacion: string | number | null): { role: string | null; areaId: number | null } {
    if (asignacion === 'GM') {
      return { role: 'GM', areaId: null };
    }
    const areaId = typeof asignacion === 'number' ? asignacion : Number(asignacion);
    if (!Number.isFinite(areaId) || areaId <= 0) {
      return { role: null, areaId: null };
    }
    return { role: 'USER', areaId };
  }

  getRoleLabel(role: string): string {
    if (role === 'GM') {
      return 'Game Master';
    }
    const area = this.todasAreasTicket.find((a) => a.codigo === role);
    if (area?.nombre) {
      return area.nombre;
    }
    if (role === 'USER') {
      return 'Usuario';
    }
    return role;
  }

  get usersFiltrados(): User[] {
    const list = this.usersEnPestana().filter(user => {
      return this.filtroEstado === 'todos' ||
        (this.filtroEstado === 'activo' && user.enabled) ||
        (this.filtroEstado === 'inactivo' && !user.enabled);
    });
    return this.sortUsers(list);
  }

  sortData(column: UserSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  getSortIcon(column: UserSortColumn): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  private sortUsers(list: User[]): User[] {
    if (!this.sortColumn) return list;
    const dir = this.sortDirection === 'asc' ? 1 : -1;
    const column = this.sortColumn;
    return [...list].sort((a, b) => {
      const cmp = this.compareUsers(a, b, column);
      return cmp === 0 ? 0 : cmp * dir;
    });
  }

  private compareUsers(a: User, b: User, column: UserSortColumn): number {
    switch (column) {
      case 'username':
        return this.compareText(a.username, b.username);
      case 'email':
        return this.compareText(a.email, b.email);
      case 'nombreCompleto':
        return this.compareText(
          `${a.lastName || ''} ${a.firstName || ''}`.trim(),
          `${b.lastName || ''} ${b.firstName || ''}`.trim()
        );
      case 'role':
        return this.compareText(this.getRoleLabel(a.role), this.getRoleLabel(b.role));
      case 'enabled':
        return Number(a.enabled) - Number(b.enabled);
      case 'createdAt': {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return ta - tb;
      }
      default:
        return 0;
    }
  }

  private compareText(a: string | null | undefined, b: string | null | undefined): number {
    return (a || '').localeCompare(b || '', 'es', { sensitivity: 'base', numeric: true });
  }

  private usersEnPestana(): User[] {
    const search = (this.filterForm.get('search')?.value || '').toLowerCase().trim();
    const filtro = this.filtroRol === 'todos' ? 'todos' : (this.filtroRol || '').toUpperCase();
    return this.users.filter(user => {
      const matchSearch = !search ||
        (user.username?.toLowerCase().includes(search) ||
         user.email?.toLowerCase().includes(search) ||
         user.firstName?.toLowerCase().includes(search) ||
         user.lastName?.toLowerCase().includes(search) ||
         `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(search) ||
         `${user.lastName || ''} ${user.firstName || ''}`.toLowerCase().includes(search) ||
         this.getBandejaEntrada(user).toLowerCase().includes(search) ||
         (this.codigoBandejaEntrada(user)?.toLowerCase().includes(search) ?? false));
      const areaCod = this.codigoBandejaEntrada(user);
      const matchRol = filtro === 'todos'
        || (filtro === 'GM' && user.role === 'GM')
        || (areaCod !== null && areaCod === filtro)
        || (user.role || '').toUpperCase() === filtro;
      return matchSearch && matchRol;
    });
  }

  setFiltroEstado(estado: 'todos' | 'activo' | 'inactivo'): void {
    this.filtroEstado = estado;
  }

  setFiltroRol(rol: 'todos' | string): void {
    this.filtroRol = rol === 'todos' ? 'todos' : (rol || '').toUpperCase();
  }

  getEstadoTodosCount(): number {
    return this.usersEnPestana().length;
  }

  getActivosCount(): number {
    return this.usersEnPestana().filter(u => u.enabled).length;
  }

  getInactivosCount(): number {
    return this.usersEnPestana().filter(u => !u.enabled).length;
  }

  getRolCount(role: string): number {
    if (role === 'GM') {
      return this.users.filter(u => u.role === 'GM').length;
    }
    return this.users.filter(u => this.codigoBandejaEntrada(u) === (role || '').toUpperCase()
      || (u.role || '').toUpperCase() === (role || '').toUpperCase()).length;
  }

  getRolColor(role: string): string {
    const area = this.todasAreasTicket.find((a) => (a.codigo || '').toUpperCase() === (role || '').toUpperCase());
    if (area?.color) {
      return area.color;
    }
    const colors: Record<string, string> = {
      GM: '#721c24',
      ADMIN: '#856404',
      USER: '#2c3e50',
      ALMACEN: '#1d4ed8',
      INVENTARIO: '#059669',
      COMPRAS: '#b45309',
      GESTION_EQUIP: '#7c3aed',
      IMPRESION: '#0f766e',
      GARANTIA: '#be123c',
      LABORATORIO: '#856404'
    };
    return colors[role] || area?.color || '#3498db';
  }

  colorDeUsuario(user: User): string | null {
    if (user.role === 'GM') {
      return null;
    }
    const fromUser = (user.areaColor || '').trim();
    if (fromUser) {
      return fromUser;
    }
    return this.colorDeCodigo(user.areaCodigo || this.codigoBandejaEntrada(user));
  }

  claseBadgeRol(user: User): string {
    if (user.role === 'GM') {
      return 'role-gm';
    }
    const codigo = (user.areaCodigo || user.role || 'user').toLowerCase();
    const known = [
      'admin', 'almacen', 'inventario', 'compras', 'gestion_equip', 'impresion', 'garantia', 'laboratorio'
    ];
    if (known.includes(codigo)) {
      return `role-${codigo}`;
    }
    if (this.colorDeUsuario(user)) {
      return 'role-area';
    }
    return 'role-user';
  }

  private colorDeCodigo(codigo: string | null | undefined): string | null {
    if (!codigo) {
      return null;
    }
    const area = this.todasAreasTicket.find((a) => (a.codigo || '').toUpperCase() === codigo.toUpperCase());
    return (area?.color || '').trim() || null;
  }

  getRolBgColor(role: string): string {
    const colors: Record<string, string> = {
      GM: '#f8d7da',
      ADMIN: '#fff3cd',
      USER: '#e2e8f0',
      ALMACEN: '#dbeafe',
      INVENTARIO: '#d1fae5',
      COMPRAS: '#ffedd5',
      GESTION_EQUIP: '#ede9fe',
      IMPRESION: '#ccfbf1',
      GARANTIA: '#ffe4e6',
      LABORATORIO: '#fff3cd'
    };
    return colors[role] || '#f8f9fa';
  }

  getRolBorderColor(role: string): string {
    const colors: Record<string, string> = {
      GM: '#f5c6cb',
      ADMIN: '#ffeaa7',
      USER: '#cbd5e1',
      ALMACEN: '#93c5fd',
      INVENTARIO: '#6ee7b7',
      COMPRAS: '#fed7aa',
      GESTION_EQUIP: '#c4b5fd',
      IMPRESION: '#5eead4',
      GARANTIA: '#fecdd3',
      LABORATORIO: '#ffeaa7'
    };
    return colors[role] || '#dee2e6';
  }

  getRolIcon(role: string): string {
    const icons: Record<string, string> = {
      GM: 'fa-crown',
      ADMIN: 'fa-user-shield',
      USER: 'fa-user',
      ALMACEN: 'fa-warehouse',
      INVENTARIO: 'fa-boxes',
      COMPRAS: 'fa-shopping-cart',
      GESTION_EQUIP: 'fa-tools',
      IMPRESION: 'fa-print',
      GARANTIA: 'fa-shield-alt',
      LABORATORIO: 'fa-user-shield'
    };
    return icons[role] || 'fa-layer-group';
  }

  isCurrentUser(user: User): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.id === user.id;
  }

  inicialesUsuario(user: User): string {
    const first = (user.firstName || '').trim();
    const last = (user.lastName || '').trim();
    if (first && last) {
      return (first[0] + last[0]).toUpperCase();
    }
    const label = (first || last || user.username || '?').trim();
    return label.slice(0, 2).toUpperCase();
  }

  avatarUrl(user: User): string {
    return this.authService.getAvatarUrl(user.id);
  }

  onAvatarError(user: User): void {
    user.hasAvatar = false;
  }

}
