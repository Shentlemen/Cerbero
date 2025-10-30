import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getVersionInfo } from '../../version';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="app-footer" [class.visible]="isVisible">
      <div class="footer-content">
        <span class="app-name">{{ versionInfo.codename }}</span>
        <span class="build-info">{{ versionInfo.buildInfo }}</span>
      </div>
    </footer>
  `,
  styles: [`
    .app-footer {
      background: linear-gradient(135deg, #2c3e50, #34495e);
      color: #ecf0f1;
      padding: 0.5rem 0;
      border-top: 1px solid #34495e;
      font-size: 0.75rem;
      position: fixed;
      bottom: -50px; /* Oculto por defecto */
      left: 220px; /* Empieza después del menú lateral */
      right: 0;
      width: calc(100% - 220px); /* Ancho menos el menú */
      z-index: 1000;
      margin-top: auto;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s ease;
    }

    .app-footer.visible {
      bottom: 0;
      opacity: 1;
      transform: translateY(0);
    }

    @keyframes slideInFooter {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .footer-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
      text-align: center;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
    }

    .app-name {
      color: #f39c12;
      font-weight: 600;
      font-style: italic;
      font-size: 0.9rem;
    }

    .build-info {
      color: #bdc3c7;
      font-family: 'Courier New', monospace;
      font-size: 0.8rem;
      background: rgba(255, 255, 255, 0.1);
      padding: 0.2rem 0.5rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    @media (max-width: 768px) {
      .app-footer {
        left: 0;
        width: 100%;
      }
      
      .footer-content {
        padding: 0 0.5rem;
        flex-direction: column;
        gap: 0.5rem;
      }
    }
  `]
})
export class AppFooterComponent implements OnInit, OnDestroy {
  versionInfo = getVersionInfo();
  isVisible = false;
  private lastScrollY = 0;
  private scrollThreshold = 100; // Píxeles de scroll para activar el comportamiento inteligente

  constructor() {
    console.log('🔍 Footer Component - Versión cargada:', this.versionInfo);
    console.log('📋 Versión actual:', this.versionInfo.displayVersion);
    console.log('🏗️ Build:', this.versionInfo.buildInfo);
    console.log('🎯 Codename:', this.versionInfo.codename);
  }

  ngOnInit() {
    // Mostrar el footer después de un pequeño delay para que la página cargue
    setTimeout(() => {
      this.checkScrollPosition();
    }, 1000);
  }

  ngOnDestroy() {
    // Cleanup si es necesario
  }

  @HostListener('window:scroll', ['$event'])
  onWindowScroll() {
    this.checkScrollPosition();
  }

  private checkScrollPosition() {
    const scrollY = window.scrollY || window.pageYOffset;
    const documentHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;
    
    // Determinar dirección del scroll
    const isScrollingDown = scrollY > this.lastScrollY;
    const isScrollingUp = scrollY < this.lastScrollY;
    
    // Guardar posición actual para la próxima comparación
    this.lastScrollY = scrollY;
    
    // Lógica del footer inteligente:
    // 1. Si está cerca del final de la página, siempre mostrar
    const isNearBottom = scrollY + windowHeight >= documentHeight - 50;
    
    // 2. Si está en la parte superior, ocultar
    const isAtTop = scrollY < this.scrollThreshold;
    
    // 3. Si está scrolleando hacia arriba, mostrar
    // 4. Si está scrolleando hacia abajo, ocultar
    if (isNearBottom || isAtTop) {
      this.isVisible = isNearBottom; // Mostrar solo si está cerca del final
    } else {
      this.isVisible = isScrollingUp; // Mostrar solo si está scrolleando hacia arriba
    }
  }
} 