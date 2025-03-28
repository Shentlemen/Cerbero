import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UbicacionEquipoOse } from '../models/ubicacion-equipo.model';

@Injectable({
  providedIn: 'root'
})
export class UbicacionEquipoService {
  constructor(private http: HttpClient) {}

  getUbicacionByHardwareId(hardwareId: number): Observable<UbicacionEquipoOse> {
    return this.http.get<UbicacionEquipoOse>(`/api/ubicacion-equipo/${hardwareId}`);
  }

  updateUbicacion(hardwareId: number, ubicacion: UbicacionEquipoOse): Observable<UbicacionEquipoOse> {
    return this.http.put<UbicacionEquipoOse>(`/api/ubicacion-equipo/${hardwareId}`, ubicacion);
  }

  deleteUbicacion(hardwareId: number): Observable<void> {
    return this.http.delete<void>(`/api/ubicacion-equipo/${hardwareId}`);
  }
} 