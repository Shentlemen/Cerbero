import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConfigService } from './config.service';

export interface Ubicacion {
  idUbicacion?: number;
  tipo?: 'EQUIPO' | 'DISPOSITIVO';
  hardwareId?: number;
  macaddr?: string;
  idSubnet?: number;
  subnet?: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  interno?: string;
  nombreGerencia?: string;
  nombreOficina?: string;
  piso?: string;
  numeroPuerta?: string;
}

export interface TipoUbicacion {
  idUbicacion: number;
  tipo: string;
  hardwareId?: number;
  macaddr?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UbicacionesService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = this.configService.getApiUrl();
  }

  getUbicaciones(): Observable<Ubicacion[]> {
    return this.http.get<Ubicacion[]>(`${this.apiUrl}/ubicaciones/simple`);
  }

  crearUbicacionEquipo(ubicacion: Ubicacion): Observable<Ubicacion> {
    return this.http.post<Ubicacion>(`${this.apiUrl}/ubicaciones/equipo`, ubicacion);
  }

  crearUbicacionDispositivo(ubicacion: Ubicacion): Observable<Ubicacion> {
    return this.http.post<Ubicacion>(`${this.apiUrl}/ubicaciones/dispositivo`, ubicacion);
  }

  getUbicacionByHardwareId(hardwareId: number): Observable<Ubicacion> {
    return this.http.get<Ubicacion>(`${this.apiUrl}/ubicaciones/equipos/${hardwareId}`);
  }

  getUbicacionByMacaddr(macaddr: string): Observable<Ubicacion> {
    return this.http.get<Ubicacion>(`${this.apiUrl}/ubicaciones/dispositivos/${macaddr}`);
  }

  crearUbicacionSimple(ubicacion: Ubicacion): Observable<Ubicacion> {
    return this.http.post<Ubicacion>(`${this.apiUrl}/ubicaciones/simple`, ubicacion);
  }

  crearTipoUbicacion(tipoUbicacion: TipoUbicacion): Observable<TipoUbicacion> {
    return this.http.post<TipoUbicacion>(`${this.apiUrl}/ubicaciones/tipos`, tipoUbicacion);
  }

  actualizarTipoUbicacion(idUbicacion: number, tipoUbicacion: TipoUbicacion): Observable<TipoUbicacion> {
    return this.http.put<TipoUbicacion>(`${this.apiUrl}/ubicaciones/tipos/${idUbicacion}`, tipoUbicacion);
  }

  eliminarUbicacion(idUbicacion: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/ubicaciones/${idUbicacion}`);
  }
} 