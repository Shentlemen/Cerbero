import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/device`;
  }

  getByHardwareId(hardwareId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/by-hardware`, { params: { hardwareId: hardwareId.toString() } });
  }

  // Aquí puedes agregar otros métodos si los necesitas, por ejemplo:
  // getAllDevices(): Observable<any[]> {
  //   return this.http.get<any[]>(this.apiUrl);
  // }

  // getDeviceById(id: number): Observable<any> {
  //   return this.http.get<any>(`${this.apiUrl}/${id}`);
  // }

  // createDevice(device: any): Observable<any> {
  //   return this.http.post<any>(this.apiUrl, device);
  // }

  // updateDevice(id: number, device: any): Observable<any> {
  //   return this.http.put<any>(`${this.apiUrl}/${id}`, device);
  // }

  // deleteDevice(id: number): Observable<void> {
  //   return this.http.delete<void>(`${this.apiUrl}/${id}`);
  // }
}