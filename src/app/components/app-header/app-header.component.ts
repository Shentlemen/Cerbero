import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/auth.interface';
import { PermissionsService } from '../../services/permissions.service';
import { ThemeService } from '../../services/theme.service';
import { TicketAreaDTO, TicketAreaService } from '../../services/ticket-area.service';

interface ViewAsOption {
  value: string;
  label: string;
  areaId?: number;
}

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './app-header.component.html',
    styleUrls: ['./app-header.component.css']
})
export class AppHeaderComponent implements OnInit, OnDestroy {
  @ViewChild('userMenu') userMenu?: ElementRef<HTMLElement>;

  currentUser: User | null = null;
  isRealGm = false;
  effectiveRole = '';
  viewAsSelectValue = '';
  showPreviewBar = false;
  previewRole = '';
  menuOpen = false;
  viewAsOpen = false;
  viewAsOptions: ViewAsOption[] = [{ value: '', label: 'Game Master' }];

  private areas: TicketAreaDTO[] = [];
  private areasSub?: Subscription;

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

  get hasAvatar(): boolean {
    return !!this.currentUser?.hasAvatar;
  }

  get avatarUrl(): string {
    return this.authService.getAvatarUrl();
  }

  get headerInitials(): string {
    const u = this.currentUser;
    if (!u) {
      return '?';
    }
    const first = (u.firstName || '').trim();
    const last = (u.lastName || '').trim();
    if (first && last) {
      return (first[0] + last[0]).toUpperCase();
    }
    const label = (first || last || u.username || '?').trim();
    return label.slice(0, 2).toUpperCase();
  }

  constructor(
    private authService: AuthService,
    private router: Router,
    private permissionsService: PermissionsService,
    private ticketAreaService: TicketAreaService,
    public theme: ThemeService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      this.syncFromPermissions();
      if (this.permissionsService.isRealGM()) {
        this.cargarAreasParaViewAs();
      }
    });
    this.permissionsService.viewAs$.subscribe(() => this.syncFromPermissions());
  }

  ngOnDestroy(): void {
    this.areasSub?.unsubscribe();
  }

  private cargarAreasParaViewAs(): void {
    this.areasSub?.unsubscribe();
    this.areasSub = this.ticketAreaService.listarTodasAdmin().subscribe({
      next: (areas) => {
        this.areas = areas;
        this.viewAsOptions = [
          { value: '', label: 'Game Master' },
          ...areas.map((a) => ({
            value: (a.codigo || '').toUpperCase(),
            label: a.activa === false ? `${a.nombre} (inactiva)` : a.nombre,
            areaId: a.id
          }))
        ];
        this.syncFromPermissions();
        this.restaurarPermisosViewAsSiFaltan();
      },
      error: () => {
        this.viewAsOptions = [{ value: '', label: 'Game Master' }];
      }
    });
  }

  private restaurarPermisosViewAsSiFaltan(): void {
    const codigo = this.permissionsService.getViewAsRole();
    if (!codigo || this.permissionsService.hasViewAsPermisos()) {
      return;
    }
    const area = this.areas.find((a) => (a.codigo || '').toUpperCase() === codigo);
    if (!area) {
      return;
    }
    this.aplicarViewAs(area.codigo, area.id);
  }

  private syncFromPermissions(): void {
    this.isRealGm = this.permissionsService.isRealGM();
    this.effectiveRole = this.permissionsService.getEffectiveRole() || '';
    this.previewRole = this.permissionsService.getViewAsRole() || '';
    this.viewAsSelectValue = this.previewRole;
    this.showPreviewBar = this.permissionsService.isGmPreviewActive();
  }

  toggleMenu(event?: Event): void {
    event?.stopPropagation();
    this.menuOpen = !this.menuOpen;
    if (!this.menuOpen) {
      this.viewAsOpen = false;
    }
  }

  closeMenu(): void {
    this.menuOpen = false;
    this.viewAsOpen = false;
  }

  openViewAsPanel(): void {
    this.viewAsOpen = true;
  }

  closeViewAsPanel(): void {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      this.viewAsOpen = false;
    }
  }

  toggleViewAsPanel(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.viewAsOpen = !this.viewAsOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen) {
      return;
    }
    const root = this.userMenu?.nativeElement;
    if (root && !root.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }

  onViewAsChange(option: ViewAsOption): void {
    if (!option.value) {
      this.permissionsService.setViewAsRole(null);
      this.closeMenu();
      return;
    }
    this.aplicarViewAs(option.value, option.areaId ?? null, true);
    this.closeMenu();
  }

  private aplicarViewAs(codigo: string, areaId: number | null | undefined, navegarADashboard = false): void {
    if (!areaId) {
      this.permissionsService.setViewAsRole(codigo);
      if (navegarADashboard) {
        void this.router.navigate(['/menu/dashboard']);
      }
      return;
    }
    this.ticketAreaService.listarPermisos(areaId).subscribe({
      next: (permisos) => {
        this.permissionsService.setViewAsRole(
          codigo,
          permisos.map((p) => ({
            componente: p.componente,
            puedeVer: p.puedeVer,
            puedeEditar: p.puedeEditar,
            puedeEliminar: p.puedeEliminar
          })),
          areaId
        );
        if (navegarADashboard) {
          void this.router.navigate(['/menu/dashboard']);
        }
      },
      error: () => {
        this.permissionsService.setViewAsRole(codigo, undefined, areaId);
        if (navegarADashboard) {
          void this.router.navigate(['/menu/dashboard']);
        }
      }
    });
  }

  clearPreview(): void {
    this.permissionsService.setViewAsRole(null);
    this.viewAsSelectValue = '';
  }

  getRoleLabel(role: string): string {
    const key = (role || '').toUpperCase();
    const fromArea = this.viewAsOptions.find((o) => o.value === key);
    if (fromArea?.label) {
      return fromArea.label.replace(/ \(inactiva\)$/, '');
    }
    const areaNombre = (this.currentUser?.areaNombre || '').trim();
    const areaCodigo = (this.currentUser?.areaCodigo || '').trim().toUpperCase();
    if (areaNombre && !this.previewRole && (key === 'USER' || key === areaCodigo)) {
      return areaNombre;
    }
    switch (key) {
      case 'GM':
      case '':
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
      case 'LABORATORIO':
        return 'Laboratorio';
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
      'GARANTIA',
      'LABORATORIO'
    ];
    return known.includes(key) ? `role-badge--${key.toLowerCase()}` : 'role-badge--default';
  }

  getRoleIcon(role: string): string {
    switch ((role || '').toUpperCase()) {
      case 'GM':
      case '':
        return 'fa-crown';
      case 'ADMIN':
      case 'LABORATORIO':
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

  toggleTheme(): void {
    this.theme.toggle();
  }

  logout(): void {
    this.closeMenu();
    this.authService.logout();
    window.location.href = '/#/login';
  }

  goToProfile(): void {
    this.closeMenu();
    this.router.navigate(['/menu/user-profile']);
  }

  onAvatarError(): void {
    if (this.currentUser?.hasAvatar) {
      this.currentUser = { ...this.currentUser, hasAvatar: false };
    }
  }
}
