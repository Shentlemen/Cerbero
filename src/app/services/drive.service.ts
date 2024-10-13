import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class DriveService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/drive`;
  }

  getByHardwareId(hardwareId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/by-hardware`, { params: { hardwareId: hardwareId.toString() } });
  }

  // Puedes agregar más métodos aquí si los necesitas, por ejemplo:
  // getAllDrives(): Observable<any[]> {
  //   return this.http.get<any[]>(this.apiUrl);
  // }

  // getDriveById(id: number): Observable<any> {
  //   return this.http.get<any>(`${this.apiUrl}/${id}`);
  // }

  // createDrive(drive: any): Observable<any> {
  //   return this.http.post<any>(this.apiUrl, drive);
  // }

  // updateDrive(id: number, drive: any): Observable<any> {
  //   return this.http.put<any>(`${this.apiUrl}/${id}`, drive);
  // }

  // deleteDrive(id: number): Observable<void> {
  //   return this.http.delete<void>(`${this.apiUrl}/${id}`);
  // }
}