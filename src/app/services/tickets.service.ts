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
  tipoEvento:
    | 'CREACION'
    | 'CAMBIO_ESTADO'
    | 'CAMBIO_AREA'
    | 'CAMBIO_ESTADO_Y_AREA'
    | 'NOTA';
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

export interface TicketAdjunto {
  id: number;
  ticketId: number;
  usuarioId: number;
  nombreArchivoOriginal: string;
  tipoArchivo: string;
  tamanoArchivo: number;
  descripcion?: string | null;
  fechaCreacion: string;
}

export interface TicketAdjuntoView {
  adjunto: TicketAdjunto;
  usuarioNombre: string;
}

/** Tope alineado con `spring.servlet.multipart.max-file-size=10MB`. */
export const TICKET_ADJUNTOS_MAX_BYTES = 10 * 1024 * 1024;

export const TICKET_ADJUNTOS_MIME_PERMITIDOS: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

export const TICKET_ADJUNTOS_EXT_PERMITIDAS: readonly string[] = [
  'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'
];

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

  /** Estado y área en un solo paso; un solo ítem en historial. */
  cambiarEstadoYArea(
    ticketId: number,
    estado: TicketEstado,
    areaDestino: string,
    nota?: string
  ): Observable<ApiResponse<Ticket>> {
    return this.http.post<ApiResponse<Ticket>>(`${this.apiUrl}/${ticketId}/estado-area`, { estado, areaDestino, nota }, {
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

  listarAdjuntos(ticketId: number): Observable<ApiResponse<TicketAdjuntoView[]>> {
    return this.http.get<ApiResponse<TicketAdjuntoView[]>>(
      `${this.apiUrl}/${ticketId}/adjuntos`,
      { params: this.withVistaComo() }
    );
  }

  subirAdjunto(
    ticketId: number,
    archivo: File,
    descripcion?: string
  ): Observable<ApiResponse<TicketAdjunto>> {
    const form = new FormData();
    form.append('archivo', archivo);
    if (descripcion && descripcion.trim()) {
      form.append('descripcion', descripcion.trim());
    }
    return this.http.post<ApiResponse<TicketAdjunto>>(
      `${this.apiUrl}/${ticketId}/adjuntos`,
      form,
      { params: this.withVistaComo() }
    );
  }

  eliminarAdjunto(adjuntoId: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(
      `${this.apiUrl}/adjuntos/${adjuntoId}`,
      { params: this.withVistaComo() }
    );
  }

  /**
   * Borrado total del ticket (incluye comentarios, historial, lecturas y archivos adjuntos).
   * El backend rechaza si el rol efectivo no es GM/Admin; aun así, el frontend oculta el
   * botón a roles que no corresponden para no exponer la operación.
   */
  eliminarTicket(ticketId: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(
      `${this.apiUrl}/${ticketId}`,
      { params: this.withVistaComo() }
    );
  }

  /** URL para previsualizar inline (img / iframe). El backend valida permisos via JWT. */
  getAdjuntoVerUrl(adjuntoId: number): string {
    return `${this.apiUrl}/adjuntos/${adjuntoId}/ver`;
  }

  getAdjuntoDescargarUrl(adjuntoId: number): string {
    return `${this.apiUrl}/adjuntos/${adjuntoId}/descargar`;
  }

  /** Tickets no leidos en mi bandeja (LABORATORIO para GM/Admin; mi area para los demas). */
  contarNoLeidos(): Observable<ApiResponse<{ count: number }>> {
    return this.http.get<ApiResponse<{ count: number }>>(`${this.apiUrl}/no-leidos`, {
      params: this.withVistaComo()
    });
  }

  /** Marca como leido el ticket para el usuario actual (upsert con fecha = ahora). */
  marcarTicketLeido(ticketId: number): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(
      `${this.apiUrl}/${ticketId}/marcar-leido`,
      null,
      { params: this.withVistaComo() }
    );
  }

  /**
   * Mapa `ticketId -> cantidad de adjuntos activos`, solo para tickets que tengan al menos uno.
   * Lo usa la bandeja para mostrar el icono de clip por fila sin pedir adjuntos por ticket.
   * El backend devuelve las claves como string (JSON keys son strings), por eso lo tipamos asi.
   */
  contarAdjuntosPorTicket(): Observable<ApiResponse<Record<string, number>>> {
    return this.http.get<ApiResponse<Record<string, number>>>(`${this.apiUrl}/adjuntos-counts`);
  }

  /**
   * IDs de tickets activos que el usuario actual aun no leyo (o que cambiaron desde la ultima vez).
   * La bandeja lo usa para resaltar visualmente las filas tipo "email no leido".
   */
  obtenerIdsNoLeidos(): Observable<ApiResponse<number[]>> {
    return this.http.get<ApiResponse<number[]>>(`${this.apiUrl}/ids-no-leidos`);
  }
}
