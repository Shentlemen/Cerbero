import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface EstadoDispositivo {
  id?: number;
  mac: string;
  tipo: 'EQUIPO' | 'DISPOSITIVO';
  baja: boolean;
  almacen: boolean;
  fechaCambio: string;
  usuarioCambio?: string;
  observaciones?: string;
}

export interface CambioEstadoDispositivoRequest {
  observaciones: string;
  usuario: string;
}

@Injectable({
  providedIn: 'root'
})
export class EstadoDispositivoService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = this.configService.getApiUrl();
  }

  // Obtener dispositivos en baja
  getDispositivosEnBaja(): Observable<any> {
    return this.http.get(`${this.apiUrl}/estado-dispositivos/baja`);
  }

  // Dar de baja un dispositivo
  darDeBaja(mac: string, request: CambioEstadoDispositivoRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/estado-dispositivos/baja/${mac}`, request);
  }

  // Enviar a almacén
  enviarAAlmacen(mac: string, request: CambioEstadoDispositivoRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/estado-dispositivos/almacen/${mac}`, request);
  }

  // Reactivar dispositivo
  reactivarDispositivo(mac: string, request: CambioEstadoDispositivoRequest): Observable<any> {
    console.log('🔧 Servicio: Reactivando dispositivo con MAC:', mac);
    console.log('🔧 Servicio: Request:', request);
    console.log('🔧 Servicio: URL:', `${this.apiUrl}/estado-dispositivos/reactivar/${mac}`);
    
    return this.http.post(`${this.apiUrl}/estado-dispositivos/reactivar/${mac}`, request);
  }

  // Eliminar dispositivo de OCS
  eliminarDispositivo(mac: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/estado-dispositivos/${mac}`);
  }
} 