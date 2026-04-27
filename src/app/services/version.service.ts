import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppVersionData, VersionInfo, buildVersionInfo, getDefaultVersionInfo } from '../version';

@Injectable({
  providedIn: 'root'
})
export class VersionService {
  private readonly apiUrl = `${environment.apiUrl}/public/version`;

  constructor(private http: HttpClient) {}

  getVersionInfo(): Observable<VersionInfo> {
    return this.http.get<Partial<AppVersionData>>(this.apiUrl).pipe(
      map((response) => buildVersionInfo({
        version: response.version || getDefaultVersionInfo().version,
        buildNumber: response.buildNumber || getDefaultVersionInfo().buildNumber
      })),
      catchError(() => of(getDefaultVersionInfo()))
    );
  }
}
