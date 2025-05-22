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
  count?: number;
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
  getHardwaresBySoftware(software: SoftwareDTO): Observable<number[]> {
    return this.http.get<ApiResponse<number[]>>(`${this.apiUrl}/${software.idSoftware}/hardware`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Crear software
  createSoftware(software: Omit<SoftwareDTO, 'idSoftware' | 'count'>): Observable<SoftwareDTO> {
    return this.http.post<ApiResponse<SoftwareDTO>>(this.apiUrl, software).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Actualizar software
  updateSoftware(id: number, software: Omit<SoftwareDTO, 'idSoftware' | 'count'>): Observable<SoftwareDTO> {
    return this.http.put<ApiResponse<SoftwareDTO>>(`${this.apiUrl}/${id}`, software).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  // Eliminar software
  deleteSoftware(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message);
        }
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
} 