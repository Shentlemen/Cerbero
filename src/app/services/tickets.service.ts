import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PermissionsService } from './permissions.service';

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

  constructor(
    private http: HttpClient,
    private permissionsService: PermissionsService
  ) {}

  /** Solo GM real + «Ver como»: el backend aplica permisos del rol simulado. */
  private withVistaComo(base?: HttpParams): HttpParams {
    let p = base ?? new HttpParams();
    const sim = this.permissionsService.getViewAsRole();
    if (this.permissionsService.isRealGM() && sim) {
      p = p.set('vistaComo', sim);
    }
    return p;
  }

  /**
   * @param bandeja `area` = tickets en la bandeja del rol (vacío para USER); `creados` = creados por el usuario.
   */
  listar(estado?: TicketEstado, bandeja?: 'area' | 'creados'): Observable<ApiResponse<Ticket[]>> {
    let params = this.withVistaComo();
    if (estado) {
      params = params.set('estado', estado);
    }
    if (bandeja) {
      params = params.set('bandeja', bandeja);
    }
    return this.http.get<ApiResponse<Ticket[]>>(this.apiUrl, { params });
  }

  listarCerrados(): Observable<ApiResponse<Ticket[]>> {
    return this.http.get<ApiResponse<Ticket[]>>(`${this.apiUrl}/cerrados`, {
      params: this.withVistaComo()
    });
  }

  crear(payload: {
    titulo: string;
    descripcion: string;
    areaDestino: string;
    prioridad: TicketPrioridad;
    nota?: string;
  }): Observable<ApiResponse<Ticket>> {
    return this.http.post<ApiResponse<Ticket>>(this.apiUrl, payload, {
      params: this.withVistaComo()
    });
  }

  obtener(ticketId: number): Observable<ApiResponse<Ticket>> {
    return this.http.get<ApiResponse<Ticket>>(`${this.apiUrl}/${ticketId}`, {
      params: this.withVistaComo()
    });
  }

  cambiarEstado(ticketId: number, estado: TicketEstado, nota?: string): Observable<ApiResponse<Ticket>> {
    return this.http.post<ApiResponse<Ticket>>(`${this.apiUrl}/${ticketId}/estado`, { estado, nota }, {
      params: this.withVistaComo()
    });
  }

  cambiarArea(ticketId: number, areaDestino: string, nota?: string): Observable<ApiResponse<Ticket>> {
    return this.http.post<ApiResponse<Ticket>>(`${this.apiUrl}/${ticketId}/area`, { areaDestino, nota }, {
      params: this.withVistaComo()
    });
  }

  agregarComentario(ticketId: number, comentario: string, interno = false): Observable<ApiResponse<TicketComentario>> {
    return this.http.post<ApiResponse<TicketComentario>>(`${this.apiUrl}/${ticketId}/comentarios`, {
      comentario,
      interno
    }, {
      params: this.withVistaComo()
    });
  }

  historial(ticketId: number): Observable<ApiResponse<TicketMovimientoView[]>> {
    return this.http.get<ApiResponse<TicketMovimientoView[]>>(`${this.apiUrl}/${ticketId}/historial`, {
      params: this.withVistaComo()
    });
  }

  comentarios(ticketId: number): Observable<ApiResponse<TicketComentarioView[]>> {
    return this.http.get<ApiResponse<TicketComentarioView[]>>(`${this.apiUrl}/${ticketId}/comentarios`, {
      params: this.withVistaComo()
    });
  }
}
