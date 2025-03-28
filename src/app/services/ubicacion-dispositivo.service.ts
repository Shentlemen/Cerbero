import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UbicacionDispositivoService {
  constructor(private http: HttpClient) {}

  getUbicacionByMacAddr(mac: string): Observable<any> {
    return this.http.get(`/api/ubicacion/${mac}`);
  }

  saveUbicacion(ubicacion: any): Observable<any> {
    return this.http.post('/api/ubicacion', ubicacion);
  }
} 