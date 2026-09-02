import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { PermissionsService } from '../services/permissions.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';

interface ConfigHubTab {
  path: string;
  label: string;
  icon: string;
  accent: string;
  visible: () => boolean;
}

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NotificationContainerComponent],
  templateUrl: './configuracion.component.html',
  styleUrl: './configuracion.component.css'
})
export class ConfiguracionComponent implements OnInit, OnDestroy {
  readonly tabs: ConfigHubTab[] = [
    {
      path: 'locations',
      label: 'Ubicaciones',
      icon: 'fas fa-map-marker-alt',
      accent: '#0ea5e9',
      visible: () => this.permissions.canAccessLocationsConfiguration()
    },
    {
      path: 'tipos-activo',
      label: 'Tipos de activo',
      icon: 'fas fa-tags',
      accent: '#059669',
      visible: () => this.permissions.canAccessTiposActivoConfiguration()
    },
    {
      path: 'tipos-compra',
      label: 'Tipos de compra',
      icon: 'fas fa-file-invoice-dollar',
      accent: '#b45309',
      visible: () => this.permissions.canAccessConfiguration()
    },
    {
      path: 'usuarios',
      label: 'Responsables',
      icon: 'fas fa-user-tie',
      accent: '#7c3aed',
      visible: () => this.permissions.canAccessUsuariosResponsablesConfiguration()
    },
    {
      path: 'areas',
      label: 'Áreas',
      icon: 'fas fa-layer-group',
      accent: '#0f766e',
      visible: () => this.permissions.isGM()
    },
    {
      path: 'permisos',
      label: 'Permisos',
      icon: 'fas fa-user-lock',
      accent: '#be123c',
      visible: () => this.permissions.isGM()
    },
    {
      path: 'config-tickets',
      label: 'Tickets',
      icon: 'fas fa-ticket-alt',
      accent: '#af5252',
      visible: () => this.permissions.can('config_flujos', 'ver')
    }
  ];

  private routerSub?: Subscription;

  constructor(
    private permissions: PermissionsService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.ensureChildTab();
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.ensureChildTab());
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  get visibleTabs(): ConfigHubTab[] {
    return this.tabs.filter((tab) => tab.visible());
  }

  private ensureChildTab(): void {
    const visible = this.visibleTabs;
    if (!visible.length) {
      void this.router.navigate(['/menu/dashboard']);
      return;
    }
    const child = this.route.snapshot.firstChild?.url[0]?.path;
    if (!child || !visible.some((tab) => tab.path === child)) {
      void this.router.navigate([visible[0].path], { relativeTo: this.route, replaceUrl: true });
    }
  }
}
