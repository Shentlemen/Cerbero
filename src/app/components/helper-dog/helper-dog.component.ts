import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { HelperService, HelpTip } from '../../services/helper.service';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-helper-dog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './helper-dog.component.html',
  styleUrls: ['./helper-dog.component.css']
})
export class HelperDogComponent implements OnInit, OnDestroy {
  @Input() currentSection: string = '';
  
  isActive = false;
  showMessage = false;
  currentTip?: HelpTip;
  private routerSubscription: Subscription;
  private messageTimeout: any;

  constructor(
    private router: Router,
    private helperService: HelperService
  ) {
    // Suscribirse a los cambios de ruta
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      // Obtener la sección actual de la URL (mejorada para submenús)
      const currentRoute = this.getHelperSectionFromUrl(this.router.url);
      this.currentTip = this.helperService.getHelpForSection(currentRoute);
    });
  }

  ngOnInit() {
    // Obtener el mensaje inicial (mejorada para submenús)
    const currentRoute = this.getHelperSectionFromUrl(this.router.url);
    this.currentTip = this.helperService.getHelpForSection(currentRoute);
  }

  ngOnDestroy() {
    // Limpieza de la suscripción
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
  }

  toggleHelper() {
    this.isActive = !this.isActive;
    this.showMessage = this.isActive;
    
    if (this.showMessage && this.currentTip) {
      // Limpiar timeout anterior si existe
      if (this.messageTimeout) {
        clearTimeout(this.messageTimeout);
      }
      
      // Calcular duración basada en cantidad de palabras
      const words = this.currentTip.message.split(' ').length;
      const readingTimeMs = Math.max(words * 250, 3000); // 250ms por palabra, mínimo 3 segundos
      
      this.messageTimeout = setTimeout(() => {
        this.closeHelper();
      }, readingTimeMs);
    }
  }

  closeHelper() {
    this.isActive = false;
    this.showMessage = false;
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
    }
  }

  // Nueva función para obtener la clave de sección adecuada
  private getHelperSectionFromUrl(url: string): string {
    const segments = url.split('/').filter(Boolean);
    // Buscar primero los dos últimos segmentos (ej: procurement/compras)
    if (segments.length >= 3) {
      const lastTwo = segments.slice(-2).join('/');
      if (this.helperService.hasHelpForSection(lastTwo)) {
        return lastTwo;
      }
    }
    // Si no, buscar el último segmento
    const last = segments[segments.length - 1];
    if (this.helperService.hasHelpForSection(last)) {
      return last;
    }
    // Si no, devolver string vacío para mensaje por defecto
    return '';
  }
} 