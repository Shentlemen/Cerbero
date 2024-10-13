import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private apiUrl = process.env['apiUrl'];

  getApiUrl(): string {
    return this.apiUrl || '';
  }
}