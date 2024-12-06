import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface SubnetDTO {
  id: string;
  netId: string;
  name: string;
}

export interface SubnetCoordinatesDTO {
  netId: string;
  latitud: number;
  longitud: number;
}

@Injectable({
  providedIn: 'root'
})
export class SubnetService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/subnet`;
  }

  getSubnets(): Observable<SubnetDTO[]> {
    return this.http.get<SubnetDTO[]>(this.apiUrl);
  }

  getSubnetById(id: string): Observable<SubnetDTO> {
    return this.http.get<SubnetDTO>(`${this.apiUrl}/${id}`);
  }

  getSubnetCoordinates(netId: string): Observable<SubnetCoordinatesDTO> {
    return this.http.get<SubnetCoordinatesDTO>(`${this.apiUrl}/coordenadas/${netId}`);
  }

  getAllSubnetCoordinates(): Observable<SubnetCoordinatesDTO[]> {
    return this.http.get<SubnetCoordinatesDTO[]>(`${this.apiUrl}/coordenadas`);
  }

  saveSubnetCoordinates(netId: string, latitud: number, longitud: number): Observable<SubnetCoordinatesDTO> {
    return this.http.post<SubnetCoordinatesDTO>(`${this.apiUrl}/coordenadas`, { netId, latitud, longitud });
  }

  updateSubnetCoordinates(netId: string, latitud: number, longitud: number): Observable<SubnetCoordinatesDTO> {
    return this.http.put<SubnetCoordinatesDTO>(`${this.apiUrl}/coordenadas/${netId}`, { latitud, longitud });
  }
}