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

  /** Nombre visible en el header: mayúsculas, Orbitron en CSS. */
  get displayName(): string {
    const u = this.currentUser;
    if (!u) {
      return '';
    }
    const parts = [u.firstName, u.lastName].filter((p) => (p || '').trim().length > 0);
    const raw = parts.length > 0 ? parts.join(' ') : u.username || '';
    return raw.trim().toLocaleUpperCase('es-UY');
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

  getRoleBadgeClass(role: string): string {
    const key = (role || 'default').toUpperCase();
    const known = [
      'GM',
      'ADMIN',
      'USER',
      'ALMACEN',
      'INVENTARIO',
      'COMPRAS',
      'GESTION_EQUIP',
      'IMPRESION',
      'GARANTIA'
    ];
    return known.includes(key) ? `role-badge--${key.toLowerCase()}` : 'role-badge--default';
  }

  getRoleIcon(role: string): string {
    switch ((role || '').toUpperCase()) {
      case 'GM':
        return 'fa-crown';
      case 'ADMIN':
        return 'fa-user-shield';
      case 'USER':
        return 'fa-user';
      case 'ALMACEN':
        return 'fa-warehouse';
      case 'INVENTARIO':
        return 'fa-boxes-stacked';
      case 'COMPRAS':
        return 'fa-cart-shopping';
      case 'GESTION_EQUIP':
        return 'fa-laptop-code';
      case 'IMPRESION':
        return 'fa-print';
      case 'GARANTIA':
        return 'fa-screwdriver-wrench';
      default:
        return 'fa-id-badge';
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
