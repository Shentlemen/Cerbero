import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { User } from '../interfaces/auth.interface';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { UpdateProfileRequest } from '../interfaces/auth.interface';
import { TourRegistryService } from '../services/tour-registry.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NotificationContainerComponent],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit, OnDestroy {
  userForm: FormGroup;
  loading = false;
  uploadingAvatar = false;
  errorMessage = '';
  successMessage = '';
  currentUser: User | null = null;
  isEditing = false;
  private tourCleanup?: () => void;

  get avatarUrl(): string {
    return this.authService.getAvatarUrl();
  }

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router,
    private notificationService: NotificationService,
    private tourRegistry: TourRegistryService
  ) {
    this.userForm = this.fb.group({
      username: [{ value: '', disabled: true }],
      email: ['', [Validators.required, Validators.email]],
      firstName: ['', [Validators.required]],
      lastName: [''],
      /* Sin minLength aquí: vacío = válido; longitud y coincidencia en onSubmit */
      password: [''],
      confirmPassword: [''],
      role: [{ value: '', disabled: true }]
    });
    this.toggleFormFields(false);
  }

  ngOnInit(): void {
    this.loadCurrentUser();
    this.tourCleanup = this.tourRegistry.register('user-profile', [{
      id: 'user-profile-overview',
      title: 'Tour de mi perfil',
      icon: 'fa-route',
      steps: [
        { selector: '#tour-profile-title', title: 'Mi perfil', description: 'Datos de tu cuenta Cerbero: nombre, usuario, correo y foto que ven los demás en la guía de contactos.', side: 'bottom' },
        { selector: '#tour-profile-avatar', title: 'Foto de perfil', description: 'Subí, cambiá o quitá la foto. Si no hay imagen se muestran las iniciales o el ícono de tu rol.', side: 'right' },
        { selector: '#tour-profile-form', title: 'Información personal', description: 'Usuario, correo, nombre y apellido. El rol lo asigna un GM y no se edita desde acá.', side: 'left' },
        { selector: '#tour-profile-edit', title: 'Editar', description: 'Habilitá los campos para guardar cambios. En modo edición también podés cambiar la contraseña.', side: 'left' }
      ]
    }]);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
  }

  loadCurrentUser(): void {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.notificationService.showError(
        'Error de Sesión',
        'No se pudo cargar la información del usuario'
      );
      this.router.navigate(['/login']);
      return;
    }
    this.populateForm();
    this.authService.getCurrentUserProfile().subscribe({
      next: (profile) => {
        const { password: _ignored, ...safe } = profile;
        this.authService.updateCurrentUser({ ...this.currentUser!, ...safe });
        this.currentUser = this.authService.getCurrentUser();
        this.populateForm();
      },
      error: () => {
        /* se mantiene el usuario de sesión */
      }
    });
  }

  populateForm(): void {
    if (this.currentUser) {
      const u = this.currentUser;
      this.userForm.patchValue({
        username: u.username ?? '',
        email: (u.email ?? '').trim(),
        firstName: (u.firstName ?? '').trim(),
        lastName: (u.lastName ?? '').trim(),
        role: this.getRoleLabel(u.role)
      });
    }
  }

  /** Username y rol no se envían; la contraseña es opcional. */
  canSaveChanges(): boolean {
    if (!this.isEditing || this.loading) {
      return false;
    }
    const email = this.userForm.get('email');
    const firstName = this.userForm.get('firstName');
    if (!email || !firstName || email.disabled || firstName.disabled) {
      return false;
    }
    const nombre = String(firstName.value ?? '').trim();
    const correo = String(email.value ?? '').trim();
    return nombre.length > 0 && email.valid && correo.length > 0;
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.toggleFormFields(true);
      this.userForm.patchValue({ password: '', confirmPassword: '' }, { emitEvent: false });
    } else {
      this.toggleFormFields(false);
      this.populateForm();
    }
  }

  onSubmit(): void {
    if (this.canSaveChanges() && this.currentUser) {
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

      if (password && password.trim() !== '' && String(password).length < 6) {
        this.notificationService.showError(
          'Error de Validación',
          'La contraseña debe tener al menos 6 caracteres'
        );
        return;
      }

      this.loading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const updateData: UpdateProfileRequest = {
        email: String(this.userForm.get('email')?.value ?? '').trim(),
        firstName: String(this.userForm.get('firstName')?.value ?? '').trim(),
        lastName: String(this.userForm.get('lastName')?.value ?? '').trim()
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
      ['email', 'firstName'].forEach((key) => {
        this.userForm.get(key)?.markAsTouched();
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
    const keys = ['email', 'firstName', 'lastName', 'password', 'confirmPassword'] as const;
    for (const key of keys) {
      const c = this.userForm.get(key);
      if (!c) {
        continue;
      }
      if (enabled) {
        c.enable({ emitEvent: false });
      } else {
        c.disable({ emitEvent: false });
      }
      c.updateValueAndValidity({ emitEvent: false });
    }
  }

  getRoleLabel(role: string): string {
    if (role === 'GM') return 'Game Master';
    const areaNombre = (this.currentUser?.areaNombre || '').trim();
    if (areaNombre) return areaNombre;
    switch (role) {
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

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const tipos = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
    if (!tipos.includes(file.type)) {
      this.notificationService.showError(
        'Archivo no válido',
        'Solo se aceptan fotos JPG, PNG, GIF o WEBP.'
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.notificationService.showError(
        'Archivo demasiado grande',
        'La foto no puede superar 10 MB.'
      );
      return;
    }
    this.uploadingAvatar = true;
    this.authService.uploadAvatar(file).subscribe({
      next: (user) => {
        this.currentUser = user;
        this.uploadingAvatar = false;
        this.notificationService.showSuccessMessage('Foto de perfil actualizada');
      },
      error: (err) => {
        this.uploadingAvatar = false;
        const msg = this.mensajeErrorAvatar(err, 'No se pudo subir la foto');
        this.notificationService.showError('Error al subir la foto', msg);
      }
    });
  }

  quitarAvatar(): void {
    if (this.uploadingAvatar) {
      return;
    }
    this.uploadingAvatar = true;
    this.authService.deleteAvatar().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.uploadingAvatar = false;
        this.notificationService.showSuccessMessage('Foto de perfil eliminada');
      },
      error: (err) => {
        this.uploadingAvatar = false;
        const msg = this.mensajeErrorAvatar(err, 'No se pudo quitar la foto');
        this.notificationService.showError('Error al quitar la foto', msg);
      }
    });
  }

  onAvatarImgError(): void {
    if (this.currentUser?.hasAvatar) {
      this.currentUser = { ...this.currentUser, hasAvatar: false };
    }
  }

  private mensajeErrorAvatar(err: unknown, fallback: string): string {
    const e = err as {
      status?: number;
      error?: { error?: string; message?: string };
      message?: string;
    };
    const codigo = e?.error?.error;
    const msg = e?.error?.message || e?.message || fallback;
    if (e?.status === 401 || codigo === 'UNAUTHORIZED' || codigo === 'TOKEN_EXPIRED') {
      return 'La sesión no es válida para subir la foto. No te sacamos al login: cerrá sesión y entrá de nuevo, o recargá la página, y reintentá.';
    }
    return msg;
  }

  volver(): void {
    this.router.navigate(['/menu/dashboard']);
  }
} 