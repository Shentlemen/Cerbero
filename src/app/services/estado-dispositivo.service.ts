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
  almacenId?: number;
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

  // Obtener dispositivos en almacén
  getDispositivosEnAlmacen(): Observable<any> {
    return this.http.get(`${this.apiUrl}/estado-dispositivos/almacen`);
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

  // Actualizar observaciones
  actualizarObservaciones(mac: string, observaciones: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/estado-dispositivos/${mac}/observaciones`, { observaciones });
  }

  // Transferir dispositivo
  transferirDispositivo(mac: string, transferData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/estado-dispositivos/${mac}/transferir`, transferData);
  }

  // Obtener dispositivos por almacen_id
  getDispositivosPorAlmacenId(almacenId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/estado-dispositivos/por-almacen/${almacenId}`);
  }

  // Obtener MACs inactivas (en baja O en almacén - para filtrar gráficas)
  getMacsInactivas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/estado-dispositivos/macs/inactivas`);
  }
} 