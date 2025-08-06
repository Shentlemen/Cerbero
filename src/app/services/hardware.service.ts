import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    return this.http.get<any[]>(this.apiUrl);
  }

  getHardwareById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  getHardwareByManufacturer(smanufacturer: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/by-manufacturer`, { params: { smanufacturer } });
  }

  filterHardware(filters: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/filter`, { params: filters });
  }

  getHardwareByIds(ids: number[]): Observable<any[]> {
    return this.http.post<any[]>(`${this.apiUrl}/by-ids`, { ids });
  }

  // Eliminar hardware y todos sus registros relacionados
  deleteHardwareComplete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}/complete`);
  }
}
