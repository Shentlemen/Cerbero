import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MemoryService {
  private apiUrl = 'http://localhost:8080/api/memory'; // URL hardcodeada

  constructor(private http: HttpClient) { }

  getByHardwareId(hardwareId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/by-hardware?hardwareId=${hardwareId}`);
  }
}