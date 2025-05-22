import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { HelperService } from '../services/helper.service';
import { HelpTip } from '../services/helper.service';
import { filter, Subscription } from 'rxjs';
import { HelperDogComponent } from '../components/helper-dog/helper-dog.component';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    HelperDogComponent
  ],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit, OnDestroy {
  isAssetsExpanded: boolean = false;
  isConfigExpanded: boolean = false;
  isProcurementExpanded: boolean = false;
  isHelperActive = false;
  showHelperMessage = false;
  currentHelperTip?: HelpTip;
  private routerSubscription: Subscription;

  // Arrays con las rutas específicas de cada sección
  private assetsRoutes = ['/menu/assets', '/menu/devices'];
  private configRoutes = [
    '/menu/settings',
    '/menu/locations',
    '/menu/procurement/tipos-activo',
    '/menu/procurement/tipos-compra',
    '/menu/procurement/servicios-garantia',
    '/menu/procurement/usuarios'
  ];
  private procurementRoutes = [
    '/menu/procurement/activos',
    '/menu/procurement/compras',
    '/menu/procurement/entregas',
    '/menu/procurement/lotes',
    '/menu/procurement/proveedores'
  ];

  constructor(
    private router: Router,
    private helperService: HelperService
  ) {
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.url;
      
      // Verificar si la ruta actual pertenece a alguna sección
      const isAssetsRoute = this.assetsRoutes.some(route => url.startsWith(route));
      const isConfigRoute = this.configRoutes.some(route => url.startsWith(route));
      const isProcurementRoute = this.procurementRoutes.some(route => url.startsWith(route));

      // Actualizar estados de los submenús
      if (isProcurementRoute && !url.includes('/tipos-')) {
        this.isProcurementExpanded = true;
        this.isAssetsExpanded = false;
        this.isConfigExpanded = false;
      } else if (isAssetsRoute) {
        this.isAssetsExpanded = true;
        this.isProcurementExpanded = false;
        this.isConfigExpanded = false;
      } else if (isConfigRoute || (url.includes('/procurement/tipos-'))) {
        this.isConfigExpanded = true;
        this.isProcurementExpanded = false;
        this.isAssetsExpanded = false;
      } else {
        // Si no es ninguna de las rutas anteriores, cerrar todos los submenús
        this.isAssetsExpanded = false;
        this.isConfigExpanded = false;
        this.isProcurementExpanded = false;
      }
      
      this.closeHelper();
    });
  }

  ngOnInit() {
    // ... código existente ...
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
      this.isProcurementExpanded = false;
    }
  }

  toggleConfigMenu(): void {
    this.isConfigExpanded = !this.isConfigExpanded;
    if (this.isConfigExpanded) {
      this.isAssetsExpanded = false;
      this.isProcurementExpanded = false;
    }
  }

  toggleProcurementMenu(): void {
    this.isProcurementExpanded = !this.isProcurementExpanded;
    if (this.isProcurementExpanded) {
      this.isAssetsExpanded = false;
      this.isConfigExpanded = false;
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
}
