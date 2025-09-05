import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiResponse } from '../interfaces/api-response.interface';
import { map } from 'rxjs/operators';

export interface CompraDTO {
  idCompra: number;
  numeroCompra: string;
  idTipoCompra: number;
  descripcion: string;
  fechaInicio: string;
  fechaFinal: string;
  monto: number;
  moneda: string;
  ano?: number;
  valorDolar?: number;
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
    return this.http.get<ApiResponse<CompraDTO[]>>(this.apiUrl).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  getCompraById(id: number): Observable<CompraDTO> {
    return this.http.get<ApiResponse<CompraDTO>>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  crearCompra(compra: CompraDTO): Observable<CompraDTO> {
    return this.http.post<ApiResponse<CompraDTO>>(this.apiUrl, compra).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  actualizarCompra(id: number, compra: CompraDTO): Observable<string> {
    return this.http.put<ApiResponse<null>>(`${this.apiUrl}/${id}`, compra).pipe(
      map(response => {
        if (response.success) {
          return response.message;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  eliminarCompra(id: number): Observable<string> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        if (response.success) {
          return response.message;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }
} 