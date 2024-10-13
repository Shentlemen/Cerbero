import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/video`;
  }

  getByHardwareId(hardwareId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/by-hardware`, { params: { hardwareId: hardwareId.toString() } });
  }

  // Puedes agregar más métodos aquí si los necesitas, por ejemplo:
  // getAllVideos(): Observable<any[]> {
  //   return this.http.get<any[]>(this.apiUrl);
  // }

  // getVideoById(id: number): Observable<any> {
  //   return this.http.get<any>(`${this.apiUrl}/${id}`);
  // }

  // createVideo(video: any): Observable<any> {
  //   return this.http.post<any>(this.apiUrl, video);
  // }

  // updateVideo(id: number, video: any): Observable<any> {
  //   return this.http.put<any>(`${this.apiUrl}/${id}`, video);
  // }

  // deleteVideo(id: number): Observable<void> {
  //   return this.http.delete<void>(`${this.apiUrl}/${id}`);
  // }
}