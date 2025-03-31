import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, forkJoin } from 'rxjs';
import { ConfigService } from './config.service';
import { LotesService, LoteDTO } from './lotes.service';

export interface EntregaDTO {
  idEntrega: number;
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

  private enrichEntregaWithLoteInfo(entrega: EntregaDTO): Observable<EntregaDTO> {
    return this.lotesService.getLote(entrega.idItem).pipe(
      map((lote: LoteDTO) => ({
        ...entrega,
        loteDescripcion: lote.descripcion
      }))
    );
  }

  getEntregas(): Observable<EntregaDTO[]> {
    return this.http.get<EntregaDTO[]>(this.apiUrl).pipe(
      switchMap(entregas => {
        const enrichedEntregas = entregas.map(entrega => 
          this.enrichEntregaWithLoteInfo(entrega)
        );
        return forkJoin(enrichedEntregas);
      })
    );
  }

  getEntrega(id: number): Observable<EntregaDTO> {
    return this.http.get<EntregaDTO>(`${this.apiUrl}/${id}`).pipe(
      switchMap(entrega => this.enrichEntregaWithLoteInfo(entrega))
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
    return this.http.post<EntregaDTO>(this.apiUrl, entrega).pipe(
      switchMap(newEntrega => this.enrichEntregaWithLoteInfo(newEntrega))
    );
  }

  actualizarEntrega(id: number, entrega: Omit<EntregaDTO, 'idEntrega'>): Observable<EntregaDTO> {
    return this.http.put<EntregaDTO>(`${this.apiUrl}/${id}`, entrega).pipe(
      switchMap(updatedEntrega => this.enrichEntregaWithLoteInfo(updatedEntrega))
    );
  }

  eliminarEntrega(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
} 