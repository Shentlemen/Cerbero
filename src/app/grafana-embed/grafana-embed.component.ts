import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-grafana-embed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './grafana-embed.component.html',
  styleUrls: ['./grafana-embed.component.css']
})
export class GrafanaEmbedComponent {
  readonly grafanaUrl: SafeResourceUrl;
  readonly configuredUrl = (environment.grafanaEmbedUrl || '').trim();

  constructor() {
    const sanitizer = inject(DomSanitizer);
    this.grafanaUrl = sanitizer.bypassSecurityTrustResourceUrl(this.configuredUrl);
  }
}
