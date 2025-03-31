import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { map } from 'rxjs/operators';

export interface ServicioGarantiaDTO {
  idServicioGarantia: number;
  nombre: string;
  correoDeContacto: string;
  telefonoDeContacto: string;
  nombreComercial: string;
  RUC: string;
  ruc?: string; // Campo opcional para compatibilidad con el backend
}

@Injectable({
  providedIn: 'root'
})
export class ServiciosGarantiaService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.apiUrl}/servicios-garantia`;
  }

  getServiciosGarantia(): Observable<ServicioGarantiaDTO[]> {
    return this.http.get<ServicioGarantiaDTO[]>(this.apiUrl).pipe(
      map(servicios => servicios.map(servicio => ({
        ...servicio,
        RUC: servicio.ruc || servicio.RUC // Maneja ambos casos
      })))
    );
  }

  getServicioGarantia(id: number): Observable<ServicioGarantiaDTO> {
    return this.http.get<ServicioGarantiaDTO>(`${this.apiUrl}/${id}`);
  }

  getServicioGarantiaByRUC(ruc: string): Observable<ServicioGarantiaDTO> {
    return this.http.get<ServicioGarantiaDTO>(`${this.apiUrl}/by-ruc/${ruc}`);
  }

  crearServicioGarantia(servicioGarantia: Omit<ServicioGarantiaDTO, 'idServicioGarantia'>): Observable<string> {
    return this.http.post<string>(this.apiUrl, servicioGarantia);
  }

  actualizarServicioGarantia(id: number, servicioGarantia: ServicioGarantiaDTO): Observable<string> {
    return this.http.put<string>(`${this.apiUrl}/${id}`, servicioGarantia);
  }

  eliminarServicioGarantia(id: number): Observable<string> {
    return this.http.delete<string>(`${this.apiUrl}/${id}`);
  }
} 