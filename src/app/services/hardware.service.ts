import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class HardwareService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/hardware`;
  }

  // Método para obtener la lista de assets desde el back-end
  getHardware(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      catchError((error) => {
        console.error('Error al obtener la lista de assets', error);
        throw error;
      })
    );
  }

  getHardwareById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        console.error('Error al obtener el asset por ID', error);
        throw error;
      })
    );
  }

  // Puedes agregar más métodos aquí si los necesitas, por ejemplo:
  // createHardware(hardware: any): Observable<any> {
  //   return this.http.post<any>(this.apiUrl, hardware).pipe(
  //     catchError((error) => {
  //       console.error('Error al crear el asset', error);
  //       throw error;
  //     })
  //   );
  // }

  // updateHardware(id: number, hardware: any): Observable<any> {
  //   return this.http.put<any>(`${this.apiUrl}/${id}`, hardware).pipe(
  //     catchError((error) => {
  //       console.error('Error al actualizar el asset', error);
  //       throw error;
  //     })
  //   );
  // }

  // deleteHardware(id: number): Observable<void> {
  //   return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
  //     catchError((error) => {
  //       console.error('Error al eliminar el asset', error);
  //       throw error;
  //     })
  //   );
  // }
}
