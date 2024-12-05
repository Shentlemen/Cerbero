import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';

@Injectable({
  providedIn: 'root'
})
export class NetworkInfoService {
  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) { }

  getNetworkInfo(): Observable<NetworkInfoDTO[]> {
    const apiUrl = this.configService.getApiUrl();
    return this.http.get<NetworkInfoDTO[]>(`${apiUrl}/network-info`);
  }
} 