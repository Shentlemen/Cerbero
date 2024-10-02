import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class HardwareService {
  private apiUrl = 'http://localhost:8080/api/hardware';  // URL del backend

  constructor(private http: HttpClient) { }

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
}
