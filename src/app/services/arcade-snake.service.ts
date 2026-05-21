import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../interfaces/api-response.interface';

export interface SnakeScoreRow {
  rank: number;
  playerName: string;
  score: number;
  createdAt: string;
}

export interface SnakeLeaderboard {
  rows: SnakeScoreRow[];
  cutoffScore: number | null;
}

export interface SnakeSubmitResult {
  accepted: boolean;
  rank: number | null;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ArcadeSnakeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/public/snake-scores`;

  getLeaderboard(): Observable<ApiResponse<SnakeLeaderboard>> {
    return this.http.get<ApiResponse<SnakeLeaderboard>>(this.base);
  }

  /** Misma regla que el servidor: si el puntaje entra en el top 20. */
  qualifies(score: number): Observable<ApiResponse<boolean>> {
    return this.http.get<ApiResponse<boolean>>(`${this.base}/qualifies`, {
      params: { score: String(score) }
    });
  }

  submit(playerName: string, score: number): Observable<ApiResponse<SnakeSubmitResult>> {
    return this.http.post<ApiResponse<SnakeSubmitResult>>(this.base, { playerName, score });
  }
}
