import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionsService } from '../services/permissions.service';

/**
 * Protege rutas por matriz de permisos y, si no hay permission, por rol efectivo.
 * GM (rol efectivo, sin simulación) pasa cualquier chequeo de permiso vía PermissionsService.can().
 *
 * data.permission + data.action?: un componente (ver/editar/eliminar)
 * data.anyPermissions?: al menos un componente con ver
 * data.gmOnly: solo GM efectivo
 * data.roles / data.role: fallback histórico
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

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (!this.authService.isAuthenticated()) {
      return this.router.createUrlTree(['/login']);
    }

    if (route.data['gmOnly'] === true) {
      if (this.permissionsService.isGM()) {
        return true;
      }
      return this.router.createUrlTree(['/menu/dashboard']);
    }

    const permission = route.data['permission'] as string | undefined;
    const action = (route.data['action'] as 'ver' | 'editar' | 'eliminar' | undefined) || 'ver';
    if (permission) {
      if (this.permissionsService.can(permission, action)) {
        return true;
      }
      return this.router.createUrlTree(['/menu/dashboard']);
    }

    const anyPermissions = route.data['anyPermissions'] as string[] | undefined;
    if (anyPermissions?.length) {
      const ok = anyPermissions.some((p) => this.permissionsService.can(p, 'ver'))
        || this.permissionsService.isGM();
      if (ok) {
        return true;
      }
      return this.router.createUrlTree(['/menu/dashboard']);
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

    if (legacyRole === 'ADMIN' && this.permissionsService.isGMOrAdmin()) {
      return true;
    }

    return this.router.createUrlTree(['/menu/dashboard']);
  }
}
