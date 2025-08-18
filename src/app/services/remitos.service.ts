import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RemitoDTO {
  idRemito: number;
  idCompra: number;
  nombreArchivo: string;
  nombreArchivoOriginal: string;
  rutaArchivo: string;
  tipoArchivo: string;
  tamanoArchivo: number;
  descripcion?: string;
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

@Injectable({
  providedIn: 'root'
})
export class RemitosService {
  private apiUrl = `${environment.apiUrl}/remitos`;

  constructor(private http: HttpClient) {}

  getRemitosByCompra(idCompra: number): Observable<ApiResponse<RemitoDTO[]>> {
    return this.http.get<ApiResponse<RemitoDTO[]>>(`${this.apiUrl}/compra/${idCompra}`);
  }

  getRemitoById(idRemito: number): Observable<ApiResponse<RemitoDTO>> {
    return this.http.get<ApiResponse<RemitoDTO>>(`${this.apiUrl}/${idRemito}`);
  }

  subirRemito(idCompra: number, archivo: File, descripcion?: string): Observable<ApiResponse<RemitoDTO>> {
    const formData = new FormData();
    formData.append('idCompra', idCompra.toString());
    formData.append('archivo', archivo);
    if (descripcion) {
      formData.append('descripcion', descripcion);
    }

    return this.http.post<ApiResponse<RemitoDTO>>(`${this.apiUrl}/subir`, formData);
  }

  eliminarRemito(idRemito: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.apiUrl}/${idRemito}`);
  }

  getUrlDescarga(idRemito: number): string {
    return `${this.apiUrl}/descargar/${idRemito}`;
  }

  getUrlVisualizacion(idRemito: number): string {
    return `${this.apiUrl}/ver/${idRemito}`;
  }

  descargarRemito(idRemito: number): void {
    const url = this.getUrlDescarga(idRemito);
    window.open(url, '_blank');
  }

  visualizarRemito(idRemito: number): void {
    const url = this.getUrlVisualizacion(idRemito);
    window.open(url, '_blank');
  }

  getInfoConfiguracion(): Observable<ApiResponse<string>> {
    return this.http.get<ApiResponse<string>>(`${this.apiUrl}/info`);
  }

  formatearTamaño(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  esTipoImagen(tipoArchivo: string): boolean {
    return tipoArchivo.startsWith('image/');
  }

  esTipoPDF(tipoArchivo: string): boolean {
    return tipoArchivo === 'application/pdf';
  }

  getIconoArchivo(tipoArchivo: string): string {
    if (this.esTipoImagen(tipoArchivo)) {
      return 'fas fa-image';
    } else if (this.esTipoPDF(tipoArchivo)) {
      return 'fas fa-file-pdf';
    } else {
      return 'fas fa-file';
    }
  }

  validarArchivo(archivo: File): { valido: boolean; mensaje: string } {
    const tiposPermitidos = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
      'application/pdf', 'image/bmp', 'image/tiff'
    ];
    
    const tamañoMaximo = 10 * 1024 * 1024; // 10MB

    if (!tiposPermitidos.includes(archivo.type)) {
      return {
        valido: false,
        mensaje: 'Tipo de archivo no permitido. Formatos permitidos: JPG, PNG, PDF, GIF, BMP, TIFF'
      };
    }

    if (archivo.size > tamañoMaximo) {
      return {
        valido: false,
        mensaje: 'El archivo es demasiado grande. Tamaño máximo: 10MB'
      };
    }

    return { valido: true, mensaje: 'Archivo válido' };
  }
} 