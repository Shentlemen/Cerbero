import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { ConfigService } from './config.service';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class NetworkInfoService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/network-info`;
  }

  getNetworkInfo(): Observable<ApiResponse<NetworkInfoDTO[]>> {
    return this.http.get<ApiResponse<NetworkInfoDTO[]>>(this.apiUrl);
  }

  getNetworkInfoByMac(mac: string): Observable<ApiResponse<NetworkInfoDTO>> {
    return this.http.get<ApiResponse<NetworkInfoDTO>>(`${this.apiUrl}/${mac}`);
  }
} 