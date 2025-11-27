import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { HelperService } from '../services/helper.service';
import { HelpTip } from '../services/helper.service';
import { filter, Subscription } from 'rxjs';
import { HelperDogComponent } from '../components/helper-dog/helper-dog.component';
import { UserHeaderComponent } from '../components/user-header/user-header.component';
import { AppHeaderComponent } from '../components/app-header/app-header.component';
import { AuthService } from '../services/auth.service';
import { User } from '../interfaces/auth.interface';
import { PermissionsService } from '../services/permissions.service';
import { getVersionInfo } from '../version';

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
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit, OnDestroy {
  isAssetsExpanded: boolean = false;
  isConfigExpanded: boolean = false;
  isAlmacenExpanded: boolean = false;
  isAdminExpanded: boolean = false;
  isAdquisicionesExpanded: boolean = false;
  isHelperActive = false;
  showHelperMessage = false;
  currentHelperTip?: HelpTip;
  currentUser: User | null = null;
  versionInfo = getVersionInfo();
  private routerSubscription: Subscription;

  // Arrays con las rutas específicas de cada sección
  private assetsRoutes = ['/menu/assets', '/menu/devices', '/menu/cementerio', '/menu/almacen-laboratorio'];
  private configRoutes = [
    '/menu/locations',
    '/menu/subnets',
    '/menu/procurement/tipos-activo',
    '/menu/procurement/tipos-compra',
    '/menu/procurement/usuarios'
  ];
  private adminRoutes = [
    '/menu/settings',
    '/menu/user-management'
  ];
  private adquisicionesRoutes = [
    '/menu/procurement/compras',
    '/menu/procurement/proveedores',
    // '/menu/procurement/servicios-garantia'
  ];
  private almacenRoutes = [
    '/menu/almacen/almacenes',
            '/menu/almacen/stock'
  ];

  constructor(
    private router: Router,
    private helperService: HelperService,
    private authService: AuthService,
    private permissionsService: PermissionsService
  ) {
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.url;
      
      // Verificar si la ruta actual pertenece a alguna sección
      const isAssetsRoute = this.assetsRoutes.some(route => url.startsWith(route));
      const isConfigRoute = this.configRoutes.some(route => url.startsWith(route));
      const isAlmacenRoute = this.almacenRoutes.some(route => url.startsWith(route));
      const isAdminRoute = this.adminRoutes.some(route => url.startsWith(route));
      const isAdquisicionesRoute = this.adquisicionesRoutes.some(route => url.startsWith(route));

      // Actualizar estados de los submenús
      if (isAssetsRoute) {
        this.isAssetsExpanded = true;
        this.isConfigExpanded = false;
        this.isAlmacenExpanded = false;
        this.isAdminExpanded = false;
        this.isAdquisicionesExpanded = false;
      } else if (isConfigRoute) {
        this.isConfigExpanded = true;
        this.isAssetsExpanded = false;
        this.isAlmacenExpanded = false;
        this.isAdminExpanded = false;
        this.isAdquisicionesExpanded = false;
      } else if (isAlmacenRoute) {
        this.isAlmacenExpanded = true;
        this.isAssetsExpanded = false;
        this.isConfigExpanded = false;
        this.isAdminExpanded = false;
        this.isAdquisicionesExpanded = false;
      } else if (isAdminRoute) {
        this.isAdminExpanded = true;
        this.isAssetsExpanded = false;
        this.isConfigExpanded = false;
        this.isAlmacenExpanded = false;
        this.isAdquisicionesExpanded = false;
      } else if (isAdquisicionesRoute) {
        this.isAdquisicionesExpanded = true;
        this.isAssetsExpanded = false;
        this.isConfigExpanded = false;
        this.isAlmacenExpanded = false;
        this.isAdminExpanded = false;
      } else {
        // Si no es ninguna de las rutas anteriores, cerrar todos los submenús
        this.isAssetsExpanded = false;
        this.isConfigExpanded = false;
        this.isAlmacenExpanded = false;
        this.isAdminExpanded = false;
        this.isAdquisicionesExpanded = false;
      }
      
      this.closeHelper();

      // Siempre hacer scroll al top al cambiar de ruta
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  ngOnInit() {
    // Suscribirse al usuario actual
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  toggleAssetsMenu(): void {
    this.isAssetsExpanded = !this.isAssetsExpanded;
    if (this.isAssetsExpanded) {
      this.isConfigExpanded = false;
      this.isAlmacenExpanded = false;
      this.isAdquisicionesExpanded = false;
    }
  }

  toggleConfigMenu(): void {
    this.isConfigExpanded = !this.isConfigExpanded;
    if (this.isConfigExpanded) {
      this.isAssetsExpanded = false;
      this.isAlmacenExpanded = false;
      this.isAdquisicionesExpanded = false;
    }
  }

  toggleAlmacenMenu(): void {
    this.isAlmacenExpanded = !this.isAlmacenExpanded;
    if (this.isAlmacenExpanded) {
      this.isAssetsExpanded = false;
      this.isConfigExpanded = false;
      this.isAdquisicionesExpanded = false;
    }
  }

  toggleAdminMenu(): void {
    this.isAdminExpanded = !this.isAdminExpanded;
    if (this.isAdminExpanded) {
      this.isAssetsExpanded = false;
      this.isConfigExpanded = false;
      this.isAlmacenExpanded = false;
      this.isAdquisicionesExpanded = false;
    }
  }

  toggleAdquisicionesMenu(): void {
    this.isAdquisicionesExpanded = !this.isAdquisicionesExpanded;
    if (this.isAdquisicionesExpanded) {
      this.isAssetsExpanded = false;
      this.isConfigExpanded = false;
      this.isAlmacenExpanded = false;
      this.isAdminExpanded = false;
    }
  }

  toggleHelper() {
    this.isHelperActive = !this.isHelperActive;
    this.showHelperMessage = this.isHelperActive;
    
    const currentRoute = this.router.url.split('/').pop() || 'dashboard';
    this.currentHelperTip = this.helperService.getHelpForSection(currentRoute);
  }

  closeHelper() {
    this.isHelperActive = false;
    this.showHelperMessage = false;
  }

  isGM(): boolean {
    return this.permissionsService.isGM();
  }

  canAccessConfiguration(): boolean {
    return this.permissionsService.canAccessConfiguration();
  }

  canAccessAdministration(): boolean {
    return this.permissionsService.canAccessConfiguration(); // Misma lógica que configuración
  }

  canManageUsers(): boolean {
    return this.permissionsService.canManageUsers();
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
    this.router.navigate(['/user-profile']);
  }
}
