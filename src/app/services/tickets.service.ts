import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TicketEstado =
  | 'NUEVO'
  | 'EN_REVISION'
  | 'EN_GESTION'
  | 'DERIVADO'
  | 'RESUELTO'
  | 'CERRADO'
  | 'REABIERTO';

export type TicketPrioridad = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export interface Ticket {
  id: number;
  codigo: string;
  titulo: string;
  descripcion: string;
  estado: TicketEstado;
  prioridad: TicketPrioridad;
  areaActual: string;
  creadoPorUserId: number;
  asignadoAUserId?: number | null;
  fechaCreacion: string;
  fechaActualizacion: string;
  fechaCierre?: string | null;
}

export interface TicketMovimiento {
  id: number;
  ticketId: number;
  tipoEvento: 'CREACION' | 'CAMBIO_ESTADO' | 'CAMBIO_AREA' | 'NOTA';
  estadoAnterior?: TicketEstado | null;
  estadoNuevo?: TicketEstado | null;
  areaAnterior?: string | null;
  areaNueva?: string | null;
  nota?: string | null;
  usuarioId?: number | null;
  fechaEvento: string;
}

export interface TicketComentario {
  id: number;
  ticketId: number;
  usuarioId: number;
  comentario: string;
  esInterno: boolean;
  fechaComentario: string;
}

export interface TicketMovimientoView {
  movimiento: TicketMovimiento;
  usuarioNombre: string;
}

export interface TicketComentarioView {
  comentario: TicketComentario;
  usuarioNombre: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class TicketsService {
  private apiUrl = `${environment.apiUrl}/tickets`;

  constructor(private http: HttpClient) {}

  listar(estado?: TicketEstado): Observable<ApiResponse<Ticket[]>> {
    let params = new HttpParams();
    if (estado) {
      params = params.set('estado', estado);
    }
    return this.http.get<ApiResponse<Ticket[]>>(this.apiUrl, { params });
  }

  /** Todos los tickets en estado CERRADO (sin filtro por área; cualquier rol con acceso a tickets). */
  listarCerrados(): Observable<ApiResponse<Ticket[]>> {
    return this.http.get<ApiResponse<Ticket[]>>(`${this.apiUrl}/cerrados`);
  }

  crear(payload: {
    titulo: string;
    descripcion: string;
    areaDestino: string;
    prioridad: TicketPrioridad;
    nota?: string;
  }): Observable<ApiResponse<Ticket>> {
    return this.http.post<ApiResponse<Ticket>>(this.apiUrl, payload);
  }

  obtener(ticketId: number): Observable<ApiResponse<Ticket>> {
    return this.http.get<ApiResponse<Ticket>>(`${this.apiUrl}/${ticketId}`);
  }

  cambiarEstado(ticketId: number, estado: TicketEstado, nota?: string): Observable<ApiResponse<Ticket>> {
    return this.http.post<ApiResponse<Ticket>>(`${this.apiUrl}/${ticketId}/estado`, { estado, nota });
  }

  cambiarArea(ticketId: number, areaDestino: string, nota?: string): Observable<ApiResponse<Ticket>> {
    return this.http.post<ApiResponse<Ticket>>(`${this.apiUrl}/${ticketId}/area`, { areaDestino, nota });
  }

  agregarComentario(ticketId: number, comentario: string, interno = false): Observable<ApiResponse<TicketComentario>> {
    return this.http.post<ApiResponse<TicketComentario>>(`${this.apiUrl}/${ticketId}/comentarios`, {
      comentario,
      interno
    });
  }

  historial(ticketId: number): Observable<ApiResponse<TicketMovimientoView[]>> {
    return this.http.get<ApiResponse<TicketMovimientoView[]>>(`${this.apiUrl}/${ticketId}/historial`);
  }

  comentarios(ticketId: number): Observable<ApiResponse<TicketComentarioView[]>> {
    return this.http.get<ApiResponse<TicketComentarioView[]>>(`${this.apiUrl}/${ticketId}/comentarios`);
  }
}

