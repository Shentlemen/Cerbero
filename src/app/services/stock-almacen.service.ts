import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BaseRestService } from './base-rest.service';
import { NotificationService } from './notification.service';
import { map } from 'rxjs/operators';
import { StockAlmacenCreateWithItem } from '../interfaces/stock-almacen.interface';

export interface StockAlmacen {
  id: number;
  item: {
    idItem: number;
    nombreItem: string;
    descripcion?: string;
  };
  almacen: {
    id: number;
    numero: string;
    nombre: string;
  };
  estanteria: string;
  estante: string;
  descripcion?: string;
  cantidad: number;
  numero?: string;
  fechaRegistro: string;
}

export interface StockAlmacenCreate {
  idCompra: number;
  itemId: number;
  almacenId: number;
  estanteria: string;
  estante: string;
  cantidad: number;
  numero?: string;
  descripcion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StockAlmacenService extends BaseRestService {
  protected apiUrl = `${environment.apiUrl}/stock-almacen`;

  constructor(
    http: HttpClient,
    notificationService: NotificationService
  ) {
    super(http, notificationService);
  }

  // ✅ OBTENER TODO EL STOCK
  getAllStock(): Observable<StockAlmacen[]> {
    return this.getList<StockAlmacen>();
  }

  // ✅ OBTENER STOCK POR ID
  getStockById(id: number): Observable<StockAlmacen> {
    return this.getById<StockAlmacen>(id);
  }

  // ✅ OBTENER STOCK POR ITEM ID
  getStockByItemId(itemId: number): Observable<StockAlmacen[]> {
    return this.getList<StockAlmacen>(`item/${itemId}`);
  }

  // ✅ OBTENER STOCK POR ALMACÉN
  getStockByAlmacenId(almacenId: number): Observable<StockAlmacen[]> {
    return this.getList<StockAlmacen>(`almacen/${almacenId}`);
  }

  // ✅ CREAR STOCK
  createStock(stock: StockAlmacenCreate): Observable<StockAlmacen> {
    return this.post<StockAlmacen>(stock).pipe(
      map(result => {
        this.showSuccessMessage('Stock creado exitosamente');
        return result;
      })
    );
  }

  // ✅ ACTUALIZAR STOCK
  updateStock(id: number, stock: StockAlmacenCreate): Observable<void> {
    return this.put<void>(id, stock).pipe(
      map(result => {
        this.showSuccessMessage('Stock actualizado exitosamente');
        return result;
      })
    );
  }

  // ✅ ELIMINAR STOCK
  deleteStock(id: number): Observable<void> {
    return this.delete<void>(id).pipe(
      map(result => {
        this.showSuccessMessage('Stock eliminado exitosamente');
        return result;
      })
    );
  }

  // ✅ ELIMINAR STOCK POR ITEM ID
  deleteStockByItemId(itemId: number): Observable<void> {
    return this.delete<void>(itemId, `item`).pipe(
      map(result => {
        this.showSuccessMessage('Stock del item eliminado exitosamente');
        return result;
      })
    );
  }

  // ✅ CREAR STOCK EN LOTE
  createStockBatch(stockItems: StockAlmacenCreate[]): Observable<StockAlmacen[]> {
    const batchRequest = { stockItems: stockItems };
    return this.http.post<StockAlmacen[]>(`${this.apiUrl}/batch`, batchRequest).pipe(
      map(result => {
        this.showSuccessMessage(`Se crearon exitosamente ${result.length} items de stock`);
        return result;
      })
    );
  }

  // ✅ ACTUALIZAR CANTIDAD DE STOCK
  updateStockQuantity(id: number, cantidad: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/cantidad`, { cantidad }).pipe(
      map(result => {
        this.showSuccessMessage('Cantidad de stock actualizada exitosamente');
        return result;
      })
    );
  }

  // ✅ OBTENER STOCK CON FILTROS
  getStockWithFilters(filters: {
    almacenId?: number;
    itemId?: number;
    estanteria?: string;
    estante?: string;
  }): Observable<StockAlmacen[]> {
    const params = new URLSearchParams();
    if (filters.almacenId) params.append('almacenId', filters.almacenId.toString());
    if (filters.itemId) params.append('itemId', filters.itemId.toString());
    if (filters.estanteria) params.append('estanteria', filters.estanteria);
    if (filters.estante) params.append('estante', filters.estante);
    
    return this.http.get<StockAlmacen[]>(`${this.apiUrl}/filtros?${params.toString()}`);
  }

  // ✅ CREAR STOCK CON INFORMACIÓN DEL ÍTEM DIRECTAMENTE
  createStockWithItem(stock: StockAlmacenCreateWithItem): Observable<StockAlmacen> {
    // Convertir a StockAlmacenCreate para el backend
    const stockCreate: StockAlmacenCreate = {
      idCompra: stock.compraId, // Mapear compraId a idCompra
      itemId: stock.itemId, // El itemId ya viene correcto del frontend
      almacenId: stock.almacenId,
      estanteria: stock.estanteria,
      estante: stock.estante,
      cantidad: stock.cantidad,
      numero: stock.numero
    };
    
    return this.post<StockAlmacen>(stockCreate).pipe(
      map(result => {
        this.showSuccessMessage('Stock creado exitosamente');
        return result;
      })
    );
  }
} 