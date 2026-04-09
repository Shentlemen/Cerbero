import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionsService } from '../services/permissions.service';

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
    const requiredRole = route.data['role'];
    
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return false;
    }

    if (requiredRole === 'GM' && !this.permissionsService.isGM()) {
      this.router.navigate(['/dashboard']);
      return false;
    }

    if (requiredRole === 'ADMIN' && !this.permissionsService.isGMOrAdmin()) {
      this.router.navigate(['/dashboard']);
      return false;
    }

    return true;
  }
} 