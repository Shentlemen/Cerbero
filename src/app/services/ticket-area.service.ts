import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { ApiResponse } from '../interfaces/api-response.interface';

export interface TicketAreaDTO {
  id: number;
  codigo: string;
  nombre: string;
  rolAsociado: string;
  activa: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TicketAreaService {
  private apiUrl: string;
  private ticketsApiUrl: string;
  private readonly areasActivasSubject = new BehaviorSubject<TicketAreaDTO[]>([]);
  /** Lista compartida (filtro de bandeja, derivar ticket, etc.). */
  readonly areasActivas$ = this.areasActivasSubject.asObservable();

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/ticket-areas`;
    this.ticketsApiUrl = `${this.configService.getApiUrl()}/tickets`;
  }

  /** Refresca desde el servidor y publica en {@link areasActivas$}. */
  refreshAreasActivas(): Observable<TicketAreaDTO[]> {
    return this.http
      .get<ApiResponse<TicketAreaDTO[]>>(`${this.ticketsApiUrl}/areas-activas`)
      .pipe(
        map((r) => (r.success ? r.data ?? [] : [])),
        tap((list) => this.areasActivasSubject.next(list)),
        catchError((err) => {
          console.warn('[TicketAreaService] No se pudieron cargar áreas activas', err);
          return of([]);
        })
      );
  }

  listarActivas(): Observable<TicketAreaDTO[]> {
    return this.refreshAreasActivas();
  }

  getAreasActivasSnapshot(): TicketAreaDTO[] {
    return this.areasActivasSubject.value;
  }

  private mapHttpError(err: unknown, fallback: string): Error {
    if (err instanceof HttpErrorResponse) {
      const bodyMsg =
        typeof err.error?.message === 'string'
          ? err.error.message
          : typeof err.error?.error === 'string'
            ? err.error.error
            : null;
      if (err.status === 401 || err.status === 403) {
        return new Error(
          'Sesión inválida o sin permiso (GM/ADMIN). Cerrá sesión y volvé a entrar.'
        );
      }
      if (err.status === 400 && bodyMsg) {
        return new Error(bodyMsg);
      }
      return new Error(bodyMsg || fallback);
    }
    if (err instanceof Error) {
      return err;
    }
    return new Error(fallback);
  }

  listarTodasAdmin(): Observable<TicketAreaDTO[]> {
    return this.http.get<ApiResponse<TicketAreaDTO[]>>(this.apiUrl).pipe(
      map((r) => {
        if (r.success) return r.data ?? [];
        throw new Error(r.message || 'Error al cargar bandejas');
      }),
      catchError((err) => throwError(() => this.mapHttpError(err, 'No se pudieron cargar las bandejas')))
    );
  }

  listarAsignables(): Observable<TicketAreaDTO[]> {
    return this.http.get<ApiResponse<TicketAreaDTO[]>>(`${this.apiUrl}/asignables`).pipe(
      map((r) => (r.success ? r.data ?? [] : []))
    );
  }

  crear(codigo: string, nombre: string): Observable<TicketAreaDTO> {
    return this.http.post<ApiResponse<TicketAreaDTO>>(this.apiUrl, { codigo, nombre }).pipe(
      map((r) => {
        if (r.success && r.data) return r.data;
        throw new Error(r.message || 'No se pudo crear la bandeja');
      }),
      catchError((err) => throwError(() => this.mapHttpError(err, 'No se pudo crear la bandeja')))
    );
  }

  actualizar(id: number, payload: { nombre?: string; activa?: boolean }): Observable<TicketAreaDTO> {
    return this.http.put<ApiResponse<TicketAreaDTO>>(`${this.apiUrl}/${id}`, payload).pipe(
      map((r) => {
        if (r.success && r.data) return r.data;
        throw new Error(r.message || 'No se pudo actualizar');
      }),
      catchError((err) => throwError(() => this.mapHttpError(err, 'No se pudo actualizar')))
    );
  }

  desactivar(id: number): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.apiUrl}/${id}/desactivar`, {}).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message || 'No se pudo desactivar');
      }),
      catchError((err) => throwError(() => this.mapHttpError(err, 'No se pudo desactivar')))
    );
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<ApiResponse<unknown>>(`${this.apiUrl}/${id}`).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message || 'No se pudo eliminar');
      }),
      catchError((err) => throwError(() => this.mapHttpError(err, 'No se pudo eliminar')))
    );
  }
}
