import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from '../services/auth.service';
import { User, CreateUserRequest } from '../interfaces/auth.interface';
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
  loading = false;
  errorMessage = '';
  successMessage = '';
  showForm = false;
  editingUser: User | null = null;

  roles = [
    { value: 'USER', label: 'Usuario' },
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'GM', label: 'Game Master' }
  ];

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private notificationService: NotificationService
  ) {
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

  deleteUser(user: User): void {
    if (confirm(`¿Está seguro de que desea eliminar al usuario ${user.username}?`)) {
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
        }
      });
    }
  }

  getRoleLabel(role: string): string {
    const roleObj = this.roles.find(r => r.value === role);
    return roleObj ? roleObj.label : role;
  }

  isCurrentUser(user: User): boolean {
    const currentUser = this.authService.getCurrentUser();
    return currentUser?.id === user.id;
  }
} 