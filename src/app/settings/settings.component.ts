import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../services/config.service';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

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
  syncMessage: string = '';
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
    this.syncMessage = '';

    try {
      const response = await this.http.post<ApiResponse<any>>(`${this.apiUrl}/sync-all`, {}).toPromise();
      
      if (response) {
        this.syncResult = response.data; // Los resultados detallados están en data
        this.syncMessage = response.message; // El mensaje general está en message
      }
    } catch (err: any) {
      this.error = err.message || 'Error durante la sincronización';
    } finally {
      this.isSyncing = false;
    }
  }

  getResultClass(value: any): string {
    if (typeof value === 'string') {
      if (value.includes('exitos')) return 'text-success';
      if (value.includes('Error')) return 'text-warning';
    }
    return '';
  }
}
