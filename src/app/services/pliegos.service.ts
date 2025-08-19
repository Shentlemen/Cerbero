import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PliegoDTO {
  idPliego: number;
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
export class PliegosService {
  private apiUrl = `${environment.apiUrl}/pliegos`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener el pliego de una compra (solo uno por compra)
   */
  getPliegoByCompra(idCompra: number): Observable<ApiResponse<PliegoDTO>> {
    return this.http.get<ApiResponse<PliegoDTO>>(`${this.apiUrl}/compra/${idCompra}`);
  }

  /**
   * Verificar si una compra ya tiene pliego
   */
  compraYaTienePliego(idCompra: number): Observable<ApiResponse<boolean>> {
    return this.http.get<ApiResponse<boolean>>(`${this.apiUrl}/existe/compra/${idCompra}`);
  }

  /**
   * Subir o reemplazar pliego de una compra
   */
  subirPliego(idCompra: number, archivo: File, descripcion?: string): Observable<ApiResponse<PliegoDTO>> {
    const formData = new FormData();
    formData.append('idCompra', idCompra.toString());
    formData.append('archivo', archivo);
    if (descripcion) {
      formData.append('descripcion', descripcion);
    }
    return this.http.post<ApiResponse<PliegoDTO>>(`${this.apiUrl}/subir`, formData);
  }

  /**
   * Eliminar pliego
   */
  eliminarPliego(idPliego: number): Observable<ApiResponse<string>> {
    return this.http.delete<ApiResponse<string>>(`${this.apiUrl}/${idPliego}`);
  }

  /**
   * Obtener URL de descarga
   */
  getUrlDescarga(idPliego: number): string {
    return `${this.apiUrl}/descargar/${idPliego}`;
  }

  /**
   * Obtener URL de visualización
   */
  getUrlVisualizacion(idPliego: number): string {
    return `${this.apiUrl}/ver/${idPliego}`;
  }

  /**
   * Descargar pliego
   */
  descargarPliego(idPliego: number): void {
    const url = this.getUrlDescarga(idPliego);
    window.open(url, '_blank');
  }

  /**
   * Visualizar pliego
   */
  visualizarPliego(idPliego: number): void {
    const url = this.getUrlVisualizacion(idPliego);
    window.open(url, '_blank');
  }

  /**
   * Obtener información de configuración
   */
  getInfoConfiguracion(): Observable<ApiResponse<string>> {
    return this.http.get<ApiResponse<string>>(`${this.apiUrl}/info`);
  }

  /**
   * Formatear tamaño de archivo
   */
  formatearTamano(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Verificar si es tipo imagen
   */
  esTipoImagen(tipoArchivo: string): boolean {
    return tipoArchivo.startsWith('image/');
  }

  /**
   * Verificar si es tipo PDF
   */
  esTipoPDF(tipoArchivo: string): boolean {
    return tipoArchivo === 'application/pdf';
  }

  /**
   * Verificar si es documento Word
   */
  esTipoWord(tipoArchivo: string): boolean {
    return tipoArchivo === 'application/msword' || 
           tipoArchivo === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  /**
   * Obtener icono según tipo de archivo
   */
  getIconoArchivo(tipoArchivo: string): string {
    if (this.esTipoImagen(tipoArchivo)) {
      return 'fas fa-image';
    } else if (this.esTipoPDF(tipoArchivo)) {
      return 'fas fa-file-pdf';
    } else if (this.esTipoWord(tipoArchivo)) {
      return 'fas fa-file-word';
    } else {
      return 'fas fa-file';
    }
  }

  /**
   * Validar archivo antes de subir
   */
  validarArchivo(archivo: File): { valido: boolean; mensaje: string } {
    const tiposPermitidos = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
      'application/pdf', 'image/bmp', 'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    const tamanoMaximo = 15 * 1024 * 1024; // 15MB
    
    if (!tiposPermitidos.includes(archivo.type)) {
      return {
        valido: false,
        mensaje: 'Tipo de archivo no permitido. Use PDF, imágenes o documentos Word.'
      };
    }
    
    if (archivo.size > tamanoMaximo) {
      return {
        valido: false,
        mensaje: 'El archivo excede el tamaño máximo de 15MB.'
      };
    }
    
    return {
      valido: true,
      mensaje: 'Archivo válido'
    };
  }
} 