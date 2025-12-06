import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EstadoEquipo {
  id?: number;
  hardwareId: number;
  baja: boolean;
  almacen: boolean;
  fechaCambio?: string;
  observaciones?: string;
  usuarioCambio?: string;
  almacenId?: number;
}

export interface CambioEstadoRequest {
  observaciones: string;
  usuario: string;
}

export interface EstadoInfo {
  estadoTexto: string;
  isActivo: boolean;
  isEnBaja: boolean;
  isEnAlmacen: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EstadoEquipoService {
  private apiUrl = `${environment.apiUrl}/estado-equipos`;

  constructor(private http: HttpClient) { }

  // Obtener todos los estados
  getAllEstados(): Observable<any> {
    return this.http.get(`${this.apiUrl}`);
  }

  // Obtener estado por hardware ID
  getEstadoByHardwareId(hardwareId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/hardware/${hardwareId}`);
  }

  // Obtener equipos en baja
  getEquiposEnBaja(): Observable<any> {
    return this.http.get(`${this.apiUrl}/en-baja`);
  }

  // Obtener equipos en almacén
  getEquiposEnAlmacen(): Observable<any> {
    return this.http.get(`${this.apiUrl}/en-almacen`);
  }

  // Obtener equipos activos
  getEquiposActivos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/activos`);
  }

  // Dar de baja un equipo
  darDeBaja(hardwareId: number, request: CambioEstadoRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/${hardwareId}/dar-baja`, request);
  }

  // Enviar equipo a almacén
  enviarAAlmacen(hardwareId: number, request: CambioEstadoRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/${hardwareId}/enviar-almacen`, request);
  }

  // Reactivar equipo
  reactivarEquipo(hardwareId: number, request: CambioEstadoRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/${hardwareId}/reactivar`, request);
  }

  // Obtener información completa del estado
  getEstadoInfo(hardwareId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${hardwareId}/estado`);
  }

  // Obtener IDs de hardware activos
  getHardwareIdsActivos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/hardware-ids/activos`);
  }

  // Obtener IDs de hardware en baja
  getHardwareIdsEnBaja(): Observable<any> {
    return this.http.get(`${this.apiUrl}/hardware-ids/en-baja`);
  }

  // Obtener IDs de hardware en almacén
  getHardwareIdsEnAlmacen(): Observable<any> {
    return this.http.get(`${this.apiUrl}/hardware-ids/en-almacen`);
  }

  // Obtener todos los IDs de hardware inactivos (cementerio + almacén) - para filtrar gráficas
  getHardwareIdsInactivos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/hardware-ids/inactivos`);
  }

  // Eliminar estado (solo admins)
  eliminarEstado(hardwareId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${hardwareId}`);
  }

  // Actualizar observaciones
  actualizarObservaciones(hardwareId: number, observaciones: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${hardwareId}/observaciones`, { observaciones });
  }

  // Transferir equipo
  transferirEquipo(hardwareId: number, transferData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${hardwareId}/transferir`, transferData);
  }

  // Obtener equipos por almacen_id
  getEquiposPorAlmacenId(almacenId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/por-almacen/${almacenId}`);
  }
} 