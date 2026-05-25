import { Component, ElementRef, Input, NgZone, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { HelperService, HelpTip, UserBehavior, SmartSuggestion } from '../../services/helper.service';
import { TourDefinition, TourRegistryService } from '../../services/tour-registry.service';
import { UnreadTicketsService } from '../../services/unread-tickets.service';
import { OcsDuplicatesAlertService } from '../../services/ocs-duplicates-alert.service';
import { PermissionsService } from '../../services/permissions.service';
import {
  COMIC_BUBBLE_FIRST_LOGIN_MS,
  COMIC_BUBBLE_MS
} from '../../services/helper-dog-bubble.constants';
import {
  ComicBubbleKind,
  ComicBubblePayload,
  COMIC_BUBBLE_KIND_PRIORITY
} from './helper-dog-comic-bubble';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-helper-dog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './helper-dog.component.html',
  styleUrls: ['./helper-dog.component.css']
})
export class HelperDogComponent implements OnInit, OnDestroy {
  /** Debe coincidir con --dog-size en helper-dog.component.css (escala del menú radial). */
  private static readonly DOG_SIZE_PX = 124;

  @Input() currentSection: string = '';

  currentTip?: HelpTip;
  smartSuggestions: SmartSuggestion[] = [];
  userLevel: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
  contextualHelpText = '';
  showWoofMessage = false;
  /** Globo cómic activo (cola: un aviso a la vez). */
  showComicBubble = false;
  comicBubbleTitle = '';
  comicBubbleText = '';
  comicBubbleKind: ComicBubbleKind = 'tickets';
  comicBubbleByBadge = false;
  /** Total de avisos en la cola (incluye el que se está mostrando). */
  comicBubbleQueueTotal = 0;
  isBouncing = false;
  highlightedElement: HTMLElement | null = null;
  /** Tours del registry para la sección actual. Render del menú radial. */
  availableTours: TourDefinition[] = [];
  /** Estado abierto/cerrado del menú radial. */
  showRadialMenu = false;
  /** Tickets no leídos en la bandeja del usuario; alimenta el badge rojo del perro. */
  ticketsNoLeidos = 0;
  /** Grupos de nombres duplicados en OCS (solo GM real). Badge naranja del perro. */
  ocsDuplicadosGrupos = 0;
  private routerSubscription: Subscription;
  private userLevelSubscription: Subscription;
  private suggestionsSubscription: Subscription;
  private toursSubscription: Subscription;
  private unreadSubscription?: Subscription;
  private ocsDupSubscription?: Subscription;
  private viewAsSubscription?: Subscription;
  private sessionStartTime: Date;
  private lastActionTime: Date;
  private woofTimeoutId: number | null = null;
  private comicBubbleTimeoutId: number | null = null;
  private comicBubbleHovering = false;
  private comicBubbleFirstLoginDismiss = false;
  private readonly comicBubbleQueue: ComicBubblePayload[] = [];
  private lastOcsDupNotificationText: string | null = null;
  private lastTicketsNotificationText: string | null = null;
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
    private zone: NgZone,
    private unreadTicketsService: UnreadTicketsService,
    private ocsDuplicatesAlertService: OcsDuplicatesAlertService,
    private permissionsService: PermissionsService
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

    this.unreadSubscription = this.unreadTicketsService.unreadCount$.subscribe((count) => {
      this.ticketsNoLeidos = count;
      if (count > 0) {
        this.lastTicketsNotificationText = this.unreadTicketsService.buildBubbleMessage(count);
        const loginBubbleText = this.unreadTicketsService.consumeLoginBubbleRequest();
        if (loginBubbleText) {
          this.enqueueComicBubble({
            kind: 'tickets',
            title: 'Tickets en tu bandeja',
            text: loginBubbleText,
            firstLogin: true,
            anchoredByBadge: false
          });
        }
      } else {
        this.lastTicketsNotificationText = null;
        this.clearComicQueueForKind('tickets');
      }
    });

    this.ocsDupSubscription = this.ocsDuplicatesAlertService.summary$.subscribe((summary) => {
      this.ocsDuplicadosGrupos = summary?.groupCount ?? 0;
      if (summary && summary.groupCount > 0) {
        this.lastOcsDupNotificationText =
          this.ocsDuplicatesAlertService.buildBubbleMessage(summary);
        const loginBubbleText = this.ocsDuplicatesAlertService.consumeLoginBubbleRequest();
        if (loginBubbleText) {
          this.enqueueComicBubble({
            kind: 'ocs',
            title: 'Duplicados en OCS',
            text: loginBubbleText,
            firstLogin: true,
            anchoredByBadge: false
          });
        }
      } else {
        this.lastOcsDupNotificationText = null;
        this.clearComicQueueForKind('ocs');
      }
    });

    // Si un GM cambia "ver como otro rol" y pierde permiso de ver alertas OCS,
    // descartamos el globo cómic que pudiera estar visible para esa categoría.
    this.viewAsSubscription = this.permissionsService.viewAs$.subscribe(() => {
      if (!this.canSeeOcsDuplicateAlerts()) {
        this.lastOcsDupNotificationText = null;
        this.clearComicQueueForKind('ocs');
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
      this.dismissComicBubble(false);
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
    if (this.unreadSubscription) {
      this.unreadSubscription.unsubscribe();
    }
    if (this.ocsDupSubscription) {
      this.ocsDupSubscription.unsubscribe();
    }
    if (this.viewAsSubscription) {
      this.viewAsSubscription.unsubscribe();
    }
    this.recordSessionEnd();

    if (this.comicBubbleTimeoutId !== null) {
      window.clearTimeout(this.comicBubbleTimeoutId);
      this.comicBubbleTimeoutId = null;
    }
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
    // No resaltar controles del propio asistente (globo, badges, tours).
    if (element.closest('.helper-dog')) {
      return false;
    }

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
      this.showRadialMenu = false;
      if (this.showComicBubble) {
        this.dismissComicBubble(false);
        return;
      }
      if (this.showWoofMessage) {
        this.showWoofMessage = false;
        if (this.woofTimeoutId !== null) {
          window.clearTimeout(this.woofTimeoutId);
          this.woofTimeoutId = null;
        }
        return;
      }
      this.showWoof();
      return;
    }

    this.showWoofMessage = false;
    if (this.woofTimeoutId !== null) {
      window.clearTimeout(this.woofTimeoutId);
      this.woofTimeoutId = null;
    }

    const openingMenu = !this.showRadialMenu;
    this.showRadialMenu = !this.showRadialMenu;

    if (!openingMenu) {
      this.dismissComicBubble(false);
    }
  }

  /** Ejecuta el tour elegido y cierra el menú radial. */
  onTourClick(tour: TourDefinition, event?: MouseEvent): void {
    event?.stopPropagation();
    this.showRadialMenu = false;
    this.tourRegistry.runTour(tour.id);
  }

  /** Clic en badge rojo: globo y bandeja de tickets. */
  onTicketsBadgeClick(event?: MouseEvent): void {
    event?.stopPropagation();
    this.showRadialMenu = false;

    const text =
      this.unreadTicketsService.getBubbleMessage() ?? this.lastTicketsNotificationText;
    if (text) {
      this.enqueueComicBubble(
        {
          kind: 'tickets',
          title: 'Tickets en tu bandeja',
          text,
          firstLogin: false,
          anchoredByBadge: true
        },
        true
      );
    }

    void this.router.navigate(['/menu/tickets']);
  }

  /** Clic en badge naranja (OCS): globo y Configuración. */
  onOcsDupBadgeClick(event?: MouseEvent): void {
    event?.stopPropagation();
    this.showRadialMenu = false;

    const text =
      this.ocsDuplicatesAlertService.getBubbleMessage() ??
      this.lastOcsDupNotificationText;
    if (text) {
      this.enqueueComicBubble(
        {
          kind: 'ocs',
          title: 'Duplicados en OCS',
          text,
          firstLogin: false,
          anchoredByBadge: true
        },
        true
      );
    }

    void this.router.navigate(['/menu/settings'], {
      queryParams: { focus: 'ocs-duplicates', runSearch: '1' }
    });
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
    // Órbita proporcional a --dog-size (base 100px: 92 / 96 / 102).
    const orbitRatio = total <= 2 ? 0.92 : total === 3 ? 0.96 : 1.02;
    const radius = Math.round(HelperDogComponent.DOG_SIZE_PX * orbitRatio);
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
      this.dismissComicBubble(false);
    } else if (this.showComicBubble) {
      this.dismissComicBubble(false);
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
    this.dismissComicBubble(false);
    this.showWoofMessage = true;
    if (this.woofTimeoutId !== null) {
      window.clearTimeout(this.woofTimeoutId);
    }
    this.woofTimeoutId = window.setTimeout(() => {
      this.showWoofMessage = false;
      this.woofTimeoutId = null;
    }, 1400);
  }

  /**
   * Cola de globos: un solo cartel visible; tickets antes que OCS.
   * Evita apilar varios globos encima del perro.
   */
  private enqueueComicBubble(payload: ComicBubblePayload, immediate = false): void {
    if (immediate) {
      if (this.showComicBubble && this.comicBubbleKind !== payload.kind) {
        const suspended: ComicBubblePayload = {
          kind: this.comicBubbleKind,
          title: this.comicBubbleTitle,
          text: this.comicBubbleText,
          firstLogin: this.comicBubbleFirstLoginDismiss,
          anchoredByBadge: this.comicBubbleByBadge
        };
        this.comicBubbleQueue.push(suspended);
      }
      this.comicBubbleQueue.splice(
        0,
        this.comicBubbleQueue.length,
        ...this.comicBubbleQueue.filter((q) => q.kind !== payload.kind)
      );
      this.comicBubbleQueue.sort(
        (a, b) => COMIC_BUBBLE_KIND_PRIORITY[a.kind] - COMIC_BUBBLE_KIND_PRIORITY[b.kind]
      );
      this.closeComicBubbleVisual();
      this.comicBubbleQueue.unshift(payload);
      this.presentNextComicBubble();
      return;
    }

    if (this.showComicBubble && this.comicBubbleKind === payload.kind) {
      this.comicBubbleTitle = payload.title;
      this.comicBubbleText = payload.text;
      this.comicBubbleByBadge = payload.anchoredByBadge;
      this.comicBubbleFirstLoginDismiss = payload.firstLogin;
      this.scheduleComicBubbleClose(
        payload.firstLogin ? COMIC_BUBBLE_FIRST_LOGIN_MS : COMIC_BUBBLE_MS
      );
      this.syncComicQueueTotal();
      return;
    }

    this.comicBubbleQueue.splice(
      0,
      this.comicBubbleQueue.length,
      ...this.comicBubbleQueue.filter((q) => q.kind !== payload.kind),
      payload
    );
    this.comicBubbleQueue.sort(
      (a, b) => COMIC_BUBBLE_KIND_PRIORITY[a.kind] - COMIC_BUBBLE_KIND_PRIORITY[b.kind]
    );

    if (!this.showComicBubble) {
      this.presentNextComicBubble();
    } else {
      this.syncComicQueueTotal();
    }
  }

  private presentNextComicBubble(): void {
    const next = this.comicBubbleQueue.shift();
    if (!next) {
      this.closeComicBubbleVisual();
      return;
    }
    this.showWoofMessage = false;
    if (this.woofTimeoutId !== null) {
      window.clearTimeout(this.woofTimeoutId);
      this.woofTimeoutId = null;
    }
    this.comicBubbleKind = next.kind;
    this.comicBubbleTitle = next.title;
    this.comicBubbleText = next.text;
    this.comicBubbleByBadge = next.anchoredByBadge;
    this.comicBubbleFirstLoginDismiss = next.firstLogin;
    this.showComicBubble = true;
    this.syncComicQueueTotal();
    this.triggerBounce();
    this.scheduleComicBubbleClose(
      next.firstLogin ? COMIC_BUBBLE_FIRST_LOGIN_MS : COMIC_BUBBLE_MS
    );
  }

  private syncComicQueueTotal(): void {
    this.comicBubbleQueueTotal =
      (this.showComicBubble ? 1 : 0) + this.comicBubbleQueue.length;
  }

  private clearComicQueueForKind(kind: ComicBubbleKind): void {
    for (let i = this.comicBubbleQueue.length - 1; i >= 0; i--) {
      if (this.comicBubbleQueue[i].kind === kind) {
        this.comicBubbleQueue.splice(i, 1);
      }
    }
    if (this.showComicBubble && this.comicBubbleKind === kind) {
      this.dismissComicBubble(true);
    } else {
      this.syncComicQueueTotal();
    }
  }

  /** @param advance Si true, muestra el siguiente aviso en cola. */
  private dismissComicBubble(advance: boolean): void {
    this.closeComicBubbleVisual();
    if (advance) {
      this.presentNextComicBubble();
    } else {
      this.comicBubbleQueue.length = 0;
      this.comicBubbleQueueTotal = 0;
    }
  }

  private closeComicBubbleVisual(): void {
    this.showComicBubble = false;
    this.comicBubbleTitle = '';
    this.comicBubbleText = '';
    this.comicBubbleByBadge = false;
    this.comicBubbleFirstLoginDismiss = false;
    this.comicBubbleHovering = false;
    if (this.comicBubbleTimeoutId !== null) {
      window.clearTimeout(this.comicBubbleTimeoutId);
      this.comicBubbleTimeoutId = null;
    }
  }

  private scheduleComicBubbleClose(delayMs?: number): void {
    const dismissMs =
      delayMs ??
      (this.comicBubbleFirstLoginDismiss ? COMIC_BUBBLE_FIRST_LOGIN_MS : COMIC_BUBBLE_MS);
    if (this.comicBubbleTimeoutId !== null) {
      window.clearTimeout(this.comicBubbleTimeoutId);
    }
    this.comicBubbleTimeoutId = window.setTimeout(() => {
      if (!this.comicBubbleHovering) {
        this.dismissComicBubble(true);
      }
    }, dismissMs);
  }

  onComicBubbleMouseEnter(): void {
    this.comicBubbleHovering = true;
    if (this.comicBubbleTimeoutId !== null) {
      window.clearTimeout(this.comicBubbleTimeoutId);
      this.comicBubbleTimeoutId = null;
    }
  }

  onComicBubbleMouseLeave(): void {
    this.comicBubbleHovering = false;
    if (this.showComicBubble) {
      this.scheduleComicBubbleClose();
    }
  }

  onComicBubbleClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.comicBubbleKind === 'tickets') {
      void this.router.navigate(['/menu/tickets']);
    } else {
      void this.router.navigate(['/menu/settings'], {
        queryParams: { focus: 'ocs-duplicates', runSearch: '1' }
      });
    }
    this.dismissComicBubble(true);
  }

  get comicBubbleQueueLabel(): string {
    if (this.comicBubbleQueueTotal <= 1) {
      return '';
    }
    const current = this.comicBubbleQueueTotal - this.comicBubbleQueue.length;
    return `${current} de ${this.comicBubbleQueueTotal}`;
  }

  /**
   * Badge naranja de duplicados OCS: solo se muestra cuando el rol EFECTIVO
   * (incluye la simulación "ver como" de un GM) es GM o ADMIN. Si un GM activa
   * la vista como USER, el badge se oculta hasta que vuelva a su rol normal.
   */
  canSeeOcsDuplicateAlerts(): boolean {
    return this.permissionsService.isGMOrAdmin();
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