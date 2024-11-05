import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UbicacionEquipoOse } from '../models/ubicacion-equipo.model';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class UbicacionEquipoService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/ubicacion-equipo`;
  }

  getUbicacionByHardwareId(hardwareId: number): Observable<UbicacionEquipoOse> {
    return this.http.get<UbicacionEquipoOse>(`${this.apiUrl}/${hardwareId}`);
  }

  createUbicacion(ubicacion: UbicacionEquipoOse): Observable<UbicacionEquipoOse> {
    return this.http.post<UbicacionEquipoOse>(this.apiUrl, ubicacion);
  }

  updateUbicacion(hardwareId: number, ubicacion: UbicacionEquipoOse): Observable<UbicacionEquipoOse> {
    return this.http.put<UbicacionEquipoOse>(`${this.apiUrl}/${hardwareId}`, ubicacion);
  }

  deleteUbicacion(hardwareId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${hardwareId}`);
  }
}
