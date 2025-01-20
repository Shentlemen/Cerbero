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
  isHelperActive = false;
  showHelperMessage = false;
  currentHelperTip?: HelpTip;
  private routerSubscription: Subscription;

  constructor(
    private router: Router,
    private helperService: HelperService
  ) {
    // Suscribirse a los cambios de ruta
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      // Cerrar la burbuja cuando cambia la ruta
      this.closeHelper();
    });
  }

  ngOnInit() {
    // ... código existente ...
  }

  ngOnDestroy() {
    // Limpieza de la suscripción
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  toggleAssetsMenu(): void {
    this.isAssetsExpanded = !this.isAssetsExpanded;
  }

  toggleHelper() {
    this.isHelperActive = !this.isHelperActive;
    this.showHelperMessage = this.isHelperActive;
    
    // Obtener la sección actual de la URL
    const currentRoute = this.router.url.split('/').pop() || 'dashboard';
    this.currentHelperTip = this.helperService.getHelpForSection(currentRoute);
  }

  closeHelper() {
    this.isHelperActive = false;
    this.showHelperMessage = false;
  }
}
