import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface TipoDeCompraDTO {
  idTipoCompra: number;
  descripcion: string;
}

@Injectable({
  providedIn: 'root'
})
export class TiposCompraService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.apiUrl}/tipos-compra`;
  }

  getTiposCompra(): Observable<TipoDeCompraDTO[]> {
    return this.http.get<TipoDeCompraDTO[]>(this.apiUrl);
  }

  getTipoCompra(id: number): Observable<TipoDeCompraDTO> {
    return this.http.get<TipoDeCompraDTO>(`${this.apiUrl}/${id}`);
  }

  crearTipoCompra(tipoCompra: Omit<TipoDeCompraDTO, 'idTipoCompra'>): Observable<string> {
    return this.http.post<string>(this.apiUrl, tipoCompra);
  }

  actualizarTipoCompra(id: number, tipoCompra: TipoDeCompraDTO): Observable<string> {
    return this.http.put<string>(`${this.apiUrl}/${id}`, tipoCompra);
  }

  eliminarTipoCompra(id: number): Observable<string> {
    return this.http.delete<string>(`${this.apiUrl}/${id}`);
  }
} 