import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AsistenteEstado {
  success: boolean;
  disponible: boolean;
  mensaje: string;
  modelo?: string;
}

export interface AsistenteRespuesta {
  success: boolean;
  respuesta: string;
  sql?: string;
  columnas?: string[];
  filas?: Record<string, string>[];
  mensaje?: string;
}

@Injectable({ providedIn: 'root' })
export class AsistenteService {
  private apiUrl = `${environment.apiUrl}/asistente`;

  constructor(private http: HttpClient) {}

  estado(): Observable<AsistenteEstado> {
    return this.http.get<AsistenteEstado>(`${this.apiUrl}/estado`);
  }

  preguntar(
    pregunta: string,
    sqlPrevio?: string,
    historial?: { rol: string; texto: string; sql?: string }[]
  ): Observable<AsistenteRespuesta> {
    return this.http.post<AsistenteRespuesta>(`${this.apiUrl}/preguntar`, {
      pregunta,
      sqlPrevio: sqlPrevio || '',
      historial: historial || []
    });
  }
}
