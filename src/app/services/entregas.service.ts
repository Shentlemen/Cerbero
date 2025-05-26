import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, forkJoin, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { LotesService, LoteDTO } from './lotes.service';
import { ApiResponse } from '../interfaces/api-response.interface';

export interface EntregaDTO {
  idEntrega?: number;
  idItem: number;
  cantidad: number;
  descripcion: string;
  fechaPedido: string;
  fechaFinGarantia: string;
  loteDescripcion?: string; // Descripción del lote asociado
}

@Injectable({
  providedIn: 'root'
})
export class EntregasService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private lotesService: LotesService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/entregas`;
  }

  private validateId(id: number): boolean {
    return id !== undefined && id !== null && !isNaN(id) && id > 0;
  }

  private enrichEntregaWithLoteInfo(entrega: EntregaDTO): Observable<EntregaDTO> {
    return this.lotesService.getLote(entrega.idItem).pipe(
      map((lote: LoteDTO) => ({
        ...entrega,
        loteDescripcion: lote.descripcion
      }))
    );
  }

  getEntregas(): Observable<EntregaDTO[]> {
    return this.http.get<ApiResponse<EntregaDTO[]>>(this.apiUrl).pipe(
      switchMap(response => {
        if (response.success) {
          const enrichedEntregas = response.data.map(entrega => 
            this.enrichEntregaWithLoteInfo(entrega)
          );
          return forkJoin(enrichedEntregas);
        } else {
          return throwError(() => new Error(response.message));
        }
      })
    );
  }

  getEntrega(id: number): Observable<EntregaDTO> {
    if (!this.validateId(id)) {
      return throwError(() => new Error('ID de entrega no válido'));
    }

    return this.http.get<ApiResponse<EntregaDTO>>(`${this.apiUrl}/${id}`).pipe(
      switchMap(response => {
        if (response.success) {
          return this.enrichEntregaWithLoteInfo(response.data);
        } else {
          return throwError(() => new Error(response.message));
        }
      })
    );
  }

  getEntregasByItem(idItem: number): Observable<EntregaDTO[]> {
    return this.http.get<EntregaDTO[]>(`${this.apiUrl}/by-item/${idItem}`).pipe(
      switchMap(entregas => {
        const enrichedEntregas = entregas.map(entrega => 
          this.enrichEntregaWithLoteInfo(entrega)
        );
        return forkJoin(enrichedEntregas);
      })
    );
  }

  crearEntrega(entrega: Omit<EntregaDTO, 'idEntrega'>): Observable<EntregaDTO> {
    return this.http.post<ApiResponse<EntregaDTO>>(this.apiUrl, entrega).pipe(
      switchMap(response => {
        if (response.success) {
          return this.enrichEntregaWithLoteInfo(response.data);
        } else {
          return throwError(() => new Error(response.message));
        }
      })
    );
  }

  actualizarEntrega(id: number, entrega: EntregaDTO): Observable<EntregaDTO> {
    if (!this.validateId(id)) {
      return throwError(() => new Error('ID de entrega no válido'));
    }

    // Removemos el idEntrega del body si existe
    const { idEntrega, ...entregaSinId } = entrega;

    return this.http.put<ApiResponse<EntregaDTO>>(`${this.apiUrl}/${id}`, entregaSinId).pipe(
      switchMap(response => {
        if (response.success) {
          return this.enrichEntregaWithLoteInfo(response.data);
        } else {
          return throwError(() => new Error(response.message));
        }
      })
    );
  }

  eliminarEntrega(id: number): Observable<void> {
    if (!this.validateId(id)) {
      return throwError(() => new Error('ID de entrega no válido'));
    }

    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message);
        }
      })
    );
  }
} 