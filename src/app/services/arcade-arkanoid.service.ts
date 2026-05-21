import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../interfaces/api-response.interface';

export interface ArkanoidScoreRow {
  rank: number;
  playerName: string;
  score: number;
  createdAt: string;
}

export interface ArkanoidLeaderboard {
  rows: ArkanoidScoreRow[];
  cutoffScore: number | null;
}

export interface ArkanoidSubmitResult {
  accepted: boolean;
  rank: number | null;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ArcadeArkanoidService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/public/arkanoid-scores`;

  getLeaderboard(): Observable<ApiResponse<ArkanoidLeaderboard>> {
    return this.http.get<ApiResponse<ArkanoidLeaderboard>>(this.base);
  }

  qualifies(score: number): Observable<ApiResponse<boolean>> {
    return this.http.get<ApiResponse<boolean>>(`${this.base}/qualifies`, {
      params: { score: String(score) }
    });
  }

  submit(playerName: string, score: number): Observable<ApiResponse<ArkanoidSubmitResult>> {
    return this.http.post<ApiResponse<ArkanoidSubmitResult>>(this.base, { playerName, score });
  }
}
