import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface MonitorInventario {
  id: number;
  hardwareId: number;
  pcName?: string;
  ipAddr?: string;
  userid?: string;
  manufacturer?: string;
  caption?: string;
  description?: string;
  type?: string;
  serial?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MonitorService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/monitor`;
  }

  getByHardwareId(hardwareId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/by-hardware`, { params: { hardwareId: hardwareId.toString() } });
  }

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getInventario(): Observable<MonitorInventario[]> {
    return this.http.get<MonitorInventario[]>(`${this.apiUrl}/inventario`);
  }
}
