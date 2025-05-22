import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { ApiResponse } from '../interfaces/api-response.interface';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface SubnetDTO {
  pk: number;      // ID numérico que se usa para idSubnet
  netId: string;   // Dirección de red (ej: "192.168.1.0")
  name: string;    // Nombre descriptivo
  id: string;      // Identificador textual (ej: "RED-001")
  mask?: string;   // Opcional
  tag?: string;    // Opcional
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
  private apiUrl = `${environment.apiUrl}/subnet`;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/subnet`;
  }

  getSubnets(): Observable<SubnetDTO[]> {
    return new Observable<SubnetDTO[]>(observer => {
      this.http.get<ApiResponse<SubnetDTO[]>>(this.apiUrl).subscribe({
        next: (response) => {
          if (response.success) {
            observer.next(response.data);
          } else {
            observer.error(new Error(response.message));
          }
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
          observer.complete();
        }
      });
    });
  }

  getSubnet(pk: number): Observable<SubnetDTO> {
    return new Observable<SubnetDTO>(observer => {
      this.http.get<ApiResponse<SubnetDTO>>(`${this.apiUrl}/${pk}`).subscribe({
        next: (response) => {
          if (response.success) {
            observer.next(response.data);
          } else {
            observer.error(new Error(response.message));
          }
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
          observer.complete();
        }
      });
    });
  }

  createSubnet(subnet: Omit<SubnetDTO, 'pk'>): Observable<SubnetDTO> {
    return new Observable<SubnetDTO>(observer => {
      this.http.post<ApiResponse<SubnetDTO>>(this.apiUrl, subnet).subscribe({
        next: (response) => {
          if (response.success) {
            observer.next(response.data);
          } else {
            observer.error(new Error(response.message));
          }
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
          observer.complete();
        }
      });
    });
  }

  updateSubnet(pk: number, subnet: Omit<SubnetDTO, 'pk'>): Observable<SubnetDTO> {
    return new Observable<SubnetDTO>(observer => {
      this.http.put<ApiResponse<SubnetDTO>>(`${this.apiUrl}/${pk}`, subnet).subscribe({
        next: (response) => {
          if (response.success) {
            observer.next(response.data);
          } else {
            observer.error(new Error(response.message));
          }
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
          observer.complete();
        }
      });
    });
  }

  deleteSubnet(pk: number): Observable<void> {
    return new Observable<void>(observer => {
      this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${pk}`).subscribe({
        next: (response) => {
          if (response.success) {
            observer.next();
          } else {
            observer.error(new Error(response.message));
          }
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
          observer.complete();
        }
      });
    });
  }

  getSubnetCoordinates(netId: string): Observable<SubnetCoordinatesDTO> {
    return this.http.get<ApiResponse<SubnetCoordinatesDTO>>(`${this.apiUrl}/coordenadas/${netId}`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  getAllSubnetCoordinates(): Observable<SubnetCoordinatesDTO[]> {
    return this.http.get<ApiResponse<SubnetCoordinatesDTO[]>>(`${this.apiUrl}/coordenadas`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  saveSubnetCoordinates(netId: string, latitud: number, longitud: number): Observable<SubnetCoordinatesDTO> {
    // Validar rangos de coordenadas
    if (latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180) {
      throw new Error('Las coordenadas están fuera de rango');
    }

    return this.http.post<ApiResponse<SubnetCoordinatesDTO>>(`${this.apiUrl}/coordenadas`, {
      netId,
      latitud,
      longitud
    }).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }

  updateSubnetCoordinates(netId: string, latitud: number, longitud: number): Observable<SubnetCoordinatesDTO> {
    // Validar rangos de coordenadas
    if (latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180) {
      throw new Error('Las coordenadas están fuera de rango');
    }

    return this.http.put<ApiResponse<SubnetCoordinatesDTO>>(`${this.apiUrl}/coordenadas/${netId}`, {
      netId,
      latitud,
      longitud
    }).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }
}