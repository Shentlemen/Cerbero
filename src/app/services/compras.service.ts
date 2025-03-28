import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface CompraDTO {
  idCompra: number;
  idTipoCompra: number;
  descripcion: string;
  fechaInicio: string;
  fechaFinal: string;
  monto: number;
  moneda: string;
}

@Injectable({
  providedIn: 'root'
})
export class ComprasService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/compras`;
  }

  getCompras(): Observable<CompraDTO[]> {
    return this.http.get<CompraDTO[]>(this.apiUrl);
  }

  getCompraById(id: number): Observable<CompraDTO> {
    return this.http.get<CompraDTO>(`${this.apiUrl}/${id}`);
  }

  crearCompra(compra: CompraDTO): Observable<CompraDTO> {
    return this.http.post<CompraDTO>(this.apiUrl, compra);
  }

  actualizarCompra(id: number, compra: CompraDTO): Observable<CompraDTO> {
    return this.http.put<CompraDTO>(`${this.apiUrl}/${id}`, compra);
  }

  eliminarCompra(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
} 