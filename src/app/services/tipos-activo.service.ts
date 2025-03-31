import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface TipoDeActivoDTO {
    idActivo: number;      // ID único del tipo de activo
    nombre: string;        // Nombre del tipo de activo
    descripcion: string;   // Descripción del tipo de activo
    idUsuario: number;     // ID del usuario responsable (FK a usuario)
}

@Injectable({
  providedIn: 'root'
})
export class TiposActivoService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/tipos-activo`;
  }

  getTiposActivo(): Observable<TipoDeActivoDTO[]> {
    return this.http.get<TipoDeActivoDTO[]>(this.apiUrl);
  }

  getTipoActivo(id: number): Observable<TipoDeActivoDTO> {
    return this.http.get<TipoDeActivoDTO>(`${this.apiUrl}/${id}`);
  }

  getTiposActivoByUsuario(idUsuario: number): Observable<TipoDeActivoDTO[]> {
    return this.http.get<TipoDeActivoDTO[]>(`${this.apiUrl}/by-usuario/${idUsuario}`);
  }

  crearTipoActivo(tipoActivo: Omit<TipoDeActivoDTO, 'idActivo'>): Observable<string> {
    return this.http.post<string>(this.apiUrl, tipoActivo);
  }

  actualizarTipoActivo(id: number, tipoActivo: TipoDeActivoDTO): Observable<string> {
    return this.http.put<string>(`${this.apiUrl}/${id}`, tipoActivo);
  }

  eliminarTipoActivo(id: number): Observable<string> {
    return this.http.delete<string>(`${this.apiUrl}/${id}`);
  }
} 