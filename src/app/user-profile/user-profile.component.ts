import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { User } from '../interfaces/auth.interface';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { UpdateProfileRequest } from '../interfaces/auth.interface';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NotificationContainerComponent],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit {
  userForm: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';
  currentUser: User | null = null;
  isEditing = false;

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router,
    private notificationService: NotificationService
  ) {
    this.userForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      password: ['', [Validators.minLength(6)]], // Opcional para cambios
      confirmPassword: ['', [Validators.minLength(6)]], // Opcional para cambios
      role: [{ value: '', disabled: true }] // Rol deshabilitado
    });
  }

  ngOnInit(): void {
    this.loadCurrentUser();
  }

  loadCurrentUser(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser) {
      this.populateForm();
    } else {
      this.notificationService.showError(
        'Error de Sesión',
        'No se pudo cargar la información del usuario'
      );
      this.router.navigate(['/login']);
    }
  }

  populateForm(): void {
    if (this.currentUser) {
      this.userForm.patchValue({
        username: this.currentUser.username,
        email: this.currentUser.email,
        firstName: this.currentUser.firstName,
        lastName: this.currentUser.lastName,
        role: this.currentUser.role
      });
    }
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.userForm.get('username')?.enable();
      this.userForm.get('email')?.enable();
      this.userForm.get('firstName')?.enable();
      this.userForm.get('lastName')?.enable();
      this.userForm.get('password')?.enable();
      this.userForm.get('confirmPassword')?.enable();
    } else {
      this.userForm.get('username')?.disable();
      this.userForm.get('email')?.disable();
      this.userForm.get('firstName')?.disable();
      this.userForm.get('lastName')?.disable();
      this.userForm.get('password')?.disable();
      this.userForm.get('confirmPassword')?.disable();
      this.populateForm(); // Restaurar valores originales
    }
  }

  onSubmit(): void {
    if (this.userForm.valid && this.currentUser) {
      // Validar que las contraseñas coincidan si se proporcionan
      const password = this.userForm.get('password')?.value;
      const confirmPassword = this.userForm.get('confirmPassword')?.value;
      
      if (password && password !== confirmPassword) {
        this.notificationService.showError(
          'Error de Validación',
          'Las contraseñas no coinciden'
        );
        return;
      }

      this.loading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const updateData: UpdateProfileRequest = {
        email: this.userForm.get('email')?.value,
        firstName: this.userForm.get('firstName')?.value,
        lastName: this.userForm.get('lastName')?.value
      };

      // Incluir contraseña solo si se proporciona
      if (password && password.trim() !== '') {
        updateData.password = password;
      }

      this.authService.updateProfile(updateData).subscribe({
        next: (updatedUser) => {
          this.successMessage = 'Perfil actualizado exitosamente';
          this.notificationService.showSuccessMessage('Perfil actualizado exitosamente');
          
          // Actualizar el usuario actual en el servicio
          this.authService.updateCurrentUser(updatedUser);
          this.currentUser = updatedUser;
          
          this.isEditing = false;
          this.toggleFormFields(false);
          this.loading = false;
        },
        error: (error) => {
          this.errorMessage = 'Error al actualizar perfil: ' + error.message;
          this.notificationService.showError(
            'Error al Actualizar Perfil',
            'No se pudo actualizar el perfil: ' + error.message
          );
          this.loading = false;
        }
      });
    } else {
      // Marcar todos los campos como touched para mostrar los errores
      Object.keys(this.userForm.controls).forEach(key => {
        const control = this.userForm.get(key);
        if (control && !control.disabled) {
          control.markAsTouched();
        }
      });
    }
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.toggleFormFields(false);
    this.populateForm(); // Restaurar valores originales
    this.errorMessage = '';
    this.successMessage = '';
  }

  private toggleFormFields(enabled: boolean): void {
    if (enabled) {
      this.userForm.get('username')?.enable();
      this.userForm.get('email')?.enable();
      this.userForm.get('firstName')?.enable();
      this.userForm.get('lastName')?.enable();
      this.userForm.get('password')?.enable();
      this.userForm.get('confirmPassword')?.enable();
    } else {
      this.userForm.get('username')?.disable();
      this.userForm.get('email')?.disable();
      this.userForm.get('firstName')?.disable();
      this.userForm.get('lastName')?.disable();
      this.userForm.get('password')?.disable();
      this.userForm.get('confirmPassword')?.disable();
    }
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'GM': return 'Game Master';
      case 'ADMIN': return 'Administrador';
      case 'USER': return 'Usuario';
      default: return role;
    }
  }

  getRoleIcon(role: string): string {
    switch (role) {
      case 'GM': return 'fas fa-crown';
      case 'ADMIN': return 'fas fa-shield-alt';
      case 'USER': return 'fas fa-user';
      default: return 'fas fa-user-circle';
    }
  }

  volver(): void {
    this.router.navigate(['/menu/dashboard']);
  }
} 