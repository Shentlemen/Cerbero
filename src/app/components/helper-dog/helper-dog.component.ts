import { Component, ElementRef, Input, NgZone, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { HelperService, HelpTip, UserBehavior, SmartSuggestion } from '../../services/helper.service';
import { TourDefinition, TourRegistryService } from '../../services/tour-registry.service';
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
  /** Tours del registry para la sección actual. Render del menú radial. */
  availableTours: TourDefinition[] = [];
  /** Estado abierto/cerrado del menú radial. */
  showRadialMenu = false;
  private routerSubscription: Subscription;
  private userLevelSubscription: Subscription;
  private suggestionsSubscription: Subscription;
  private toursSubscription: Subscription;
  private sessionStartTime: Date;
  private lastActionTime: Date;
  private woofTimeoutId: number | null = null;
  private bounceTimeoutId: number | null = null;
  /**
   * Listener nativo de mousemove instalado fuera de la zona Angular para no
   * disparar change detection con cada pixel movido. Sólo lo usamos para
   * pintar un outline en elementos interactivos; ningún binding del template
   * depende de él.
   */
  private mouseMoveListener?: (event: MouseEvent) => void;

  constructor(
    private router: Router,
    private helperService: HelperService,
    private tourRegistry: TourRegistryService,
    private hostRef: ElementRef<HTMLElement>,
    private zone: NgZone
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

    // Suscribirse a los tours disponibles para la sección actual (registry centralizado).
    this.toursSubscription = this.tourRegistry.getCurrentTours().subscribe(tours => {
      this.availableTours = tours;
      // Si cambiamos de ruta y el menú estaba abierto, lo cerramos para no
      // dejar botones flotando que ya no corresponden a la sección visible.
      if (tours.length === 0) {
        this.showRadialMenu = false;
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Registrar clics en elementos interactivos
    const target = event.target as HTMLElement;
    if (target && this.isInteractiveElement(target)) {
      this.recordUserBehavior('element_click', this.currentSection, [target.tagName.toLowerCase()]);
    }

    // Cerrar el menú radial si el click cayó fuera del helper.
    if (this.showRadialMenu && target && !this.hostRef.nativeElement.contains(target)) {
      this.showRadialMenu = false;
    }
  }

  ngOnInit() {
    this.handleRouteChange();
    this.recordSessionStart();
    this.initializeContextualHelp();
    // Instalamos el listener nativo de mousemove FUERA de Angular: el feature
    // de outline en elementos interactivos no necesita correr change detection
    // global, y antes era responsable del lag percibido en pantallas con
    // tablas grandes (devices, assets, etc.).
    this.zone.runOutsideAngular(() => {
      this.mouseMoveListener = (event: MouseEvent) => this.detectInteractiveElements(event);
      document.addEventListener('mousemove', this.mouseMoveListener, { passive: true });
    });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.userLevelSubscription) {
      this.userLevelSubscription.unsubscribe();
    }
    if (this.suggestionsSubscription) {
      this.suggestionsSubscription.unsubscribe();
    }
    if (this.toursSubscription) {
      this.toursSubscription.unsubscribe();
    }

    this.recordSessionEnd();

    if (this.woofTimeoutId !== null) {
      window.clearTimeout(this.woofTimeoutId);
      this.woofTimeoutId = null;
    }
    if (this.bounceTimeoutId !== null) {
      window.clearTimeout(this.bounceTimeoutId);
      this.bounceTimeoutId = null;
    }
    if (this.mouseMoveListener) {
      document.removeEventListener('mousemove', this.mouseMoveListener);
      this.mouseMoveListener = undefined;
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

  onDogClick(event?: MouseEvent): void {
    // Evita que el `document:click` cierre lo que acabamos de abrir.
    event?.stopPropagation();

    this.triggerBounce();

    if (this.availableTours.length === 0) {
      // Sin tours en esta sección: comportamiento amistoso original.
      this.showRadialMenu = false;
      this.showWoof();
      return;
    }

    this.showWoofMessage = false;
    if (this.woofTimeoutId !== null) {
      window.clearTimeout(this.woofTimeoutId);
      this.woofTimeoutId = null;
    }
    this.showRadialMenu = !this.showRadialMenu;
  }

  /** Ejecuta el tour elegido y cierra el menú radial. */
  onTourClick(tour: TourDefinition, event?: MouseEvent): void {
    event?.stopPropagation();
    this.showRadialMenu = false;
    this.tourRegistry.runTour(tour.id);
  }

  /**
   * Posiciona cada botón del menú en un arco a la derecha-arriba del perro
   * (el perro vive abajo-izquierda, así el arco siempre cae dentro de la
   * pantalla aunque haya 5+ tours). Devuelve un `translate` listo para `transform`.
   *
   * Tanto el radio como el ancho del arco se adaptan a la cantidad de tours:
   * con pocos items el menú queda compacto y pegado al perro; con muchos
   * abre apenas lo necesario para no superponer botones.
   */
  getRadialTransform(index: number, total: number): string {
    // Radio polar al centro de cada botón. El perro mide 100px (radio 50)
    // y cada botón 56px (radio 28); con radius=92 quedan ~14px de aire
    // entre el borde del perro y el botón. Crece un poco con más tours
    // para que no se compriman al achicar la separación angular.
    const radius = total <= 2 ? 92 : total === 3 ? 96 : 102;
    // Separación angular entre centros de botones.
    // A radio 92, un botón cubre ~36° de arco; usar 46°-48° deja ~10-12°
    // de aire angular entre vecinos (lectura cómoda, sin amontonarse).
    const stepDeg = total <= 3 ? 48 : 42;
    // Centro del arco: noreste del perro (≈45° = diagonal exacta).
    const centerAngle = 50;
    const totalSpan = (total - 1) * stepDeg;
    const startAngle = centerAngle - totalSpan / 2;
    const angle = total === 1 ? centerAngle : startAngle + stepDeg * index;
    const rad = (angle * Math.PI) / 180;
    const x = Math.sin(rad) * radius;
    const y = -Math.cos(rad) * radius;
    return `translate(${x}px, ${y}px)`;
  }

  /** Cierra el menú radial al presionar Escape. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showRadialMenu) {
      this.showRadialMenu = false;
    }
  }

  private triggerBounce(): void {
    this.isBouncing = true;
    if (this.bounceTimeoutId !== null) {
      window.clearTimeout(this.bounceTimeoutId);
    }
    this.bounceTimeoutId = window.setTimeout(() => {
      this.isBouncing = false;
      this.bounceTimeoutId = null;
    }, 650);
  }

  private showWoof(): void {
    this.showWoofMessage = true;
    if (this.woofTimeoutId !== null) {
      window.clearTimeout(this.woofTimeoutId);
    }
    this.woofTimeoutId = window.setTimeout(() => {
      this.showWoofMessage = false;
      this.woofTimeoutId = null;
    }, 1400);
  }

  trackByTour(_index: number, tour: TourDefinition): string {
    return tour.id;
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