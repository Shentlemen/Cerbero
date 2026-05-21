import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, finalize } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { ArcadeSnakeService, SnakeScoreRow } from '../services/arcade-snake.service';

const GRID_W = 24;
const GRID_H = 18;
const CELL_MIN = 14;
const CELL_MAX = 40;
const BASE_TICK_MS = 140;

type Dir = { x: number; y: number };

@Component({
  selector: 'app-snake-game',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './snake-game.component.html',
  styleUrls: ['./arcade-shared.css']
})
export class SnakeGameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly gridW = GRID_W;
  readonly gridH = GRID_H;
  /** Tamaño de celda en px; se ajusta al viewport para aprovechar la pantalla. */
  cellSize = 22;
  score = 0;
  playing = false;
  gameOver = false;
  playerName = '';
  leaderboard: SnakeScoreRow[] = [];
  leaderboardError = false;
  leaderboardLoading = false;
  submitLoading = false;
  /** Tras refrescar el ranking al morir, indica si puede guardar nombre en el top 20. */
  qualifiesForRank = false;
  /** true cuando ya respondió el servidor (o el fallback local) para el modal. */
  rankCheckComplete = false;

  private ctx!: CanvasRenderingContext2D;
  private tickId: ReturnType<typeof setTimeout> | null = null;
  private snake: { x: number; y: number }[] = [];
  private food = { x: 0, y: 0 };
  private dir: Dir = { x: 1, y: 0 };
  private pendingDir: Dir = { x: 1, y: 0 };
  private hue = 120;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private arcadeSnake: ArcadeSnakeService
  ) {}

  ngAfterViewInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.syncCanvasSize();
    this.drawIdle();
    // Evita NG0100: no tocar `leaderboardLoading` en el mismo ciclo que el primer check de la vista.
    setTimeout(() => this.loadLeaderboard(), 0);
  }

  ngOnDestroy(): void {
    this.stopLoop();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.syncCanvasSize();
    if (this.playing && !this.gameOver) {
      this.draw();
    } else {
      this.drawIdle();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKey(ev: KeyboardEvent): void {
    if (this.gameOver || !this.playing) return;
    const k = ev.key;
    const isArrow =
      k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight';
    if (!isArrow) return;

    // Siempre evitar scroll de la página con flechas (antes solo hacíamos preventDefault al girar).
    ev.preventDefault();

    if (k === 'ArrowUp' && this.dir.y === 0) {
      this.pendingDir = { x: 0, y: -1 };
    } else if (k === 'ArrowDown' && this.dir.y === 0) {
      this.pendingDir = { x: 0, y: 1 };
    } else if (k === 'ArrowLeft' && this.dir.x === 0) {
      this.pendingDir = { x: -1, y: 0 };
    } else if (k === 'ArrowRight' && this.dir.x === 0) {
      this.pendingDir = { x: 1, y: 0 };
    }
  }

  loadLeaderboard(): void {
    this.leaderboardLoading = true;
    this.leaderboardError = false;
    this.arcadeSnake
      .getLeaderboard()
      .pipe(
        catchError(() => {
          this.leaderboardError = true;
          return of(null);
        }),
        finalize(() => {
          this.leaderboardLoading = false;
          queueMicrotask(() => this.cdr.markForCheck());
        })
      )
      .subscribe((res) => {
        if (res?.success && res.data?.rows) {
          this.leaderboard = res.data.rows;
        } else {
          this.leaderboard = [];
        }
      });
  }

  startGame(): void {
    this.syncCanvasSize();
    this.gameOver = false;
    this.qualifiesForRank = false;
    this.rankCheckComplete = false;
    this.score = 0;
    this.playerName = '';
    this.snake = [
      { x: Math.floor(GRID_W / 2), y: Math.floor(GRID_H / 2) },
      { x: Math.floor(GRID_W / 2) - 1, y: Math.floor(GRID_H / 2) },
      { x: Math.floor(GRID_W / 2) - 2, y: Math.floor(GRID_H / 2) }
    ];
    this.dir = { x: 1, y: 0 };
    this.pendingDir = { x: 1, y: 0 };
    this.placeFood();
    this.playing = true;
    this.stopLoop();
    const tick = () => {
      this.step();
      if (!this.gameOver) {
        const ms = Math.max(65, BASE_TICK_MS - Math.floor(this.score * 3));
        this.tickId = setTimeout(tick, ms);
      }
    };
    this.tickId = setTimeout(tick, BASE_TICK_MS);
    this.draw();
  }

  saveScore(): void {
    if (!this.qualifiesForRank || this.submitLoading) return;
    this.submitLoading = true;
    this.arcadeSnake
      .submit(this.playerName, this.score)
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          this.submitLoading = false;
          queueMicrotask(() => this.cdr.markForCheck());
        })
      )
      .subscribe((res) => {
        if (res?.success && res.data?.accepted) {
          this.closeGameOver();
          this.loadLeaderboard();
        }
      });
  }

  closeGameOver(): void {
    this.gameOver = false;
    this.playing = false;
    this.qualifiesForRank = false;
    this.rankCheckComplete = false;
    this.drawIdle();
    this.cdr.markForCheck();
  }

  goLogin(): void {
    this.stopLoop();
    void this.router.navigate(['/login']);
  }

  private stopLoop(): void {
    if (this.tickId !== null) {
      clearTimeout(this.tickId);
      this.tickId = null;
    }
  }

  /** Ajusta {@link cellSize} y dimensiones del canvas según el espacio disponible. */
  private syncCanvasSize(): void {
    const pad = 28;
    const sideBySide = window.innerWidth >= 960;
    const rankingReserve = sideBySide ? 400 : 0;
    const availW = Math.max(220, window.innerWidth - pad * 2 - rankingReserve);
    let availH: number;
    if (sideBySide) {
      availH = Math.max(260, window.innerHeight - 190);
    } else {
      availH = Math.max(240, window.innerHeight - 320);
    }
    const cs = Math.floor(Math.min(availW / GRID_W, availH / GRID_H));
    this.cellSize = Math.max(CELL_MIN, Math.min(CELL_MAX, cs));
    const c = this.canvasRef.nativeElement;
    c.width = GRID_W * this.cellSize;
    c.height = GRID_H * this.cellSize;
  }

  private placeFood(): void {
    for (let i = 0; i < 2000; i++) {
      const x = Math.floor(Math.random() * GRID_W);
      const y = Math.floor(Math.random() * GRID_H);
      if (!this.snake.some((s) => s.x === x && s.y === y)) {
        this.food = { x, y };
        return;
      }
    }
  }

  private step(): void {
    this.dir = this.pendingDir;
    const head = this.snake[0];
    const nx = head.x + this.dir.x;
    const ny = head.y + this.dir.y;
    if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) {
      this.endGame();
      return;
    }
    if (this.snake.some((s) => s.x === nx && s.y === ny)) {
      this.endGame();
      return;
    }
    this.snake.unshift({ x: nx, y: ny });
    if (nx === this.food.x && ny === this.food.y) {
      this.score += 10;
      this.hue = (this.hue + 37) % 360;
      this.placeFood();
    } else {
      this.snake.pop();
    }
    this.draw();
  }

  /**
   * Cierra el loop, abre el modal al instante y pide al servidor si el puntaje califica
   * (GET leaderboard + GET qualifies). Así no dependemos de un solo HTTP lento o fallido.
   */
  private endGame(): void {
    this.stopLoop();
    this.playing = false;
    const finalScore = this.score;
    this.rankCheckComplete = false;
    this.gameOver = true;
    this.playerName = '';
    this.draw();
    queueMicrotask(() => this.cdr.markForCheck());

    forkJoin([
      this.arcadeSnake.getLeaderboard().pipe(catchError(() => of(null))),
      this.arcadeSnake.qualifies(finalScore).pipe(catchError(() => of(null)))
    ]).subscribe(([lbRes, qRes]) => {
      if (lbRes?.success && lbRes.data?.rows) {
        this.leaderboard = lbRes.data.rows;
        this.leaderboardError = false;
      } else if (lbRes && !lbRes.success) {
        this.leaderboardError = true;
      }

      if (qRes?.success && typeof qRes.data === 'boolean') {
        this.qualifiesForRank = qRes.data;
      } else {
        this.applyLocalQualifyEstimate(finalScore);
      }
      this.rankCheckComplete = true;
      this.draw();
      queueMicrotask(() => this.cdr.markForCheck());
    });
  }

  /** Si falla /qualifies, estimamos con el ranking ya mostrado (puede estar desactualizado). */
  private applyLocalQualifyEstimate(finalScore: number): void {
    const rows = this.leaderboard;
    if (rows.length < 20) {
      this.qualifiesForRank = true;
      return;
    }
    const row20 = rows[19];
    this.qualifiesForRank = row20 != null && finalScore > row20.score;
  }

  private drawIdle(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const cs = this.cellSize;
    const W = GRID_W * cs;
    const H = GRID_H * cs;
    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2d5016';
    ctx.font = `${Math.round(cs * 0.85)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('CERBERO — SNAKE', W / 2, H / 2 - Math.round(cs * 0.35));
    ctx.fillStyle = '#8fbc8f';
    ctx.font = `${Math.round(cs * 0.6)}px "Courier New", monospace`;
    ctx.fillText('Pulsa INICIAR', W / 2, H / 2 + Math.round(cs * 0.55));
  }

  private draw(): void {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const W = GRID_W * cs;
    const H = GRID_H * cs;
    const inset = Math.max(1, Math.round(cs * 0.12));
    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(80, 120, 80, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_W; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cs, 0);
      ctx.lineTo(x * cs, H);
      ctx.stroke();
    }
    for (let y = 0; y <= GRID_H; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cs);
      ctx.lineTo(W, y * cs);
      ctx.stroke();
    }
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(this.food.x * cs + inset, this.food.y * cs + inset, cs - 2 * inset, cs - 2 * inset);
    this.snake.forEach((seg, i) => {
      const g = i === 0 ? 1 : 0.55 + (1 - i / this.snake.length) * 0.35;
      ctx.fillStyle = `hsl(${this.hue}, 70%, ${35 + g * 25}%)`;
      const pad = Math.max(1, Math.round(cs * 0.06));
      ctx.fillRect(seg.x * cs + pad, seg.y * cs + pad, cs - 2 * pad, cs - 2 * pad);
    });
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ff6b6b';
      ctx.font = `bold ${Math.round(cs * 1.0)}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - Math.round(cs * 0.2));
      ctx.fillStyle = '#c8e6c9';
      ctx.font = `${Math.round(cs * 0.72)}px "Courier New", monospace`;
      ctx.fillText(`Puntos: ${this.score}`, W / 2, H / 2 + Math.round(cs * 0.55));
    }
  }
}
