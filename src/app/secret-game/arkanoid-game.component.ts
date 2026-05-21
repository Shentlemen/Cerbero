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
import { RouterLink } from '@angular/router';
import { catchError, finalize } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { ArcadeArkanoidService, ArkanoidScoreRow } from '../services/arcade-arkanoid.service';
import {
  ARKANOID_II_COLS,
  formatRoundLabel,
  getArkanoidIiLevel,
  getBrickCellDef
} from './arkanoid-ii-levels';

const GAME_W = 600;
const GAME_H = 450;
const PADDLE_W = 88;
const PADDLE_H = 10;
const BALL_R = 5;
const BRICK_PAD = 3;
/** Tope del área de juego = borde superior del canvas (no encima de los ladrillos). */
const PLAY_TOP = 8;
/** Primera fila de ladrillos, debajo del techo. */
const BRICK_TOP = 40;
const PADDLE_Y = GAME_H - 32;

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  color: string;
  points: number;
  hitsLeft: number;
  indestructible: boolean;
}

@Component({
  selector: 'app-arkanoid-game',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './arkanoid-game.component.html',
  styleUrls: ['./arcade-shared.css', './arkanoid-game.component.css']
})
export class ArkanoidGameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  score = 0;
  level = 1;
  lives = 3;
  playing = false;
  gameOver = false;
  ballOnPaddle = true;
  levelBanner = false;
  levelRoundLabel = '';
  levelTitle = '';
  playerName = '';
  leaderboard: ArkanoidScoreRow[] = [];
  leaderboardError = false;
  leaderboardLoading = false;
  submitLoading = false;
  qualifiesForRank = false;
  rankCheckComplete = false;

  private ctx!: CanvasRenderingContext2D;
  private scale = 1;
  private animId: number | null = null;
  private bricks: Brick[] = [];
  private paddleX = GAME_W / 2 - PADDLE_W / 2;
  private ballX = GAME_W / 2;
  private ballY = PADDLE_Y - BALL_R - 2;
  private ballVx = 0;
  private ballVy = 0;
  private keys = { left: false, right: false };
  private levelBannerTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private arcadeArkanoid: ArcadeArkanoidService
  ) {}

  ngAfterViewInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.syncCanvasSize();
    this.drawIdle();
    setTimeout(() => this.loadLeaderboard(), 0);
  }

  ngOnDestroy(): void {
    this.stopLoop();
    if (this.levelBannerTimer) {
      clearTimeout(this.levelBannerTimer);
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.syncCanvasSize();
    if (this.playing && !this.gameOver) {
      this.draw();
    } else if (!this.gameOver) {
      this.drawIdle();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(ev: KeyboardEvent): void {
    const k = ev.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
      this.keys.left = true;
      ev.preventDefault();
    }
    if (k === 'ArrowRight' || k === 'd' || k === 'D') {
      this.keys.right = true;
      ev.preventDefault();
    }
    if (k === ' ' && this.playing && this.ballOnPaddle) {
      ev.preventDefault();
      this.launchBall();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(ev: KeyboardEvent): void {
    const k = ev.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
      this.keys.left = false;
    }
    if (k === 'ArrowRight' || k === 'd' || k === 'D') {
      this.keys.right = false;
    }
  }

  loadLeaderboard(): void {
    this.leaderboardLoading = true;
    this.leaderboardError = false;
    this.arcadeArkanoid
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
        this.leaderboard = res?.success && res.data?.rows ? res.data.rows : [];
      });
  }

  startGame(): void {
    this.syncCanvasSize();
    this.gameOver = false;
    this.qualifiesForRank = false;
    this.rankCheckComplete = false;
    this.score = 0;
    this.level = 1;
    this.lives = 3;
    this.playerName = '';
    this.buildBricks();
    this.resetBallOnPaddle();
    this.playing = true;
    this.showLevelBanner();
    this.startLoop();
  }

  saveScore(): void {
    if (!this.qualifiesForRank || this.submitLoading) {
      return;
    }
    this.submitLoading = true;
    this.arcadeArkanoid
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
    this.stopLoop();
    this.drawIdle();
    this.cdr.markForCheck();
  }

  private startLoop(): void {
    this.stopLoop();
    const tick = () => {
      if (this.playing && !this.gameOver) {
        this.step();
        this.draw();
      }
      this.animId = requestAnimationFrame(tick);
    };
    this.animId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  private launchBall(): void {
    if (!this.ballOnPaddle) {
      return;
    }
    this.ballOnPaddle = false;
    const speed = 4.2 + this.level * 0.15;
    this.ballVx = speed * (Math.random() > 0.5 ? 1 : -1);
    this.ballVy = -speed;
  }

  private resetBallOnPaddle(): void {
    this.ballOnPaddle = true;
    this.ballX = this.paddleX + PADDLE_W / 2;
    this.ballY = PADDLE_Y - BALL_R - 2;
    this.ballVx = 0;
    this.ballVy = 0;
  }

  private buildBricks(): void {
    this.bricks = [];
    const stage = getArkanoidIiLevel(this.level);
    this.levelRoundLabel = formatRoundLabel(stage.round);
    this.levelTitle = stage.title;
    const grid = stage.rows;
    const gridRows = grid.length;
    const marginX = 16;
    const usableW = GAME_W - marginX * 2;
    const brickW = (usableW - BRICK_PAD * (ARKANOID_II_COLS - 1)) / ARKANOID_II_COLS;
    const brickH = Math.min(15, Math.floor(210 / Math.max(gridRows, 1)));

    for (let row = 0; row < gridRows; row++) {
      const line = grid[row];
      for (let col = 0; col < line.length && col < ARKANOID_II_COLS; col++) {
        const ch = line[col];
        const def = getBrickCellDef(ch);
        if (!def?.color) {
          continue;
        }
        const x = marginX + col * (brickW + BRICK_PAD);
        const y = BRICK_TOP + row * (brickH + BRICK_PAD);
        const rowBonus = (gridRows - row + 1) * 10 * this.level;
        const basePoints = def.points ?? 10;
        this.bricks.push({
          x,
          y,
          w: brickW,
          h: brickH,
          alive: true,
          color: def.color,
          points: Math.round(rowBonus * (basePoints / 10)),
          hitsLeft: def.hits ?? 1,
          indestructible: def.indestructible ?? false
        });
      }
    }
  }

  private step(): void {
    const paddleSpeed = 7.5;
    if (this.keys.left) {
      this.paddleX -= paddleSpeed;
    }
    if (this.keys.right) {
      this.paddleX += paddleSpeed;
    }
    this.paddleX = Math.max(8, Math.min(GAME_W - PADDLE_W - 8, this.paddleX));

    if (this.ballOnPaddle) {
      this.ballX = this.paddleX + PADDLE_W / 2;
      this.ballY = PADDLE_Y - BALL_R - 2;
      return;
    }

    this.ballX += this.ballVx;
    this.ballY += this.ballVy;

    if (this.ballX - BALL_R <= 0) {
      this.ballX = BALL_R;
      this.ballVx = Math.abs(this.ballVx);
    } else if (this.ballX + BALL_R >= GAME_W) {
      this.ballX = GAME_W - BALL_R;
      this.ballVx = -Math.abs(this.ballVx);
    }
    if (this.ballY - BALL_R <= PLAY_TOP) {
      this.ballY = PLAY_TOP + BALL_R;
      this.ballVy = Math.abs(this.ballVy);
    }

    if (
      this.ballY + BALL_R >= PADDLE_Y &&
      this.ballY - BALL_R <= PADDLE_Y + PADDLE_H &&
      this.ballVx !== 0 &&
      this.ballVy > 0 &&
      this.ballX >= this.paddleX - BALL_R &&
      this.ballX <= this.paddleX + PADDLE_W + BALL_R
    ) {
      this.ballY = PADDLE_Y - BALL_R;
      const hit = (this.ballX - this.paddleX) / PADDLE_W - 0.5;
      const speed = Math.hypot(this.ballVx, this.ballVy) * 1.02;
      this.ballVx = hit * speed * 1.35;
      this.ballVy = -Math.abs(this.ballVy);
      const maxVx = 9;
      this.ballVx = Math.max(-maxVx, Math.min(maxVx, this.ballVx));
    }

    for (const b of this.bricks) {
      if (!b.alive) {
        continue;
      }
      if (this.circleRectHit(this.ballX, this.ballY, BALL_R, b.x, b.y, b.w, b.h)) {
        const overlapLeft = this.ballX + BALL_R - b.x;
        const overlapRight = b.x + b.w - (this.ballX - BALL_R);
        const overlapTop = this.ballY + BALL_R - b.y;
        const overlapBottom = b.y + b.h - (this.ballY - BALL_R);
        const minOverlapX = Math.min(overlapLeft, overlapRight);
        const minOverlapY = Math.min(overlapTop, overlapBottom);
        if (minOverlapX < minOverlapY) {
          this.ballVx = -this.ballVx;
        } else {
          this.ballVy = -this.ballVy;
        }
        if (!b.indestructible) {
          b.hitsLeft--;
          if (b.hitsLeft <= 0) {
            b.alive = false;
            this.score += b.points;
          } else {
            b.color = '#cbd5e1';
          }
        }
        break;
      }
    }

    if (this.ballY - BALL_R > GAME_H) {
      this.lives--;
      if (this.lives <= 0) {
        this.endGame();
        return;
      }
      this.resetBallOnPaddle();
      return;
    }

    if (this.bricks.filter((b) => !b.indestructible).every((b) => !b.alive)) {
      this.level++;
      this.showLevelBanner();
      this.buildBricks();
      this.resetBallOnPaddle();
    }
  }

  private circleRectHit(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number): boolean {
    const nearX = Math.max(rx, Math.min(cx, rx + rw));
    const nearY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearX;
    const dy = cy - nearY;
    return dx * dx + dy * dy <= r * r;
  }

  private showLevelBanner(): void {
    this.levelBanner = true;
    if (this.levelBannerTimer) {
      clearTimeout(this.levelBannerTimer);
    }
    this.levelBannerTimer = setTimeout(() => {
      this.levelBanner = false;
      this.cdr.markForCheck();
    }, 1400);
    this.cdr.markForCheck();
  }

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
      this.arcadeArkanoid.getLeaderboard().pipe(catchError(() => of(null))),
      this.arcadeArkanoid.qualifies(finalScore).pipe(catchError(() => of(null)))
    ]).subscribe(([lbRes, qRes]) => {
      if (lbRes?.success && lbRes.data?.rows) {
        this.leaderboard = lbRes.data.rows;
        this.leaderboardError = false;
      }
      if (qRes?.success && typeof qRes.data === 'boolean') {
        this.qualifiesForRank = qRes.data;
      } else {
        this.applyLocalQualifyEstimate(finalScore);
      }
      this.rankCheckComplete = true;
      this.cdr.markForCheck();
    });
  }

  private applyLocalQualifyEstimate(finalScore: number): void {
    if (this.leaderboard.length < 20) {
      this.qualifiesForRank = true;
      return;
    }
    const row20 = this.leaderboard[19];
    this.qualifiesForRank = row20 != null && finalScore > row20.score;
  }

  private syncCanvasSize(): void {
    const pad = 28;
    const sideBySide = window.innerWidth >= 960;
    const rankingReserve = sideBySide ? 400 : 0;
    const availW = Math.max(280, window.innerWidth - pad * 2 - rankingReserve);
    const availH = sideBySide ? Math.max(280, window.innerHeight - 200) : Math.max(240, window.innerHeight - 340);
    this.scale = Math.min(1.4, availW / GAME_W, availH / GAME_H);
    const c = this.canvasRef.nativeElement;
    c.width = Math.round(GAME_W * this.scale);
    c.height = Math.round(GAME_H * this.scale);
  }

  private drawIdle(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.fillStyle = '#0a0818';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.fillStyle = '#b39ddb';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CERBERO — ARKANOID', GAME_W / 2, GAME_H / 2 - 16);
    ctx.fillStyle = '#9fa8da';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('Pulsa INICIAR', GAME_W / 2, GAME_H / 2 + 20);
    ctx.restore();
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.fillStyle = '#0a0818';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    ctx.strokeStyle = 'rgba(126, 87, 202, 0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, PLAY_TOP + 0.5, GAME_W - 1, PADDLE_Y - PLAY_TOP - 12);

    for (const b of this.bricks) {
      if (!b.alive) {
        continue;
      }
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    }

    ctx.fillStyle = '#7e57c2';
    ctx.fillRect(this.paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.ballX, this.ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 32px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', GAME_W / 2, GAME_H / 2);
    }
    ctx.restore();
  }
}
