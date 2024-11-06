import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../services/config.service';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, NgbModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent {
  isSyncing = false;
  syncResult: any = null;
  error: string | null = null;
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private modalService: NgbModal
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/sync`;
  }

  mostrarConfirmacion(confirmModal: any) {
    this.modalService.open(confirmModal, { centered: true }).result.then(
      (result) => {
        if (result === 'confirm') {
          this.sincronizarBases();
        }
      },
      (reason) => {
        // Modal cerrado sin confirmar
      }
    );
  }

  async sincronizarBases() {
    this.isSyncing = true;
    this.error = null;
    this.syncResult = null;

    try {
      const response = await this.http.post(`${this.apiUrl}/sync-all`, {}).toPromise();
      this.syncResult = response;
    } catch (err: any) {
      this.error = err.message || 'Error durante la sincronización';
    } finally {
      this.isSyncing = false;
    }
  }
}
