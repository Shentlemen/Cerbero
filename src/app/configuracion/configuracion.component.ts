import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PermissionsService } from '../services/permissions.service';

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
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './configuracion.component.html',
  styleUrl: './configuracion.component.css'
})
export class ConfiguracionComponent {
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
      path: 'config-tickets',
      label: 'Tickets',
      icon: 'fas fa-ticket-alt',
      accent: '#af5252',
      visible: () => this.permissions.canManageTicketBandejas()
    }
  ];

  constructor(private permissions: PermissionsService) {}

  get visibleTabs(): ConfigHubTab[] {
    return this.tabs.filter((tab) => tab.visible());
  }
}
