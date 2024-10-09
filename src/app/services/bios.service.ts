import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BiosService {
  private apiUrl = 'http://localhost:8080/api/bios'; // URL hardcodeada o desde un archivo de configuración

  constructor(private http: HttpClient) {}

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
