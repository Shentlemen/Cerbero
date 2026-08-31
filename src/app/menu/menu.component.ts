import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { HelperDogComponent } from '../components/helper-dog/helper-dog.component';
import { UserHeaderComponent } from '../components/user-header/user-header.component';
import { AppHeaderComponent } from '../components/app-header/app-header.component';
import { AuthService } from '../services/auth.service';
import { User } from '../interfaces/auth.interface';
import { PermissionsService } from '../services/permissions.service';
import { getDefaultVersionInfo } from '../version';
import { VersionService } from '../services/version.service';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    HelperDogComponent,
    UserHeaderComponent,
    AppHeaderComponent
  ],
  host: {
    '[class.theme-dark]': 'isDark()'
  },
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit, OnDestroy {
  readonly isDark = inject(ThemeService).isDark;
  /** Top del layout bajo el header (48px o 48px + franja vista previa GM). */
  layoutTopPx = 48;
  private layoutSub?: Subscription;

  isAssetsExpanded: boolean = false;
  isAlmacenExpanded: boolean = false;
  isAdminExpanded: boolean = false;
  isAdquisicionesExpanded: boolean = false;
  currentUser: User | null = null;
  versionInfo = getDefaultVersionInfo();
  private routerSubscription: Subscription;

  // Arrays con las rutas específicas de cada sección
  private assetsRoutes = ['/menu/assets', '/menu/devices', '/menu/subnets'];
  private adminRoutes = [
    '/menu/settings',
    '/menu/user-management'
  ];
  private adquisicionesRoutes = [
    '/menu/procurement/compras',
    '/menu/procurement/proveedores',
    // '/menu/procurement/servicios-garantia'
  ];
  private ticketsRoutes = [
    '/menu/tickets'
  ];
  private almacenRoutes = [
    '/menu/almacen/almacenes',
    '/menu/almacen/stock',
    '/menu/almacen/config',
    '/menu/almacen/configuracion',
    '/menu/almacen/configuracion/planta',
    '/menu/almacen/3d-demo',
    '/menu/cementerio',
    '/menu/almacen-laboratorio'
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private permissionsService: PermissionsService,
    private versionService: VersionService
  ) {
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.url;
      
      // Verificar si la ruta actual pertenece a alguna sección
      const isAssetsRoute = this.assetsRoutes.some(route => url.startsWith(route));
      const isAlmacenRoute = this.almacenRoutes.some(route => url.startsWith(route));
      const isAdminRoute = this.adminRoutes.some(route => url.startsWith(route));
      const isAdquisicionesRoute = this.adquisicionesRoutes.some(route => url.startsWith(route));
      const isTicketsRoute = this.ticketsRoutes.some(route => url.startsWith(route));

      // Actualizar estados de los submenús
      if (isAssetsRoute) {
        this.isAssetsExpanded = true;
        this.isAlmacenExpanded = false;
        this.isAdminExpanded = false;
        this.isAdquisicionesExpanded = false;
      } else if (isAlmacenRoute) {
        this.isAlmacenExpanded = true;
        this.isAssetsExpanded = false;
        this.isAdminExpanded = false;
        this.isAdquisicionesExpanded = false;
      } else if (isAdminRoute) {
        this.isAdminExpanded = true;
        this.isAssetsExpanded = false;
        this.isAlmacenExpanded = false;
        this.isAdquisicionesExpanded = false;
      } else if (isAdquisicionesRoute) {
        this.isAdquisicionesExpanded = true;
        this.isAssetsExpanded = false;
        this.isAlmacenExpanded = false;
        this.isAdminExpanded = false;
      } else if (isTicketsRoute) {
        this.isAssetsExpanded = false;
        this.isAlmacenExpanded = false;
        this.isAdminExpanded = false;
        this.isAdquisicionesExpanded = false;
      } else {
        this.isAssetsExpanded = false;
        this.isAlmacenExpanded = false;
        this.isAdminExpanded = false;
        this.isAdquisicionesExpanded = false;
      }

      // Siempre hacer scroll al top al cambiar de ruta
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  ngOnInit() {
    this.versionService.getVersionInfo().subscribe((versionInfo) => {
      this.versionInfo = versionInfo;
    });

    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.updateLayoutTop();
    });
    this.layoutSub = this.permissionsService.viewAs$.subscribe(() => this.updateLayoutTop());
    this.updateLayoutTop();
  }

  private updateLayoutTop(): void {
    const mainRow = 48;
    const previewStrip = this.permissionsService.isGmPreviewActive() ? 42 : 0;
    this.layoutTopPx = mainRow + previewStrip;
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    this.layoutSub?.unsubscribe();
  }

  toggleAssetsMenu(): void {
    this.isAssetsExpanded = !this.isAssetsExpanded;
    if (this.isAssetsExpanded) {
      this.isAlmacenExpanded = false;
      this.isAdquisicionesExpanded = false;
    }
  }

  toggleAlmacenMenu(): void {
    this.isAlmacenExpanded = !this.isAlmacenExpanded;
    if (this.isAlmacenExpanded) {
      this.isAssetsExpanded = false;
      this.isAdquisicionesExpanded = false;
    }
  }

  toggleAdminMenu(): void {
    this.isAdminExpanded = !this.isAdminExpanded;
    if (this.isAdminExpanded) {
      this.isAssetsExpanded = false;
      this.isAlmacenExpanded = false;
      this.isAdquisicionesExpanded = false;
    }
  }

  toggleAdquisicionesMenu(): void {
    this.isAdquisicionesExpanded = !this.isAdquisicionesExpanded;
    if (this.isAdquisicionesExpanded) {
      this.isAssetsExpanded = false;
      this.isAlmacenExpanded = false;
      this.isAdminExpanded = false;
    }
  }

  isGM(): boolean {
    return this.permissionsService.isGM();
  }

  canManageSubnets(): boolean {
    return this.permissionsService.canManageSubnets();
  }

  /**
   * Hub de Configuración: GM / Admin (todas las pestañas) e INVENTARIO
   * (ubicaciones, tipos de activo y responsables). El rol ALMACEN usa
   * «Configuración de almacén» dentro del menú Almacén.
   */
  canShowConfigurationMenu(): boolean {
    return this.permissionsService.canAccessLocationsConfiguration();
  }

  canAccessWarehouseConfiguration(): boolean {
    return this.permissionsService.canAccessWarehouseConfiguration();
  }

  canAccessAdministration(): boolean {
    return this.permissionsService.canAccessAdministrationMenu();
  }

  canManageUsers(): boolean {
    return this.permissionsService.canManageUsers();
  }

  canAccessTickets(): boolean {
    return this.permissionsService.canAccessTickets();
  }

  canAccessInternosOse(): boolean {
    return this.permissionsService.canAccessInternosOse();
  }

  // Métodos para el user-header integrado
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
      case 'GM': return 'fas fa-crown'; // Corona para Game Master
      case 'ADMIN': return 'fas fa-shield-alt'; // Escudo para Administrador
      case 'USER': return 'fas fa-user'; // Usuario normal
      default: return 'fas fa-user-circle';
    }
  }

  logout(): void {
    this.authService.logout();
    // Redirigir al login
    window.location.href = '/#/login';
  }

  goToProfile(): void {
    this.router.navigate(['/menu/user-profile']);
  }
}
