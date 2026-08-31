import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionsService } from '../services/permissions.service';

/**
 * Protege rutas por rol efectivo (respeta «Ver como» del GM).
 * Usar data.roles: string[] — al menos uno debe coincidir con getEffectiveRole().
 */
@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private permissionsService: PermissionsService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return false;
    }

    const roles = route.data['roles'] as string[] | undefined;
    const legacyRole = route.data['role'] as string | undefined;

    const required = roles?.length
      ? roles.map(r => r.toUpperCase())
      : legacyRole
        ? [legacyRole.toUpperCase()]
        : [];

    if (required.length === 0) {
      return true;
    }

    const effective = (this.permissionsService.getEffectiveRole() || '').toUpperCase();
    if (required.includes(effective)) {
      return true;
    }

    // Compat: data.role === 'ADMIN' también aceptaba GM (isGMOrAdmin)
    if (legacyRole === 'ADMIN' && this.permissionsService.isGMOrAdmin()) {
      return true;
    }

    this.router.navigate(['/menu/dashboard']);
    return false;
  }
}
