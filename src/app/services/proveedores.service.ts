import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface ProveedorDTO {
    idProveedores: number;     // ID único del proveedor
    nombre: string;            // Nombre del proveedor
    correoContacto: string;    // Correo electrónico de contacto
    telefonoContacto: string;  // Teléfono de contacto
    nombreComercial: string;   // Nombre comercial del proveedor
    RUC: string;              // RUC del proveedor
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
  }

  getProveedores(): Observable<ProveedorDTO[]> {
    return this.http.get<ProveedorDTO[]>(this.apiUrl);
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