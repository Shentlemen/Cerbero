import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { SoftwareDTO } from './software.service';
import { ApiResponse } from '../interfaces/api-response.interface';
import { map } from 'rxjs/operators';

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
    return this.http.get<ApiResponse<SoftwareDTO[]>>(`${apiUrl}/software/hardware/${hardwareId}`).pipe(
      map(response => {
        if (response.success) {
          return response.data;
        } else {
          throw new Error(response.message);
        }
      })
    );
  }
} 