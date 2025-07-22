import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConfigService } from './config.service';

export interface ContactoDTO {
  idContacto?: number;
  nombre: string;
  telefono: string;
  email: string;
  cargo: string;
  observaciones?: string;
  idProveedores: number;
}

@Injectable({
  providedIn: 'root'
})
export class ContactosService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/contactos`;
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ha ocurrido un error en la operación';
    if (error.error && typeof error.error === 'object' && 'message' in error.error) {
      errorMessage = error.error.message;
    } else if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    }
    return throwError(() => new Error(errorMessage));
  }

  crearContacto(contacto: ContactoDTO): Observable<void> {
    return this.http.post<any>(this.apiUrl, contacto, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      map(response => {
        if (response.success) return;
        throw new Error(response.message);
      }),
      catchError(this.handleError)
    );
  }

  obtenerContactosPorProveedor(idProveedores: number): Observable<ContactoDTO[]> {
    return this.http.get<any>(`${this.apiUrl}/by-proveedor/${idProveedores}`).pipe(
      map(response => {
        if (response.success) return response.data;
        throw new Error(response.message);
      }),
      catchError(this.handleError)
    );
  }

  actualizarContacto(idContacto: number, contacto: ContactoDTO): Observable<void> {
    return this.http.put<any>(`${this.apiUrl}/${idContacto}`, contacto, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      map(response => {
        if (response.success) return;
        throw new Error(response.message);
      }),
      catchError(this.handleError)
    );
  }

  eliminarContacto(idContacto: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${idContacto}`).pipe(
      map(response => {
        if (response.success) return;
        throw new Error(response.message);
      }),
      catchError(this.handleError)
    );
  }
} 