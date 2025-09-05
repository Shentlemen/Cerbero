import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';

export interface SoftwareDTO {
  idSoftware: number;
  nombre: string;
  publisher: string;
  version: string;
  hidden: boolean;
  forbidden: boolean;
  driver: boolean;
  licenciado: boolean;
  hardwareId?: number;
  count?: number;
}

export interface SoftwareWithCountDTO extends SoftwareDTO {
  count: number;
}

// Interfaz para respuesta paginada - actualizada para coincidir con el backend
export interface PaginatedSoftwareResponse {
  content: SoftwareDTO[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
}

// Parámetros para paginación
export interface SoftwarePaginationParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  filter?: 'total' | 'hidden' | 'forbidden' | 'driver' | 'licenciado';
  search?: string;
}

// Interfaz para contadores de software
export interface SoftwareCounters {
  total: number;
  hidden: number;
  forbidden: number;
  driver: number;
  licenciado: number;
}

@Injectable({
  providedIn: 'root'
})
export class SoftwareService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/software`;
  }

  // Obtener lista de software
  getSoftwareList(): Observable<SoftwareDTO[]> {
    return this.http.get<ApiResponse<SoftwareDTO[]>>(this.apiUrl)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          return response.data;
        })
      );
  }

  // Obtener todos los software con conteo de hardware
  getSoftwareWithCounts(): Observable<SoftwareDTO[]> {
    return this.http.get<ApiResponse<SoftwareDTO[]>>(`${this.apiUrl}/stats`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Obtener todos los software con conteo y atributos (hidden, forbidden, driver, licenciado)
  getAllSoftwareWithCountAndAttributes(): Observable<SoftwareDTO[]> {
    return this.http.get<ApiResponse<SoftwareDTO[]>>(`${this.apiUrl}/stats/all`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Obtener software visible (no oculto, no prohibido) con conteo
  getVisibleSoftwareWithCounts(): Observable<SoftwareDTO[]> {
    return this.http.get<ApiResponse<SoftwareDTO[]>>(`${this.apiUrl}/stats/visible`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Obtener software paginado con filtros - VERSIÓN REAL
  getSoftwarePaginated(params: SoftwarePaginationParams = {}): Observable<PaginatedSoftwareResponse> {
    const queryParams = new URLSearchParams();
    
    // Parámetros de paginación
    queryParams.set('page', (params.page || 0).toString());
    queryParams.set('size', (params.size || 20).toString());
    
    // Parámetros de ordenamiento
    if (params.sort) {
      queryParams.set('sort', params.sort);
      queryParams.set('direction', params.direction || 'asc');
    }
    
    // Parámetros de filtro
    if (params.filter && params.filter !== 'total') {
      queryParams.set('filter', params.filter);
    }
    
    // Parámetro de búsqueda
    if (params.search) {
      queryParams.set('search', params.search);
    }

    return this.http.get<PaginatedSoftwareResponse>(`${this.apiUrl}/paginated?${queryParams.toString()}`);
  }

  // Obtener contadores de software
  getSoftwareCounters(): Observable<SoftwareCounters> {
    return this.http.get<ApiResponse<SoftwareCounters>>(`${this.apiUrl}/counters`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Obtener software oculto con conteo
  getHiddenSoftwareWithCounts(): Observable<SoftwareDTO[]> {
    return this.http.get<ApiResponse<SoftwareDTO[]>>(`${this.apiUrl}/stats/hidden`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Obtener software prohibido con conteo
  getForbiddenSoftwareWithCounts(): Observable<SoftwareDTO[]> {
    return this.http.get<ApiResponse<SoftwareDTO[]>>(`${this.apiUrl}/stats/forbidden`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Obtener software driver con conteo
  getDriverSoftwareWithCounts(): Observable<SoftwareDTO[]> {
    return this.http.get<ApiResponse<SoftwareDTO[]>>(`${this.apiUrl}/stats/driver`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Obtener software licenciado con conteo
  getLicenciadoSoftwareWithCounts(): Observable<SoftwareDTO[]> {
    return this.http.get<ApiResponse<SoftwareDTO[]>>(`${this.apiUrl}/stats/licenciado`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Obtener software por ID
  getSoftwareById(id: number): Observable<SoftwareDTO> {
    return this.http.get<ApiResponse<SoftwareDTO>>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Buscar software por nombre
  searchSoftware(nombre: string): Observable<SoftwareDTO[]> {
    return this.http.get<ApiResponse<SoftwareDTO[]>>(`${this.apiUrl}/search?nombre=${encodeURIComponent(nombre)}`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Obtener software por hardware
  getSoftwareByHardware(hardwareId: number): Observable<SoftwareDTO[]> {
    return this.http.get<ApiResponse<SoftwareDTO[]>>(`${this.apiUrl}/hardware/${hardwareId}`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Obtener conteo de hardware por software
  getHardwareCount(softwareId: number): Observable<number> {
    return this.http.get<ApiResponse<number>>(`${this.apiUrl}/${softwareId}/hardware-count`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Obtener lista de hardware por software
  getHardwaresBySoftware(softwareInfo: { idSoftware: number }): Observable<number[]> {
    return this.http.get<ApiResponse<number[]>>(`${this.apiUrl}/${softwareInfo.idSoftware}/hardware`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          return response.data || [];
        })
      );
  }

  // Crear software
  crearSoftware(software: Omit<SoftwareDTO, 'idSoftware'>): Observable<SoftwareDTO> {
    return this.http.post<ApiResponse<SoftwareDTO>>(this.apiUrl, software)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          return response.data;
        })
      );
  }

  // Actualizar software
  actualizarSoftware(id: number, software: SoftwareDTO): Observable<SoftwareDTO> {
    return this.http.put<ApiResponse<SoftwareDTO>>(`${this.apiUrl}/${id}`, software)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          return response.data;
        })
      );
  }

  // Eliminar software
  eliminarSoftware(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          return;
        })
      );
  }

  // Toggle hidden
  toggleHidden(id: number): Observable<SoftwareDTO> {
    return this.http.put<ApiResponse<SoftwareDTO>>(`${this.apiUrl}/${id}/toggle-hidden`, {})
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
          return response.data;
        })
      );
  }

  // Métodos legacy para compatibilidad
  createSoftware(software: Omit<SoftwareDTO, 'idSoftware' | 'count'>): Observable<SoftwareDTO> {
    return this.crearSoftware(software);
  }

  updateSoftware(id: number, software: Omit<SoftwareDTO, 'idSoftware' | 'count'>): Observable<SoftwareDTO> {
    return this.actualizarSoftware(id, software as SoftwareDTO);
  }

  deleteSoftware(software: SoftwareDTO): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${software.idSoftware}`).pipe(
      map(response => {
        if (!response || !response.success) {
          throw new Error(response?.message || 'Error al eliminar software');
        }
        return;
      })
    );
  }

  // Actualizar visibilidad
  toggleSoftwareVisibility(software: SoftwareDTO, hidden: boolean): Observable<SoftwareDTO> {
    return this.http.patch<ApiResponse<void>>(`${this.apiUrl}/${software.idSoftware}/visibility`, { hidden }).pipe(
      map(response => {
        if (!response || !response.success) {
          throw new Error(response?.message || 'Error al actualizar la visibilidad');
        }
        // Devolvemos el software actualizado con el nuevo estado de hidden
        return { ...software, hidden };
      })
    );
  }

  // Alternar estado prohibido
  toggleSoftwareForbidden(software: SoftwareDTO): Observable<SoftwareWithCountDTO> {
    return this.http.put<ApiResponse<SoftwareWithCountDTO>>(`${this.apiUrl}/${software.idSoftware}/toggle-forbidden`, {}).pipe(
      map(response => {
        if (!response || !response.success) {
          throw new Error(response?.message || 'Error al alternar el estado prohibido');
        }
        return response.data;
      })
    );
  }

  // Alternar estado driver
  toggleSoftwareDriver(software: SoftwareDTO): Observable<SoftwareWithCountDTO> {
    return this.http.put<ApiResponse<SoftwareWithCountDTO>>(`${this.apiUrl}/${software.idSoftware}/toggle-driver`, {}).pipe(
      map(response => {
        if (!response || !response.success) {
          throw new Error(response?.message || 'Error al alternar el estado driver');
        }
        return response.data;
      })
    );
  }

  // Alternar estado licenciado
  toggleSoftwareLicenciado(software: SoftwareDTO): Observable<SoftwareWithCountDTO> {
    return this.http.put<ApiResponse<SoftwareWithCountDTO>>(`${this.apiUrl}/${software.idSoftware}/toggle-licenciado`, {}).pipe(
      map(response => {
        if (!response || !response.success) {
          throw new Error(response?.message || 'Error al alternar el estado licenciado');
        }
        return response.data;
      })
    );
  }
} 