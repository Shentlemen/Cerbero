import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  public apiUrl: string;

  constructor() {
    this.apiUrl = environment.apiUrl;
  }

  getApiUrl(): string {
    return this.apiUrl || '';
  }
}
