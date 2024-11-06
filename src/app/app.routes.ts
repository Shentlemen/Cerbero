import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { MenuComponent } from './menu/menu.component';
import { SoftwareComponent } from './software/software.component';
import { ProcurementComponent } from './procurement/procurement.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { 
    path: 'menu', 
    component: MenuComponent,
    children: [
      { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'assets', loadComponent: () => import('./assets/assets.component').then(m => m.AssetsComponent) },
      { path: 'asset-details/:id', loadComponent: () => import('./assetdetails/assetdetails.component').then(m => m.AssetdetailsComponent) },
      { path: 'software', component: SoftwareComponent },
      { path: 'settings', loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent) },
      { path: 'procurement', component: ProcurementComponent },
    ]
  },
  { path: '**', redirectTo: '' }
];
