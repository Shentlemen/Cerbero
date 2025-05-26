import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, forkJoin, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { ComprasService, CompraDTO } from './compras.service';
import { ProveedoresService, ProveedorDTO } from './proveedores.service';
import { ServiciosGarantiaService, ServicioGarantiaDTO } from './servicios-garantia.service';
import { ApiResponse } from '../interfaces/api-response.interface';

export interface LoteDTO {
  idItem: number;          // ID único del lote
  nombreItem: string;      // Nombre del ítem (nuevo campo requerido)
  idCompra: number;        // ID de la compra asociada
  descripcion: string;     // Descripción del lote
  cantidad: number;        // Cantidad de items en el lote
  mesesGarantia: number;   // Duración de la garantía en meses
  idProveedor: number;     // ID del proveedor
  idServicioGarantia: number; // ID del servicio de garantía
  compraDescripcion?: string; // Descripción de la compra asociada
  proveedorNombreComercial?: string; // Nombre comercial del proveedor
  servicioGarantiaNombreComercial?: string; // Nombre comercial del servicio de garantía
}

@Injectable({
  providedIn: 'root'
})
export class LotesService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private comprasService: ComprasService,
    private proveedoresService: ProveedoresService,
    private serviciosGarantiaService: ServiciosGarantiaService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/lotes`;
  }

  private validateId(id: number): boolean {
    return id !== undefined && id !== null && !isNaN(id) && id > 0;
  }

  private enrichLoteWithCompraInfo(lote: LoteDTO): Observable<LoteDTO> {
    return this.comprasService.getCompraById(lote.idCompra).pipe(
      switchMap(compra => 
        this.proveedoresService.getProveedor(lote.idProveedor).pipe(
          switchMap(proveedor =>
            this.serviciosGarantiaService.getServicioGarantia(lote.idServicioGarantia).pipe(
              map(servicioGarantia => ({
                ...lote,
                compraDescripcion: compra.descripcion,
                proveedorNombreComercial: proveedor.nombreComercial,
                servicioGarantiaNombreComercial: servicioGarantia.nombreComercial
              }))
            )
          )
        )
      )
    );
  }

  getLotes(): Observable<LoteDTO[]> {
    return this.http.get<ApiResponse<LoteDTO[]>>(this.apiUrl).pipe(
      switchMap(response => {
        if (response.success) {
          const enrichedLotes = response.data.map(lote => 
            this.enrichLoteWithCompraInfo(lote)
          );
          return forkJoin(enrichedLotes);
        } else {
          return throwError(() => new Error(response.message));
        }
      })
    );
  }

  getLote(id: number): Observable<LoteDTO> {
    if (!this.validateId(id)) {
      return throwError(() => new Error('ID de lote no válido'));
    }

    return this.http.get<ApiResponse<LoteDTO>>(`${this.apiUrl}/${id}`).pipe(
      switchMap(response => {
        if (response.success) {
          return this.enrichLoteWithCompraInfo(response.data);
        } else {
          return throwError(() => new Error(response.message));
        }
      })
    );
  }

  getLotesByCompra(idCompra: number): Observable<LoteDTO[]> {
    if (!this.validateId(idCompra)) {
      return throwError(() => new Error('ID de compra no válido'));
    }

    return this.http.get<ApiResponse<LoteDTO[]>>(`${this.apiUrl}/by-compra/${idCompra}`).pipe(
      switchMap(response => {
        if (response.success) {
          const enrichedLotes = response.data.map(lote => 
            this.enrichLoteWithCompraInfo(lote)
          );
          return forkJoin(enrichedLotes);
        } else {
          return throwError(() => new Error(response.message));
        }
      })
    );
  }

  getLotesByProveedor(idProveedor: number): Observable<LoteDTO[]> {
    if (!this.validateId(idProveedor)) {
      return throwError(() => new Error('ID de proveedor no válido'));
    }

    return this.http.get<ApiResponse<LoteDTO[]>>(`${this.apiUrl}/by-proveedor/${idProveedor}`).pipe(
      switchMap(response => {
        if (response.success) {
          const enrichedLotes = response.data.map(lote => 
            this.enrichLoteWithCompraInfo(lote)
          );
          return forkJoin(enrichedLotes);
        } else {
          return throwError(() => new Error(response.message));
        }
      })
    );
  }

  crearLote(lote: Omit<LoteDTO, 'idItem'>): Observable<LoteDTO> {
    return this.http.post<ApiResponse<LoteDTO>>(this.apiUrl, lote).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  actualizarLote(id: number, lote: Omit<LoteDTO, 'idItem'>): Observable<LoteDTO> {
    if (!this.validateId(id)) {
      return throwError(() => new Error('ID de lote no válido'));
    }

    return this.http.put<ApiResponse<LoteDTO>>(`${this.apiUrl}/${id}`, lote).pipe(
      switchMap(response => {
        if (response.success) {
          return this.enrichLoteWithCompraInfo(response.data);
        } else {
          return throwError(() => new Error(response.message));
        }
      })
    );
  }

  eliminarLote(id: number): Observable<void> {
    if (!this.validateId(id)) {
      return throwError(() => new Error('ID de lote no válido'));
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