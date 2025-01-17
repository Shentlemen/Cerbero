import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { tap } from 'rxjs/operators';

export interface SoftwareDTO {
  id: number;
  name: string;
  publisher: string;
  version: string;
  count: number;
  hidden: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SoftwareService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/software`;
  }

  getSoftwareWithCounts(): Observable<SoftwareDTO[]> {
    return this.http.get<SoftwareDTO[]>(`${this.apiUrl}/with-counts`).pipe(
      tap(software => console.log('Software cargado:', software))
    );
  }

  getHardwaresBySoftware(software: SoftwareDTO): Observable<number[]> {
    const params = new URLSearchParams({
      name: software.name,
      publisher: software.publisher,
      version: software.version
    });
    return this.http.get<number[]>(`${this.apiUrl}/hardwares?${params}`);
  }

  toggleSoftwareVisibility(software: SoftwareDTO, hidden: boolean): Observable<any> {
    return this.http.put(`${this.apiUrl}/${software.id}/visibility`, { hidden });
  }
} 