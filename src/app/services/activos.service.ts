import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ActivoDTO {
  idActivo: number;
  hardwareId: number;
  criticidad: string;
  clasificacionDeINFO: string;
  estado: string;
  idTipoActivo: number;
  idNumeroCompra: number;
  idItem: number;
  idEntrega: number;
  idUbicacion: number;
  idUsuario: number;
  idSecundario: string;
  idServicioGarantia: number;
  fechaFinGarantia: string;
  activosRelacionados?: number[];
}

@Injectable({
  providedIn: 'root'
})
export class ActivosService {
  private apiUrl = `${environment.apiUrl}/activos`;

  constructor(private http: HttpClient) { }

  getActivos(): Observable<ActivoDTO[]> {
    return this.http.get<ActivoDTO[]>(this.apiUrl);
  }

  getActivo(id: number): Observable<ActivoDTO> {
    return this.http.get<ActivoDTO>(`${this.apiUrl}/${id}`);
  }

  crearActivo(activo: ActivoDTO): Observable<ActivoDTO> {
    return this.http.post<ActivoDTO>(this.apiUrl, activo);
  }

  actualizarActivo(id: number, activo: ActivoDTO): Observable<ActivoDTO> {
    return this.http.put<ActivoDTO>(`${this.apiUrl}/${id}`, activo);
  }

  eliminarActivo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getActivoByHardwareId(hardwareId: number): Observable<ActivoDTO> {
    return this.http.get<ActivoDTO>(`${this.apiUrl}/by-hardware/${hardwareId}`);
  }

  getActivosRelacionados(idActivo: number): Observable<number[]> {
    return this.http.get<number[]>(`${this.apiUrl}/${idActivo}/relaciones`);
  }

  getActivosByIds(ids: number[]): Observable<ActivoDTO[]> {
    return this.http.get<ActivoDTO[]>(`${this.apiUrl}/by-ids`, { params: { ids: ids.join(',') } });
  }

  agregarRelacion(idActivo: number, idActivoDestino: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${idActivo}/relaciones`, {
      idActivoOrigen: idActivo,
      idActivoDestino: idActivoDestino
    });
  }

  eliminarRelacion(idActivo: number, idActivoDestino: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${idActivo}/relaciones`, {
      body: {
        idActivoOrigen: idActivo,
        idActivoDestino: idActivoDestino
      }
    });
  }
} 