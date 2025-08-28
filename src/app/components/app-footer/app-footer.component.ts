import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getVersionInfo } from '../../version';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="app-footer">
      <div class="footer-content">
        <div class="version-info">
          <span class="version-badge">{{ versionInfo.displayVersion }}</span>
          <span class="build-info">{{ versionInfo.buildInfo }}</span>
        </div>
        <div class="footer-details">
          <span class="codename">{{ versionInfo.codename }}</span>
          <span class="separator">•</span>
          <span class="company">{{ versionInfo.company }}</span>
          <span class="separator">•</span>
          <span class="copyright">{{ versionInfo.copyright }}</span>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .app-footer {
      background: linear-gradient(135deg, #2c3e50, #34495e);
      color: #ecf0f1;
      padding: 1rem 0;
      margin-top: auto;
      border-top: 1px solid #34495e;
      font-size: 0.85rem;
      /* Estilo temporal para debug */
      border: 2px solid #e74c3c;
      position: relative;
      z-index: 1000;
    }

    .footer-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
      text-align: center;
    }

    .version-info {
      margin-bottom: 0.5rem;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
    }

    .version-badge {
      background: linear-gradient(135deg, #3498db, #2980b9);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 15px;
      font-weight: 600;
      font-size: 0.9rem;
      box-shadow: 0 2px 4px rgba(52, 152, 219, 0.3);
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

    .footer-details {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .codename {
      color: #f39c12;
      font-weight: 600;
      font-style: italic;
    }

    .separator {
      color: #7f8c8d;
      font-weight: 300;
    }

    .company {
      color: #ecf0f1;
      font-weight: 500;
    }

    .copyright {
      color: #95a5a6;
      font-size: 0.8rem;
    }

    @media (max-width: 768px) {
      .footer-content {
        padding: 0 0.5rem;
      }
      
      .version-info {
        flex-direction: column;
        gap: 0.5rem;
      }
      
      .footer-details {
        flex-direction: column;
        gap: 0.5rem;
      }
      
      .separator {
        display: none;
      }
    }
  `]
})
export class AppFooterComponent {
  versionInfo = getVersionInfo();

  constructor() {
    console.log('🔍 Footer Component - Versión cargada:', this.versionInfo);
    console.log('📋 Versión actual:', this.versionInfo.displayVersion);
    console.log('🏗️ Build:', this.versionInfo.buildInfo);
    console.log('🎯 Codename:', this.versionInfo.codename);
  }
} 