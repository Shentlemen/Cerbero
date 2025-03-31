import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { map } from 'rxjs/operators';

export interface ProveedorDTO {
    idProveedores: number;     // ID único del proveedor
    nombre: string;            // Nombre del proveedor
    correoContacto: string;    // Correo electrónico de contacto
    telefonoContacto: string;  // Teléfono de contacto
    nombreComercial: string;   // Nombre comercial del proveedor
    RUC: string;              // RUC del proveedor
    ruc?: string; // Campo opcional para compatibilidad con el backend
}

@Injectable({
  providedIn: 'root'
})
export class ProveedoresService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/proveedores`;
    console.log('URL base para proveedores:', this.apiUrl);
  }

  getProveedores(): Observable<ProveedorDTO[]> {
    console.log('Haciendo petición GET a:', this.apiUrl);
    return this.http.get<ProveedorDTO[]>(this.apiUrl).pipe(
      map(proveedores => proveedores.map(proveedor => ({
        ...proveedor,
        RUC: proveedor.ruc || proveedor.RUC // Maneja ambos casos
      })))
    );
  }

  getProveedor(id: number): Observable<ProveedorDTO> {
    return this.http.get<ProveedorDTO>(`${this.apiUrl}/${id}`);
  }

  getProveedorByRuc(ruc: string): Observable<ProveedorDTO> {
    return this.http.get<ProveedorDTO>(`${this.apiUrl}/by-ruc/${ruc}`);
  }

  crearProveedor(proveedor: Omit<ProveedorDTO, 'idProveedores'>): Observable<string> {
    return this.http.post<string>(this.apiUrl, proveedor);
  }

  actualizarProveedor(id: number, proveedor: ProveedorDTO): Observable<string> {
    return this.http.put<string>(`${this.apiUrl}/${id}`, proveedor);
  }

  eliminarProveedor(id: number): Observable<string> {
    return this.http.delete<string>(`${this.apiUrl}/${id}`);
  }
} 