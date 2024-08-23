import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { MenuComponent } from './menu/menu.component';
import { HardwareComponent } from './hardware/hardware.component';
import { LocalComponent } from './local/local.component';
import { SoftwareComponent } from './software/software.component';
import { ComprasComponent } from './compras/compras.component';
import { ProveedoresComponent } from './proveedores/proveedores.component';
import { ComprasPedidoComponent } from './compras-pedido/compras-pedido.component';
import { HwComprasComponent } from './hw-compras/hw-compras.component';
import { HwLocalComponent } from './hw-local/hw-local.component';
import { HwSwComprasComponent } from './hw-sw-compras/hw-sw-compras.component';
import { SwComprasComponent } from './sw-compras/sw-compras.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'menu', component: MenuComponent, children: [
    { path: 'compras', component: ComprasComponent },
    { path: 'compras-pedido', component: ComprasPedidoComponent },
    { path: 'hardware', component: HardwareComponent },
    { path: 'hw-compras', component: HwComprasComponent },
    { path: 'hw-local', component: HwLocalComponent },
    { path: 'hw-sw-compras', component: HwSwComprasComponent },
    { path: 'local', component: LocalComponent },
    { path: 'proveedores', component: ProveedoresComponent },
    { path: 'software', component: SoftwareComponent },
    { path: 'sw-compras', component: SwComprasComponent },
  ]},
  { path: '**', redirectTo: '' }
];
