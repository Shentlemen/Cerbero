import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class BiosService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/bios`;
  }

  getAllBios(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getBiosById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  createBios(bios: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, bios);
  }

  updateBios(id: number, bios: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, bios);
  }

  deleteBios(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getByHardwareId(hardwareId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/by-hardware`, { params: { hardwareId: hardwareId.toString() } });
  }
}
