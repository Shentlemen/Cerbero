import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';
import { DashboardStatsDTO } from '../interfaces/dashboard-stats.interface';

@Injectable({
  providedIn: 'root'
})
export class DashboardStatsService {
  private readonly apiUrl: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.apiUrl = `${this.configService.getApiUrl()}/dashboard/stats`;
  }

  getStats(): Observable<DashboardStatsDTO> {
    return this.http.get<DashboardStatsDTO>(this.apiUrl);
  }
}
