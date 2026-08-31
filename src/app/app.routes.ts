import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { HomeComponent } from './home/home.component';
import { MenuComponent } from './menu/menu.component';
import { SoftwareComponent } from './software/software.component';
import { ProcurementComponent } from './procurement/procurement.component';
import { SubnetsComponent } from './subnets/subnets.component';
import { DevicesComponent } from './devices/devices.component';
import { DeviceDetailsComponent } from './device-details/device-details.component';
import { AlmacenesComponent } from './almacen/almacenes/almacenes.component';
import { StockAlmacenComponent } from './almacen/stock-almacen/stock-almacen.component';
import { UbicacionesComponent } from './almacen/stock/stock.component';

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
    path: 'secret-game',
    loadComponent: () =>
      import('./secret-game/secret-game-hub.component').then((m) => m.SecretGameHubComponent)
  },
  {
    path: 'secret-game/snake',
    loadComponent: () =>
      import('./secret-game/snake-game.component').then((m) => m.SnakeGameComponent)
  },
  {
    path: 'secret-game/arkanoid',
    loadComponent: () =>
      import('./secret-game/arkanoid-game.component').then((m) => m.ArkanoidGameComponent)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./register/register.component').then((m) => m.RegisterComponent)
  },
  {
    path: 'notification-demo',
    loadComponent: () => import('./components/notification-demo/notification-demo.component').then(m => m.NotificationDemoComponent)
  },
  {
    path: 'user-profile',
    redirectTo: '/menu/user-profile',
    pathMatch: 'full'
  },
  {
    path: 'menu',
    component: MenuComponent,
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'user-profile', loadComponent: () => import('./user-profile/user-profile.component').then(m => m.UserProfileComponent) },
      { path: 'assets', loadComponent: () => import('./assets/assets.component').then(m => m.AssetsComponent) },
      { path: 'cementerio', loadComponent: () => import('./cementerio/cementerio.component').then(m => m.CementerioComponent) },
      { path: 'almacen-laboratorio', loadComponent: () => import('./almacen-laboratorio/almacen-laboratorio.component').then(m => m.AlmacenLaboratorioComponent) },
      { path: 'asset-details/:id', loadComponent: () => import('./assetdetails/assetdetails.component').then(m => m.AssetdetailsComponent) },
      { path: 'software', component: SoftwareComponent },
      { path: 'internos-ose', loadComponent: () => import('./internos-ose/internos-ose.component').then(m => m.InternosOseComponent) },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent),
        canActivate: [RoleGuard],
        data: { roles: ['GM'] }
      },
      {
        path: 'configuracion',
        loadComponent: () => import('./configuracion/configuracion.component').then(m => m.ConfiguracionComponent),
        canActivate: [RoleGuard],
        data: { roles: ['GM', 'ADMIN', 'INVENTARIO'] },
        children: [
          { path: '', redirectTo: 'locations', pathMatch: 'full' },
          {
            path: 'locations',
            loadComponent: () => import('./locations/locations.component').then(m => m.LocationsComponent),
            canActivate: [RoleGuard],
            data: { roles: ['GM', 'ADMIN', 'INVENTARIO'] }
          },
          {
            path: 'tipos-activo',
            loadComponent: () => import('./procurement/tipos-activo/tipos-activo.component').then(m => m.TiposActivoComponent),
            canActivate: [RoleGuard],
            data: { roles: ['GM', 'ADMIN', 'INVENTARIO'] }
          },
          {
            path: 'tipos-compra',
            loadComponent: () => import('./procurement/tipos-compra/tipos-compra.component').then(m => m.TiposCompraComponent),
            canActivate: [RoleGuard],
            data: { roles: ['GM', 'ADMIN'] }
          },
          {
            path: 'usuarios',
            loadComponent: () => import('./procurement/usuarios/usuarios.component').then(m => m.UsuariosComponent),
            canActivate: [RoleGuard],
            data: { roles: ['GM', 'ADMIN', 'INVENTARIO'] }
          },
          {
            path: 'config-tickets',
            loadComponent: () => import('./config-tickets/config-tickets.component').then(m => m.ConfigTicketsComponent),
            canActivate: [RoleGuard],
            data: { roles: ['GM', 'ADMIN'] }
          }
        ]
      },
      { path: 'config-tickets', redirectTo: 'configuracion/config-tickets', pathMatch: 'full' },
      { path: 'bandejas-reclamos', redirectTo: 'configuracion/config-tickets', pathMatch: 'full' },
      {
        path: 'user-management',
        loadComponent: () => import('./user-management/user-management.component').then(m => m.UserManagementComponent),
        canActivate: [RoleGuard],
        data: { roles: ['GM'] }
      },
      { path: 'procurement', component: ProcurementComponent },
      { path: 'procurement/activos', loadComponent: () => import('./procurement/activos/activos.component').then(m => m.ActivosComponent) },
      { path: 'procurement/activos/:id', loadComponent: () => import('./procurement/activos/activo-details/activo-details.component').then(m => m.ActivoDetailsComponent) },
      { path: 'procurement/compras', loadComponent: () => import('./procurement/compras/compras.component').then(m => m.ComprasComponent) },
      { path: 'procurement/entregas', loadComponent: () => import('./procurement/entregas/entregas.component').then(m => m.EntregasComponent) },
      { path: 'procurement/lotes', loadComponent: () => import('./procurement/lotes/lotes.component').then(m => m.LotesComponent) },
      { path: 'procurement/proveedores', loadComponent: () => import('./procurement/proveedores/proveedores.component').then(m => m.ProveedoresComponent) },
      { path: 'procurement/usuarios', redirectTo: 'configuracion/usuarios', pathMatch: 'full' },
      { path: 'procurement/tipos-activo', redirectTo: 'configuracion/tipos-activo', pathMatch: 'full' },
      { path: 'procurement/tipos-compra', redirectTo: 'configuracion/tipos-compra', pathMatch: 'full' },
      { path: 'procurement/servicios-garantia', loadComponent: () => import('./procurement/servicios-garantia/servicios-garantia.component').then(m => m.ServiciosGarantiaComponent) },
      {
        path: 'subnets',
        component: SubnetsComponent,
        canActivate: [RoleGuard],
        data: { roles: ['GM', 'ADMIN'] }
      },
      { path: 'devices', component: DevicesComponent },
      { path: 'device-details/:mac', component: DeviceDetailsComponent },
      { path: 'locations', redirectTo: 'configuracion/locations', pathMatch: 'full' },
      { path: 'almacen/almacenes', component: AlmacenesComponent },
      { path: 'almacen/stock/:id', component: StockAlmacenComponent },
      { path: 'almacen/stock', component: UbicacionesComponent },
      {
        path: 'almacen/config',
        redirectTo: 'almacen/configuracion',
        pathMatch: 'full'
      },
      {
        path: 'almacen/configuracion/planta/:almacenId',
        loadComponent: () => import('./almacen/planta-almacen/planta-almacen-editor.component').then(m => m.PlantaAlmacenEditorComponent),
        canActivate: [RoleGuard],
        data: { roles: ['GM', 'ADMIN', 'ALMACEN'] }
      },
      {
        path: 'almacen/configuracion',
        loadComponent: () => import('./almacen/configuracion-almacen/configuracion-almacen.component').then(m => m.ConfiguracionAlmacenComponent),
        canActivate: [RoleGuard],
        data: { roles: ['GM', 'ADMIN', 'ALMACEN'] }
      },
      { path: 'tickets', loadComponent: () => import('./tickets/tickets.component').then(m => m.TicketsComponent) },
      { path: 'tickets/nuevo', redirectTo: 'tickets', pathMatch: 'full' },
      {
        path: 'tickets/:id',
        loadComponent: () => import('./tickets/tickets.component').then(m => m.TicketsComponent)
      },
      { path: 'almacen/3d-demo', loadComponent: () => import('./almacen-3d-demo/almacen-3d-demo.component').then(m => m.Almacen3DDemoComponent) }
    ]
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
