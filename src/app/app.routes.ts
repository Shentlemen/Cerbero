import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { MenuComponent } from './menu/menu.component';
import { SoftwareComponent } from './software/software.component';
import { ProcurementComponent } from './procurement/procurement.component';
import { SubnetsComponent } from './subnets/subnets.component';
import { DevicesComponent } from './devices/devices.component';
import { DeviceDetailsComponent } from './device-details/device-details.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: HomeComponent
  },
  {
    path: 'notification-demo',
    loadComponent: () => import('./components/notification-demo/notification-demo.component').then(m => m.NotificationDemoComponent)
  },
  {
    path: 'user-profile',
    loadComponent: () => import('./user-profile/user-profile.component').then(m => m.UserProfileComponent)
  },
  {
    path: 'menu',
    component: MenuComponent,
    children: [
      { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'assets', loadComponent: () => import('./assets/assets.component').then(m => m.AssetsComponent) },
      { path: 'asset-details/:id', loadComponent: () => import('./assetdetails/assetdetails.component').then(m => m.AssetdetailsComponent) },
      { path: 'software', component: SoftwareComponent },
      { path: 'settings', loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent) },
      { path: 'user-management', loadComponent: () => import('./user-management/user-management.component').then(m => m.UserManagementComponent) },
      { path: 'procurement', component: ProcurementComponent },
      { path: 'procurement/activos', loadComponent: () => import('./procurement/activos/activos.component').then(m => m.ActivosComponent) },
      { path: 'procurement/activos/:id', loadComponent: () => import('./procurement/activos/activo-details/activo-details.component').then(m => m.ActivoDetailsComponent) },
      { path: 'procurement/compras', loadComponent: () => import('./procurement/compras/compras.component').then(m => m.ComprasComponent) },
      { path: 'procurement/entregas', loadComponent: () => import('./procurement/entregas/entregas.component').then(m => m.EntregasComponent) },
      { path: 'procurement/lotes', loadComponent: () => import('./procurement/lotes/lotes.component').then(m => m.LotesComponent) },
      { path: 'procurement/proveedores', loadComponent: () => import('./procurement/proveedores/proveedores.component').then(m => m.ProveedoresComponent) },
      { path: 'procurement/usuarios', loadComponent: () => import('./procurement/usuarios/usuarios.component').then(m => m.UsuariosComponent) },
      { path: 'procurement/tipos-activo', loadComponent: () => import('./procurement/tipos-activo/tipos-activo.component').then(m => m.TiposActivoComponent) },
      { path: 'procurement/tipos-compra', loadComponent: () => import('./procurement/tipos-compra/tipos-compra.component').then(m => m.TiposCompraComponent) },
      { path: 'procurement/servicios-garantia', loadComponent: () => import('./procurement/servicios-garantia/servicios-garantia.component').then(m => m.ServiciosGarantiaComponent) },
      { path: 'subnets', component: SubnetsComponent },
      { path: 'devices', component: DevicesComponent },
      { path: 'device-details/:mac', component: DeviceDetailsComponent },
      { path: 'locations', loadComponent: () => import('./locations/locations.component')
        .then(m => m.LocationsComponent) },
      { path: 'almacen/almacenes', loadComponent: () => import('./almacen/almacenes/almacenes.component').then(m => m.AlmacenesComponent) },
      { path: 'almacen/ubicaciones', loadComponent: () => import('./almacen/ubicaciones/ubicaciones.component').then(m => m.UbicacionesComponent) }
    ]
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
