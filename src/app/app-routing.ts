import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { MenuComponent } from './menu/menu.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AssetsComponent } from './assets/assets.component';
import { SoftwareComponent } from './software/software.component';
import { SettingsComponent } from './settings/settings.component';
import { AssetdetailsComponent } from './assetdetails/assetdetails.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'menu', component: MenuComponent, children: [
    { path: 'dashboard', component: DashboardComponent },
    { path: 'assets', component: AssetsComponent },
    { path: 'asset-details/:id', component: AssetdetailsComponent },
    { path: 'software', component: SoftwareComponent },
    { path: 'settings', component: SettingsComponent },
  ]},
  { path: '**', redirectTo: '' }
];
