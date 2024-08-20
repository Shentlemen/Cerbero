import { Routes } from '@angular/router';
import { HardwareComponent } from './hardware/hardware.component';
import { LocalComponent } from './local/local.component';
import { SoftwareComponent } from './software/software.component';
import { ComprasComponent } from './compras/compras.component';
import { ProveedoresComponent } from './proveedores/proveedores.component';

export const routes: Routes = [
  { path: 'hardware', component: HardwareComponent },
  { path: 'local', component: LocalComponent },
  { path: 'software', component: SoftwareComponent },
  { path: 'compras', component: ComprasComponent },
  { path: 'proveedores', component: ProveedoresComponent },
  { path: '', redirectTo: '/hardware', pathMatch: 'full' },
  { path: '**', redirectTo: '/hardware' } // Redirigir rutas desconocidas a la página de hardware
];
