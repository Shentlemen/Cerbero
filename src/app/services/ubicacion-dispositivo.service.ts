import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class UbicacionDispositivoService {
  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) { }

  getUbicacionByMacAddr(mac: string): Observable<any> {
    const apiUrl = this.configService.getApiUrl();
    return this.http.get(`${apiUrl}/ubicacion-dispositivo/${mac}`);
  }

  saveUbicacion(ubicacion: any): Observable<any> {
    const apiUrl = this.configService.getApiUrl();
    return this.http.post(`${apiUrl}/ubicacion-dispositivo`, ubicacion);
  }
} 