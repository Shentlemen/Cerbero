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

/** Convierte una IPv4 a entero sin signo (32 bits). Devuelve null si no es válida. */
function ipv4ToUint32(ip: string): number | null {
  const trimmed = ip?.trim();
  if (!trimmed) return null;
  const parts = trimmed.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => parseInt(p, 10));
  if (octets.some((x) => Number.isNaN(x) || x < 0 || x > 255)) return null;
  return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
}

function maskBitsOrder(subnetMask: number): number {
  let n = subnetMask >>> 0;
  let count = 0;
  while (n) {
    count++;
    n &= n - 1;
  }
  return count;
}

/**
 * Coincide IPv4 con la subred usando NETID (red base) y MASK (subnet mask en puntos).
 * Sin máscara válida no hay coincidencia.
 */
export function ipv4MatchesSubnet(ip: string, subnet: SubnetDTO): boolean {
  const host = ipv4ToUint32(ip);
  const net = ipv4ToUint32(subnet.netId);
  const maskRaw = subnet.mask?.trim();
  const maskBits = maskRaw ? ipv4ToUint32(maskRaw) : null;
  if (host === null || net === null || maskBits === null) return false;
  return (host & maskBits) === (net & maskBits);
}

/**
 * De la lista de subnets, devuelve la que corresponde a la IP y es la más específica
 * si hubiera más de una (mayor número de bits en máscara).
 */
export function findSubnetForIpv4(ip: string | undefined | null, subnets: SubnetDTO[]): SubnetDTO | null {
  if (!ip?.trim()) return null;
  const trimmed = ip.trim();
  let best: SubnetDTO | null = null;
  let bestOrder = -1;
  for (const s of subnets) {
    if (!ipv4MatchesSubnet(trimmed, s)) continue;
    const m = s.mask?.trim();
    const maskNum = m ? ipv4ToUint32(m) : null;
    if (maskNum === null) continue;
    const ord = maskBitsOrder(maskNum);
    if (ord > bestOrder) {
      bestOrder = ord;
      best = s;
    }
  }
  return best;
}

/** Texto a mostrar: NAME de la tabla subnet, o etiqueta cuando no hay match / IP inválida. */
export function resolveSubnetDisplayNameForIpv4(ip: string | undefined | null, subnets: SubnetDTO[]): string {
  const trimmed = ip?.trim();
  if (!trimmed) return 'N/A';
  const found = findSubnetForIpv4(trimmed, subnets ?? []);
  if (!found) return 'Sin coincidencia con subredes';
  const name = found.name?.trim();
  return name || found.id?.trim() || 'Sin nombre';
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