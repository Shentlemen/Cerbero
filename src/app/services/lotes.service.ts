import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, forkJoin } from 'rxjs';
import { ConfigService } from './config.service';
import { ComprasService, CompraDTO } from './compras.service';
import { ProveedoresService, ProveedorDTO } from './proveedores.service';
import { ServiciosGarantiaService, ServicioGarantiaDTO } from './servicios-garantia.service';

export interface LoteDTO {
  idItem: number;          // ID único del lote
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
    return this.http.get<LoteDTO[]>(this.apiUrl).pipe(
      switchMap(lotes => {
        const enrichedLotes = lotes.map(lote => 
          this.enrichLoteWithCompraInfo(lote)
        );
        return forkJoin(enrichedLotes);
      })
    );
  }

  getLote(id: number): Observable<LoteDTO> {
    return this.http.get<LoteDTO>(`${this.apiUrl}/${id}`).pipe(
      switchMap(lote => this.enrichLoteWithCompraInfo(lote))
    );
  }

  getLotesByCompra(idCompra: number): Observable<LoteDTO[]> {
    return this.http.get<LoteDTO[]>(`${this.apiUrl}/by-compra/${idCompra}`).pipe(
      switchMap(lotes => {
        const enrichedLotes = lotes.map(lote => 
          this.enrichLoteWithCompraInfo(lote)
        );
        return forkJoin(enrichedLotes);
      })
    );
  }

  getLotesByProveedor(idProveedor: number): Observable<LoteDTO[]> {
    return this.http.get<LoteDTO[]>(`${this.apiUrl}/by-proveedor/${idProveedor}`).pipe(
      switchMap(lotes => {
        const enrichedLotes = lotes.map(lote => 
          this.enrichLoteWithCompraInfo(lote)
        );
        return forkJoin(enrichedLotes);
      })
    );
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