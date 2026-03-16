import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../services/auth.service';
import { User, CreateUserRequest, UpdateUserRequest } from '../interfaces/auth.interface';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule, NotificationContainerComponent],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
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

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private notificationService: NotificationService
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
      role: ['USER', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.loadUsers();
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
    this.editingUser = null;
    this.showForm = true;
    
    // Configurar el formulario para creación
    this.userForm.reset();
    this.userForm.patchValue({
      role: 'USER' // Valor por defecto
    });
    
    // Habilitar el campo username para creación
    this.userForm.get('username')?.enable();
    
    // Hacer el campo password requerido en creación
    this.userForm.get('password')?.setValidators([Validators.required]);
    this.userForm.get('password')?.updateValueAndValidity();
  }

  showEditForm(user: User): void {
    this.editingUser = user;
    this.showForm = true;
    
    // Configurar el formulario para edición
    this.userForm.patchValue({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      password: '' // Dejar vacío para edición
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
  }

  onSubmit(): void {
    if (this.userForm.valid) {
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
        const updateData: any = {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          enabled: true
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
            this.errorMessage = 'Error al actualizar usuario: ' + error.message;
            this.notificationService.showError(
              'Error al Actualizar Usuario',
              'No se pudo actualizar el usuario: ' + error.message
            );
            this.loading = false;
          }
        });
      } else {
        // Crear nuevo usuario
        this.authService.createUser(userData).subscribe({
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
            this.errorMessage = 'Error al crear usuario: ' + error.message;
            this.notificationService.showError(
              'Error al Crear Usuario',
              'No se pudo crear el usuario: ' + error.message
            );
            this.loading = false;
          }
        });
      }
    } else {
      // Marcar todos los campos como touched para mostrar los errores
      Object.keys(this.userForm.controls).forEach(key => {
        const control = this.userForm.get(key);
        control?.markAsTouched();
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
         `${user.lastName || ''} ${user.firstName || ''}`.toLowerCase().includes(search));
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