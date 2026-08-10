import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, TicketEstado } from './tickets.service';

export interface TicketTipoDTO {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  esComun: boolean;
  activo: boolean;
  tieneFlujoPublicado: boolean;
  versionPublicada?: number | null;
}

export interface FlujoNodoDTO {
  id: string;
  kind: 'inicio' | 'etapa' | 'fin' | string;
  x: number;
  y: number;
  label?: string;
  bandeja?: string;
  /** Estado al llegar / estar en esta etapa. */
  estado?: TicketEstado | null;
  estadoFinal?: TicketEstado | null;
}

export interface FlujoAristaDTO {
  id: string;
  source: string;
  target: string;
  label: string;
  estado?: TicketEstado | null;
  notaPlantilla?: string | null;
}

export interface FlujoDefinicionDTO {
  nodes: FlujoNodoDTO[];
  edges: FlujoAristaDTO[];
}

@Injectable({ providedIn: 'root' })
export class TicketTipoService {
  private apiUrl = `${environment.apiUrl}/ticket-tipos`;

  constructor(private http: HttpClient) {}

  listarActivos(): Observable<TicketTipoDTO[]> {
    return this.http.get<ApiResponse<TicketTipoDTO[]>>(`${this.apiUrl}/activos`).pipe(
      map((r) => (r.success && r.data ? r.data : []))
    );
  }

  listarTodosAdmin(): Observable<TicketTipoDTO[]> {
    return this.http.get<ApiResponse<TicketTipoDTO[]>>(this.apiUrl).pipe(
      map((r) => {
        if (!r.success) {
          throw new Error(r.message || 'No se pudieron cargar los tipos');
        }
        return r.data || [];
      })
    );
  }

  crear(codigo: string, nombre: string, descripcion?: string): Observable<TicketTipoDTO> {
    return this.http.post<ApiResponse<TicketTipoDTO>>(this.apiUrl, { codigo, nombre, descripcion }).pipe(
      map((r) => {
        if (!r.success || !r.data) {
          throw new Error(r.message || 'No se pudo crear el tipo');
        }
        return r.data;
      })
    );
  }

  actualizar(
    id: number,
    payload: { nombre?: string; descripcion?: string; activo?: boolean }
  ): Observable<TicketTipoDTO> {
    return this.http.put<ApiResponse<TicketTipoDTO>>(`${this.apiUrl}/${id}`, payload).pipe(
      map((r) => {
        if (!r.success || !r.data) {
          throw new Error(r.message || 'No se pudo actualizar el tipo');
        }
        return r.data;
      })
    );
  }

  obtenerBorrador(id: number): Observable<FlujoDefinicionDTO> {
    return this.http.get<ApiResponse<FlujoDefinicionDTO>>(`${this.apiUrl}/${id}/borrador`).pipe(
      map((r) => {
        if (!r.success || !r.data) {
          throw new Error(r.message || 'No se pudo cargar el borrador');
        }
        return r.data;
      })
    );
  }

  guardarBorrador(id: number, borrador: FlujoDefinicionDTO): Observable<FlujoDefinicionDTO> {
    return this.http.put<ApiResponse<FlujoDefinicionDTO>>(`${this.apiUrl}/${id}/borrador`, borrador).pipe(
      map((r) => {
        if (!r.success || !r.data) {
          throw new Error(r.message || 'No se pudo guardar el borrador');
        }
        return r.data;
      }),
      catchError((err) => throwError(() => new Error(this.extraerMensajeHttp(err))))
    );
  }

  publicar(id: number): Observable<TicketTipoDTO> {
    return this.http.post<ApiResponse<TicketTipoDTO>>(`${this.apiUrl}/${id}/publicar`, {}).pipe(
      map((r) => {
        if (!r.success || !r.data) {
          throw new Error(r.message || 'No se pudo publicar el flujo');
        }
        return r.data;
      }),
      catchError((err) => throwError(() => new Error(this.extraerMensajeHttp(err))))
    );
  }

  private extraerMensajeHttp(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | string | null;
      if (typeof body === 'string' && body.trim()) {
        return body;
      }
      if (body && typeof body === 'object' && typeof body.message === 'string' && body.message.trim()) {
        return body.message;
      }
      return err.message || `Error HTTP ${err.status}`;
    }
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return 'Error de red';
  }
}
