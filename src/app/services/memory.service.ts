import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class MemoryService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/memory`;
  }

  getByHardwareId(hardwareId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/by-hardware`, { params: { hardwareId: hardwareId.toString() } });
  }

  // Puedes agregar más métodos aquí si los necesitas, por ejemplo:
  // getAllMemories(): Observable<any[]> {
  //   return this.http.get<any[]>(this.apiUrl);
  // }

  // getMemoryById(id: number): Observable<any> {
  //   return this.http.get<any>(`${this.apiUrl}/${id}`);
  // }

  // createMemory(memory: any): Observable<any> {
  //   return this.http.post<any>(this.apiUrl, memory);
  // }

  // updateMemory(id: number, memory: any): Observable<any> {
  //   return this.http.put<any>(`${this.apiUrl}/${id}`, memory);
  // }

  // deleteMemory(id: number): Observable<void> {
  //   return this.http.delete<void>(`${this.apiUrl}/${id}`);
  // }
}