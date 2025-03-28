import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface EntregaDTO {
  idEntrega: number;
  idItem: number;
  cantidad: number;
  descripcion: string;
  fechaPedido: string;
  fechaFinGarantia: string;
}

@Injectable({
  providedIn: 'root'
})
export class EntregasService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/entregas`;
  }

  getEntregas(): Observable<EntregaDTO[]> {
    return this.http.get<EntregaDTO[]>(this.apiUrl);
  }

  getEntrega(id: number): Observable<EntregaDTO> {
    return this.http.get<EntregaDTO>(`${this.apiUrl}/${id}`);
  }

  getEntregasByItem(idItem: number): Observable<EntregaDTO[]> {
    return this.http.get<EntregaDTO[]>(`${this.apiUrl}/by-item/${idItem}`);
  }

  crearEntrega(entrega: Omit<EntregaDTO, 'idEntrega'>): Observable<EntregaDTO> {
    return this.http.post<EntregaDTO>(this.apiUrl, entrega);
  }

  actualizarEntrega(id: number, entrega: Omit<EntregaDTO, 'idEntrega'>): Observable<EntregaDTO> {
    return this.http.put<EntregaDTO>(`${this.apiUrl}/${id}`, entrega);
  }

  eliminarEntrega(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
} 