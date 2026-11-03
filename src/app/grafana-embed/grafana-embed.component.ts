import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment';
import { PageSkeletonComponent } from '../components/page-skeleton/page-skeleton.component';

@Component({
  selector: 'app-grafana-embed',
  standalone: true,
  imports: [CommonModule, PageSkeletonComponent],
  templateUrl: './grafana-embed.component.html',
  styleUrls: ['./grafana-embed.component.css']
})
export class GrafanaEmbedComponent {
  readonly grafanaUrl: SafeResourceUrl;
  readonly configuredUrl = (environment.grafanaEmbedUrl || '').trim();
  iframeReady = false;

  constructor() {
    const sanitizer = inject(DomSanitizer);
    this.grafanaUrl = sanitizer.bypassSecurityTrustResourceUrl(this.configuredUrl);
  }
}
