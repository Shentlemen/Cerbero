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

  // Diálogos de confirmación
  showDeleteDialog = false;
  userToDelete: User | null = null;
  showEstadoDialog = false;
  userToToggle: User | null = null;
  private tourCleanup?: () => void;

  /** Validación cliente y errores API dentro del modal usuario (mismo criterio que compras/proveedores). */
  usuarioModalValidacion: { titulo: string; lineas: string[]; esError: boolean } | null = null;

  roles = [
    { value: 'USER', label: 'Usuario' },
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'GM', label: 'Game Master' },
    { value: 'ALMACEN', label: 'Almacén' },
    { value: 'INVENTARIO', label: 'Inventario' },
    { value: 'COMPRAS', label: 'Compras' },
    { value: 'GESTION_EQUIP', label: 'Gestión de Equipos' },
    { value: 'IMPRESION', label: 'Impresión' },
    { value: 'GARANTIA', label: 'Garantía' }
  ];

  /** Bandejas asignables a usuarios rol USER (formulario). */
  bandejasUsuario: TicketAreaDTO[] = [];
  /** Catálogo completo para mostrar nombres en la tabla. */
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
      role: ['USER', [Validators.required]],
      ticketAreaCodigo: ['']
    });

    this.userForm.valueChanges.subscribe(() => this.limpiarFeedbackUsuarioModal());
  }

  limpiarFeedbackUsuarioModal(): void {
    this.usuarioModalValidacion = null;
  }

  showTicketAreaField(): boolean {
    return this.userForm.get('role')?.value === 'USER';
  }

  getBandejaLabel(codigo: string | null | undefined): string {
    if (!codigo) return '—';
    const b = this.todasAreasTicket.find((x) => x.codigo === codigo)
      ?? this.bandejasUsuario.find((x) => x.codigo === codigo);
    return b ? b.nombre : codigo;
  }

  /** Bandeja de tickets que atiende cada usuario en la lista. */
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

  getBandejaEntradaCodigo(user: User): string | null {
    return this.codigoBandejaEntrada(user);
  }

  private codigoBandejaEntrada(user: User): string | null {
    if (user.role === 'USER') {
      const c = user.ticketAreaCodigo?.trim();
      return c ? c.toUpperCase() : null;
    }
    if (user.role === 'GM') {
      return null;
    }
    if (user.role === 'ADMIN') {
      return 'LABORATORIO';
    }
    const tiRoles = ['ALMACEN', 'INVENTARIO', 'COMPRAS', 'GESTION_EQUIP', 'IMPRESION', 'GARANTIA'];
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
    return 'bandeja-ose';
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
    if (f.get('role')?.hasError('required')) {
      lineas.push('Seleccioná un rol.');
    }
    return lineas;
  }

  ngOnInit(): void {
    this.loadUsers();
    this.ticketAreaService.listarAsignables().subscribe({
      next: (list) => { this.bandejasUsuario = list; }
    });
    this.ticketAreaService.listarTodasAdmin().subscribe({
      next: (list) => { this.todasAreasTicket = list; }
    });
    this.tourCleanup = this.tourRegistry.register('user-management', [{
      id: 'user-management-overview',
      title: 'Tour de usuarios Cerbero',
      icon: 'fa-route',
      steps: [
        { selector: '#tour-users-title', title: 'Usuarios Cerbero', description: 'Alta, edición y desactivación de cuentas con roles funcionales (almacén, compras, GM, etc.).', side: 'bottom' },
        { selector: '#tour-users-nuevo', title: 'Nuevo usuario', description: 'Abre el formulario en pantalla con usuario, correo, nombre y asignación de rol.', side: 'left' },
        { selector: '#tour-users-filters', title: 'Filtros', description: 'Búsqueda libre y recortes por estado o rol para encontrar cuentas rápido.', side: 'bottom' },
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
    
    // Configurar el formulario para creación
    this.userForm.reset();
    this.userForm.patchValue({
      role: 'USER',
      ticketAreaCodigo: ''
    });
    
    // Habilitar el campo username para creación
    this.userForm.get('username')?.enable();
    
    // Hacer el campo password requerido en creación
    this.userForm.get('password')?.setValidators([Validators.required]);
    this.userForm.get('password')?.updateValueAndValidity();
  }

  showEditForm(user: User): void {
    this.usuarioModalValidacion = null;
    this.editingUser = user;
    this.showForm = true;
    
    // Configurar el formulario para edición
    this.userForm.patchValue({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      ticketAreaCodigo: user.ticketAreaCodigo ?? '',
      password: ''
    });
    
    // Hacer el campo username readonly en edición
    this.userForm.get('username')?.disable();
    
    // Hacer el campo password opcional en edición
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

      // Habilitar temporalmente el campo username para obtener su valor
      const usernameControl = this.userForm.get('username');
      const wasUsernameDisabled = usernameControl?.disabled;
      if (wasUsernameDisabled) {
        usernameControl?.enable();
      }
      
      const userData: CreateUserRequest = this.userForm.value;
      
      // Deshabilitar nuevamente el campo username si estaba deshabilitado
      if (wasUsernameDisabled) {
        usernameControl?.disable();
      }
      
      if (this.editingUser) {
        // Actualizar usuario existente
        const updateData: UpdateUserRequest = {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          enabled: this.editingUser.enabled,
          ticketAreaCodigo: userData.role === 'USER' ? (userData.ticketAreaCodigo || null) : null
        };
        
        // Incluir contraseña solo si se proporciona
        if (userData.password && userData.password.trim() !== '') {
          updateData.password = userData.password;
        }
        
        this.authService.updateUser(this.editingUser.id, updateData).subscribe({
          next: (updatedUser) => {
            this.successMessage = 'Usuario actualizado exitosamente';
            this.notificationService.showSuccessMessage('Usuario actualizado exitosamente');
            this.loadUsers();
            
            // Cerrar el modal después de un pequeño delay para que vea el mensaje
            setTimeout(() => {
              this.cancelForm();
            }, 1000);
            
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
          ...userData,
          ticketAreaCodigo: userData.role === 'USER' ? (userData.ticketAreaCodigo || null) : null
        };
        this.authService.createUser(createPayload).subscribe({
          next: (newUser) => {
            this.successMessage = 'Usuario creado exitosamente';
            this.notificationService.showSuccessMessage('Usuario creado exitosamente');
            this.loadUsers();
            
            // Cerrar el modal después de un pequeño delay para que vea el mensaje
            setTimeout(() => {
              this.cancelForm();
            }, 1000);
            
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
      enabled: nuevoEstado
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

  getRoleLabel(role: string): string {
    const roleObj = this.roles.find(r => r.value === role);
    return roleObj ? roleObj.label : role;
  }

  get usersFiltrados(): User[] {
    const search = (this.filterForm.get('search')?.value || '').toLowerCase().trim();
    return this.users.filter(user => {
      const matchSearch = !search ||
        (user.username?.toLowerCase().includes(search) ||
         user.email?.toLowerCase().includes(search) ||
         user.firstName?.toLowerCase().includes(search) ||
         user.lastName?.toLowerCase().includes(search) ||
         `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(search) ||
         `${user.lastName || ''} ${user.firstName || ''}`.toLowerCase().includes(search) ||
         this.getBandejaEntrada(user).toLowerCase().includes(search) ||
         (this.getBandejaEntradaCodigo(user)?.toLowerCase().includes(search) ?? false));
      const matchEstado = this.filtroEstado === 'todos' ||
        (this.filtroEstado === 'activo' && user.enabled) ||
        (this.filtroEstado === 'inactivo' && !user.enabled);
      const matchRol = this.filtroRol === 'todos' || user.role === this.filtroRol;
      return matchSearch && matchEstado && matchRol;
    });
  }

  setFiltroEstado(estado: 'todos' | 'activo' | 'inactivo'): void {
    this.filtroEstado = estado;
  }

  setFiltroRol(rol: 'todos' | string): void {
    this.filtroRol = rol;
  }

  getActivosCount(): number {
    return this.users.filter(u => u.enabled).length;
  }

  getInactivosCount(): number {
    return this.users.filter(u => !u.enabled).length;
  }

  getRolCount(role: string): number {
    return this.users.filter(u => u.role === role).length;
  }

  getRolColor(role: string): string {
    const colors: Record<string, string> = {
      GM: '#721c24',
      ADMIN: '#856404',
      USER: '#2c3e50',
      ALMACEN: '#1d4ed8',       // Azul fuerte
      INVENTARIO: '#059669',    // Verde
      COMPRAS: '#b45309',       // Naranja/marrón
      GESTION_EQUIP: '#7c3aed', // Violeta
      IMPRESION: '#0f766e',     // Verde azulado
      GARANTIA: '#be123c'       // Rojo magenta
    };
    return colors[role] || '#6c757d';
  }

  getRolBgColor(role: string): string {
    const colors: Record<string, string> = {
      GM: '#f8d7da',
      ADMIN: '#fff3cd',
      USER: '#e2e8f0',
      ALMACEN: '#dbeafe',        // Azul muy claro
      INVENTARIO: '#d1fae5',     // Verde muy claro
      COMPRAS: '#ffedd5',        // Naranja claro
      GESTION_EQUIP: '#ede9fe',  // Violeta claro
      IMPRESION: '#ccfbf1',      // Verde agua claro
      GARANTIA: '#ffe4e6'        // Rosado claro
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
      GARANTIA: '#fecdd3'
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
      GARANTIA: 'fa-shield-alt'
    };
    return icons[role] || 'fa-user';
  }

  isCurrentUser(user: User): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.id === user.id;
  }

} 