import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface SubnetDTO {
  netId: string;
  name: string;
  id: string;
}

@Injectable({
  providedIn: 'root'
})
export class SubnetService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/subnet`;
  }

  getSubnets(): Observable<SubnetDTO[]> {
    return this.http.get<SubnetDTO[]>(this.apiUrl);
  }

  getSubnetById(id: string): Observable<SubnetDTO> {
    return this.http.get<SubnetDTO>(`${this.apiUrl}/${id}`);
  }
}