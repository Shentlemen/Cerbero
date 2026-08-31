import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
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

  /**
   * Búsqueda avanzada cruzando storages/drives/cpus/bios.
   * Solo envía params definidos (AND en backend).
   */
  advancedSearch(filters: {
    diskType?: string;
    osName?: string;
    processor?: string;
    minDiskUsagePercent?: number;
    ramGb?: number;
    ramOp?: string;
    smanufacturer?: string;
    staleDays?: number;
  }): Observable<any[]> {
    const params: Record<string, string> = {};
    if (filters.diskType) params['diskType'] = filters.diskType;
    if (filters.osName) params['osName'] = filters.osName;
    if (filters.processor) params['processor'] = filters.processor;
    if (filters.minDiskUsagePercent != null && filters.minDiskUsagePercent !== undefined) {
      params['minDiskUsagePercent'] = String(filters.minDiskUsagePercent);
    }
    if (filters.ramGb != null && filters.ramGb !== undefined && filters.ramOp) {
      params['ramGb'] = String(filters.ramGb);
      params['ramOp'] = filters.ramOp;
    }
    if (filters.smanufacturer) params['smanufacturer'] = filters.smanufacturer;
    if (filters.staleDays != null && filters.staleDays !== undefined) {
      params['staleDays'] = String(filters.staleDays);
    }
    return this.http.get<any[]>(`${this.apiUrl}/advanced-search`, { params });
  }

  getHardwareByIds(ids: number[]): Observable<any[]> {
    return this.http.post<any[]>(`${this.apiUrl}/by-ids`, { ids });
  }

  // Obtener solo hardware activo (excluye equipos dados de baja y en almacén)
  getActiveHardware(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      switchMap(hardwareList => {
        // Obtener todos los IDs inactivos (cementerio + almacén) en una sola llamada
        return this.estadoEquipoService.getHardwareIdsInactivos().pipe(
          catchError(error => {
            console.warn('⚠️ Error al obtener IDs inactivos, usando array vacío:', error);
            return of({ success: false, data: [] });
          }),
          map(response => {
            // Obtener los IDs inactivos de la respuesta
            const idsInactivos = (response?.success && Array.isArray(response.data)) ? response.data : [];
            
            // Crear conjunto de IDs a excluir
            const idsToExclude = new Set(idsInactivos);
            
            // Filtrar hardware activo: mostrar todos EXCEPTO los inactivos
            const activeHardware = hardwareList.filter(hardware => !idsToExclude.has(hardware.id));
            
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
