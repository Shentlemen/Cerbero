import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { SoftwareDTO } from './software.service';

@Injectable({
  providedIn: 'root'
})
export class SoftwareByHardwareService {
  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) { }

  getByHardwareId(hardwareId: number): Observable<SoftwareDTO[]> {
    const apiUrl = this.configService.getApiUrl();
    return this.http.get<SoftwareDTO[]>(`${apiUrl}/software/by-hardware/${hardwareId}`);
  }
} 