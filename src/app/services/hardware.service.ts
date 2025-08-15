import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';
import { EstadoEquipoService } from './estado-equipo.service';

@Injectable({
  providedIn: 'root'
})
export class HardwareService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService,
    private estadoEquipoService: EstadoEquipoService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/hardware`;
  }

  // Método para obtener la lista de assets desde el back-end
  getHardware(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getHardwareById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  getHardwareByManufacturer(smanufacturer: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/by-manufacturer`, { params: { smanufacturer } });
  }

  filterHardware(filters: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/filter`, { params: filters });
  }

  getHardwareByIds(ids: number[]): Observable<any[]> {
    return this.http.post<any[]>(`${this.apiUrl}/by-ids`, { ids });
  }

  // Obtener solo hardware activo (excluye equipos dados de baja y en almacén)
  getActiveHardware(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      switchMap(hardwareList => {
        // Obtener IDs de equipos dados de baja y almacén
        return forkJoin([
          this.estadoEquipoService.getHardwareIdsEnBaja().pipe(
            catchError(error => {
              console.warn('⚠️ Error al obtener IDs en baja, usando array vacío:', error);
              return of({ success: false, data: [] });
            })
          ),
          this.estadoEquipoService.getHardwareIdsEnAlmacen().pipe(
            catchError(error => {
              console.warn('⚠️ Error al obtener IDs en almacén, usando array vacío:', error);
              return of({ success: false, data: [] });
            })
          )
        ]).pipe(
          map(([bajasResponse, almacenResponse]) => {
            // Solo obtener los IDs si la respuesta es exitosa, sino usar array vacío
            const idsEnBaja = (bajasResponse?.success && Array.isArray(bajasResponse.data)) ? bajasResponse.data : [];
            const idsEnAlmacen = (almacenResponse?.success && Array.isArray(almacenResponse.data)) ? almacenResponse.data : [];
            
            // Crear conjunto de IDs a excluir (solo los que están marcados como baja o almacén)
            const idsToExclude = new Set([...idsEnBaja, ...idsEnAlmacen]);
            
            // Filtrar hardware activo: mostrar todos EXCEPTO los que están en baja o almacén
            // Los equipos SIN registro en estado_equipos se consideran ACTIVOS
            const activeHardware = hardwareList.filter(hardware => !idsToExclude.has(hardware.id));
            
            console.log(`📊 Hardware total: ${hardwareList?.length || 0}, En baja: ${idsEnBaja.length}, En almacén: ${idsEnAlmacen.length}, Activos: ${activeHardware.length}`);
            
            return activeHardware;
          })
        );
      }),
      catchError(error => {
        console.error('❌ Error al obtener hardware base:', error);
        return of([]); // Devolver array vacío en caso de error crítico
      })
    );
  }

  // Eliminar hardware y todos sus registros relacionados
  deleteHardwareComplete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}/complete`);
  }
}
