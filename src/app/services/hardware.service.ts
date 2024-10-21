import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
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

  getHardwareByManufacturer(smanufacturer: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/by-manufacturer`, { params: { smanufacturer } });
  }


  filterHardware(filters: any): Observable<any[]> {
    let params = new HttpParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        params = params.set(key, filters[key]);
      }
    });

    console.log('Sending HTTP request with params:', params.toString()); // Verifica los parámetros enviados

    // Cambia la URL al nuevo endpoint
    return this.http.get<any[]>(`${this.configService.getApiUrl()}/hardware/filter`, { params }).pipe(
      tap(data => console.log('Received data:', data)), // Verifica los datos recibidos
      catchError(error => {
        console.error('Error in filterHardware:', error);
        return throwError(error);
      })
    );
  }
}
