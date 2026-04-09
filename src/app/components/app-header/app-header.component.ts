import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/auth.interface';
import { PermissionsService } from '../../services/permissions.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app-header.component.html',
  styleUrls: ['./app-header.component.css']
})
export class AppHeaderComponent implements OnInit {
  currentUser: User | null = null;
  isRealGm = false;
  effectiveRole = '';
  viewAsSelectValue = '';
  showPreviewBar = false;
  previewRole = '';

  readonly viewAsOptions: { value: string; label: string }[] = [
    { value: '', label: 'GM (normal)' },
    { value: 'USER', label: 'Usuario' },
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'ALMACEN', label: 'Almacén' },
    { value: 'INVENTARIO', label: 'Inventario' },
    { value: 'COMPRAS', label: 'Compras' },
    { value: 'GESTION_EQUIP', label: 'Gestión equipos' },
    { value: 'IMPRESION', label: 'Impresión' },
    { value: 'GARANTIA', label: 'Garantía' }
  ];

  get roleBadgeTitle(): string {
    if (this.isRealGm && this.previewRole) {
      return 'Vista simulada; sesión real: Game Master';
    }
    return '';
  }

  constructor(
    private authService: AuthService,
    private router: Router,
    private permissionsService: PermissionsService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      this.syncFromPermissions();
    });
    this.permissionsService.viewAs$.subscribe(() => this.syncFromPermissions());
  }

  private syncFromPermissions(): void {
    this.isRealGm = this.permissionsService.isRealGM();
    this.effectiveRole = this.permissionsService.getEffectiveRole() || '';
    this.previewRole = this.permissionsService.getViewAsRole() || '';
    this.viewAsSelectValue = this.previewRole;
    this.showPreviewBar = this.permissionsService.isGmPreviewActive();
  }

  onViewAsChange(value: string): void {
    this.permissionsService.setViewAsRole(value || null);
  }

  clearPreview(): void {
    this.permissionsService.setViewAsRole(null);
    this.viewAsSelectValue = '';
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'GM':
        return 'Game Master';
      case 'ADMIN':
        return 'Administrador';
      case 'USER':
        return 'Usuario';
      case 'ALMACEN':
        return 'Almacén';
      case 'INVENTARIO':
        return 'Inventario';
      case 'COMPRAS':
        return 'Compras';
      case 'GESTION_EQUIP':
        return 'Gestión equipos';
      case 'IMPRESION':
        return 'Impresión';
      case 'GARANTIA':
        return 'Garantía';
      default:
        return role || '-';
    }
  }

  getRoleClass(role: string): string {
    switch (role) {
      case 'GM':
        return 'bg-danger';
      case 'ADMIN':
        return 'bg-warning text-dark';
      case 'USER':
        return 'bg-secondary';
      default:
        return 'bg-info text-dark';
    }
  }

  logout(): void {
    this.authService.logout();
    window.location.href = '/#/login';
  }

  goToProfile(): void {
    this.router.navigate(['/user-profile']);
  }
}
