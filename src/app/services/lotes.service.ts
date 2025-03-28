import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface LoteDTO {
  idItem: number;          // ID único del lote
  idCompra: number;        // ID de la compra asociada
  descripcion: string;     // Descripción del lote
  cantidad: number;        // Cantidad de items en el lote
  mesesGarantia: number;   // Duración de la garantía en meses
  idProveedor: number;     // ID del proveedor
  idServicioGarantia: number; // ID del servicio de garantía
}

@Injectable({
  providedIn: 'root'
})
export class LotesService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/lotes`;
  }

  getLotes(): Observable<LoteDTO[]> {
    return this.http.get<LoteDTO[]>(this.apiUrl);
  }

  getLote(id: number): Observable<LoteDTO> {
    return this.http.get<LoteDTO>(`${this.apiUrl}/${id}`);
  }

  getLotesByCompra(idCompra: number): Observable<LoteDTO[]> {
    return this.http.get<LoteDTO[]>(`${this.apiUrl}/by-compra/${idCompra}`);
  }

  getLotesByProveedor(idProveedor: number): Observable<LoteDTO[]> {
    return this.http.get<LoteDTO[]>(`${this.apiUrl}/by-proveedor/${idProveedor}`);
  }

  crearLote(lote: Omit<LoteDTO, 'idItem'>): Observable<string> {
    return this.http.post<string>(this.apiUrl, lote);
  }

  actualizarLote(id: number, lote: LoteDTO): Observable<string> {
    return this.http.put<string>(`${this.apiUrl}/${id}`, lote);
  }

  eliminarLote(id: number): Observable<string> {
    return this.http.delete<string>(`${this.apiUrl}/${id}`);
  }
} 