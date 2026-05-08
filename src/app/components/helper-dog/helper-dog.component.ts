import { Component, Input, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { HelperService, HelpTip, UserBehavior, SmartSuggestion } from '../../services/helper.service';
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

  currentTip?: HelpTip;
  smartSuggestions: SmartSuggestion[] = [];
  userLevel: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
  contextualHelpText = '';
  showWoofMessage = false;
  isBouncing = false;
  highlightedElement: HTMLElement | null = null;
  private routerSubscription: Subscription;
  private userLevelSubscription: Subscription;
  private suggestionsSubscription: Subscription;
  private sessionStartTime: Date;
  private lastActionTime: Date;
  mousePosition = { x: 0, y: 0 };
  private woofTimeoutId: number | null = null;
  private bounceTimeoutId: number | null = null;

  constructor(
    private router: Router,
    private helperService: HelperService
  ) {
    this.sessionStartTime = new Date();
    this.lastActionTime = new Date();
    
    // Suscribirse a los cambios de ruta
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.handleRouteChange();
    });

    // Suscribirse al nivel del usuario
    this.userLevelSubscription = this.helperService.getUserLevel().subscribe(level => {
      this.userLevel = level;
    });

    // Suscribirse a sugerencias inteligentes
    this.suggestionsSubscription = this.helperService.getSmartSuggestionsObservable().subscribe(suggestions => {
      this.smartSuggestions = suggestions;
    });
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.mousePosition = { x: event.clientX, y: event.clientY };
    this.detectInteractiveElements(event);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Registrar clics en elementos interactivos
    const target = event.target as HTMLElement;
    if (target && this.isInteractiveElement(target)) {
      this.recordUserBehavior('element_click', this.currentSection, [target.tagName.toLowerCase()]);
    }
  }

  ngOnInit() {
    this.handleRouteChange();
    this.recordSessionStart();
    this.initializeContextualHelp();
  }

  ngOnDestroy() {
    // Limpieza de suscripciones
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.userLevelSubscription) {
      this.userLevelSubscription.unsubscribe();
    }
    if (this.suggestionsSubscription) {
      this.suggestionsSubscription.unsubscribe();
    }

    // Registrar fin de sesión
    this.recordSessionEnd();

    if (this.woofTimeoutId !== null) {
      window.clearTimeout(this.woofTimeoutId);
      this.woofTimeoutId = null;
    }
    if (this.bounceTimeoutId !== null) {
      window.clearTimeout(this.bounceTimeoutId);
      this.bounceTimeoutId = null;
    }
  }

  private handleRouteChange(): void {
    const currentRoute = this.getHelperSectionFromUrl(this.router.url);
    this.currentSection = currentRoute;
    this.currentTip = this.helperService.getHelpForSection(currentRoute);
    
    // Registrar comportamiento de navegación
    this.recordUserBehavior('navigation', currentRoute);
    
    // Obtener sugerencias inteligentes para la nueva sección
    this.smartSuggestions = this.helperService.getSmartSuggestions(currentRoute);
    
    // Contexto de sección listo para tutoriales futuros (p. ej. lista de tours por ruta).
    // Por ahora no hay UI en el perro al hacer clic.
  }

  private initializeContextualHelp(): void {
    // Configurar ayuda contextual para elementos comunes
    this.setupContextualHelp();
  }

  private setupContextualHelp(): void {
    // Agregar atributos data-help a elementos importantes
    const helpElements = document.querySelectorAll('[data-help]');
    helpElements.forEach(element => {
      
    });
  }

  private detectInteractiveElements(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Detectar elementos interactivos importantes
    if (this.isInteractiveElement(target)) {
      this.highlightElement(target);
      
      
    } else {
      this.removeHighlight();
      this.contextualHelpText = '';
    }
  }

  private isInteractiveElement(element: HTMLElement): boolean {
    const interactiveSelectors = [
      'button', 'a', 'input', 'select', 'textarea',
      '[role="button"]', '[role="link"]', '[role="tab"]',
      '.btn', '.button', '.nav-link', '.dropdown-toggle',
      '[data-toggle]', '[data-target]', '[data-bs-toggle]'
    ];
    
    return interactiveSelectors.some(selector => 
      element.matches(selector) || element.closest(selector)
    );
  }

  private highlightElement(element: HTMLElement): void {
    if (this.highlightedElement === element) return;
    
    this.removeHighlight();
    this.highlightedElement = element;
    element.style.outline = '2px solid #2196F3';
    element.style.outlineOffset = '2px';
    element.style.transition = 'outline 0.2s ease';
  }

  private removeHighlight(): void {
    if (this.highlightedElement) {
      this.highlightedElement.style.outline = '';
      this.highlightedElement.style.outlineOffset = '';
      this.highlightedElement = null;
    }
  }

  private recordUserBehavior(action: string, section: string, errors?: string[]): void {
    const now = new Date();
    const duration = now.getTime() - this.lastActionTime.getTime();
    
    const behavior: UserBehavior = {
      section: section,
      timestamp: now,
      action: action,
      duration: duration,
      errors: errors
    };
    
    this.helperService.recordUserBehavior(behavior);
    this.lastActionTime = now;
  }

  private recordSessionStart(): void {
    this.recordUserBehavior('session_start', 'system');
  }

  private recordSessionEnd(): void {
    const sessionDuration = new Date().getTime() - this.sessionStartTime.getTime();
    const behavior: UserBehavior = {
      section: 'system',
      timestamp: new Date(),
      action: 'session_end',
      duration: sessionDuration
    };
    this.helperService.recordUserBehavior(behavior);
  }

  recordError(error: string): void {
    this.recordUserBehavior('error', this.currentSection, [error]);
  }



  // Método para obtener sugerencias filtradas por confianza
  getFilteredSuggestions(): SmartSuggestion[] {
    return this.smartSuggestions.filter(s => s.confidence > 0.5);
  }

  onDogClick(): void {
    this.showWoofMessage = true;
    this.isBouncing = true;

    if (this.woofTimeoutId !== null) {
      window.clearTimeout(this.woofTimeoutId);
    }
    if (this.bounceTimeoutId !== null) {
      window.clearTimeout(this.bounceTimeoutId);
    }

    this.bounceTimeoutId = window.setTimeout(() => {
      this.isBouncing = false;
      this.bounceTimeoutId = null;
    }, 650);

    this.woofTimeoutId = window.setTimeout(() => {
      this.showWoofMessage = false;
      this.woofTimeoutId = null;
    }, 1400);
  }

  // Método para trackBy en ngFor
  trackBySuggestion(index: number, suggestion: SmartSuggestion): string {
    return suggestion.message + suggestion.type + suggestion.confidence;
  }

  // Método para obtener ayuda específica de elementos
  getElementHelp(elementType: string): string {
    const elementHelp: { [key: string]: string } = {
      'button': '🖱️ Haz clic para ejecutar una acción',
      'input': '⌨️ Escribe aquí para ingresar información',
      'select': '📋 Selecciona una opción de la lista',
      'table': '📊 Tabla de datos - puedes ordenar y filtrar',
      'form': '📝 Formulario para ingresar o editar datos',
      'modal': '🪟 Ventana emergente - cierra con X o ESC',
      'dropdown': '📂 Menú desplegable - haz clic para ver opciones',
      'search': '🔍 Busca información específica',
      'filter': '🎯 Filtra los resultados mostrados',
      'export': '📤 Descarga los datos en un archivo',
      'import': '📥 Sube datos desde un archivo',
      'save': '💾 Guarda los cambios realizados',
      'delete': '🗑️ Elimina el elemento seleccionado',
      'edit': '✏️ Edita la información mostrada',
      'view': '👁️ Ver detalles completos',
      'add': '➕ Agregar un nuevo elemento',
      'refresh': '🔄 Actualizar la información mostrada'
    };
    
    return elementHelp[elementType] || 'ℹ️ Elemento interactivo';
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