import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    // Verificar si el usuario está autenticado
    if (!this.authService.isAuthenticated()) {
      console.log('🔄 Usuario no autenticado - redirigiendo al login');
      this.authService.clearSession();
      this.router.navigate(['/login']);
      return false;
    }

    // Verificar si el token está expirado
    if (this.authService.isTokenExpired()) {
      console.log('🔄 Token expirado detectado en guard - limpiando sesión');
      this.authService.clearSession();
      this.router.navigate(['/login']);
      return false;
    }

    // Verificar si el token está próximo a expirar
    if (this.authService.isTokenExpiringSoon()) {
      console.log('🔄 Token próximo a expirar - intentando renovar...');
      // Intentar renovar el token automáticamente
      this.authService.refreshToken().subscribe({
        next: () => {
          console.log('✅ Token renovado automáticamente');
        },
        error: (error) => {
          console.error('❌ Error renovando token:', error);
          this.authService.clearSession();
          this.router.navigate(['/login']);
        }
      });
    }

    return true;
  }
} 