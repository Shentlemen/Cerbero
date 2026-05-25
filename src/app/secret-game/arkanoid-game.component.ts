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
import {
  CAPSULE_AUTO_RELEASE_MS,
  CAPSULE_CYCLE_MS,
  CAPSULE_FALL_SPEED,
  CAPSULE_H,
  CAPSULE_W,
  capsuleBricksForLevel,
  CATCH_AUTO_RELEASE_MS,
  DISRUPT_BALL_COUNT,
  LASER_FIRE_COOLDOWN_MS,
  LASER_H,
  LASER_SPEED,
  LASER_W,
  MAX_LASERS_ON_SCREEN,
  POWERUP_META,
  powerUpLabel,
  randomTier2PowerUp,
  seededShuffle,
  Tier2PowerUp
} from './arkanoid-powerups';

const GAME_W = 600;
const GAME_H = 450;
const PADDLE_W = 88;
const PADDLE_H = 10;
const BALL_R = 5;
const BRICK_PAD = 3;
const PLAY_TOP = 8;
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
  /** Ladrillo que esconde cápsula (2 golpes: revelar → soltar). */
  hasCapsule: boolean;
  capsuleRevealed: boolean;
  capsuleType: Tier2PowerUp;
  capsuleRevealedAt: number;
  lastCapsuleCycleAt: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onPaddle: boolean;
  mega: boolean;
}

interface FallingCapsule {
  x: number;
  y: number;
  vy: number;
  type: Tier2PowerUp;
}

interface LaserShot {
  x: number;
  y: number;
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
  levelBanner = false;
  levelRoundLabel = '';
  levelTitle = '';
  activePowerLabel = '';
  playerName = '';
  leaderboard: ArkanoidScoreRow[] = [];
  leaderboardError = false;
  leaderboardLoading = false;
  submitLoading = false;
  qualifiesForRank = false;
  rankCheckComplete = false;

  /** Para hints en plantilla */
  get ballOnPaddle(): boolean {
    return this.balls.some((b) => b.onPaddle);
  }

  get hasCatch(): boolean {
    return this.activePower === 'C';
  }

  get hasLaser(): boolean {
    return this.activePower === 'L';
  }

  private ctx!: CanvasRenderingContext2D;
  private scale = 1;
  private animId: number | null = null;
  private bricks: Brick[] = [];
  private balls: Ball[] = [];
  private fallingCapsules: FallingCapsule[] = [];
  private lasers: LaserShot[] = [];
  private paddleX = GAME_W / 2 - PADDLE_W / 2;
  private keys = { left: false, right: false };
  private levelBannerTimer: ReturnType<typeof setTimeout> | null = null;
  private activePower: Tier2PowerUp | null = null;
  private catchReleaseAt = 0;
  private lastLaserFireAt = 0;

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
    if (k === ' ' && this.playing && !this.gameOver) {
      ev.preventDefault();
      if (this.ballOnPaddle) {
        this.launchBalls();
      } else if (this.activePower === 'L') {
        this.fireLaser();
      }
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
    this.clearPower();
    this.fallingCapsules = [];
    this.lasers = [];
    this.buildBricks();
    this.resetBallsOnPaddle();
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

  private clearPower(): void {
    this.activePower = null;
    this.activePowerLabel = '';
    this.catchReleaseAt = 0;
    for (const b of this.balls) {
      b.mega = false;
    }
  }

  private applyPower(type: Tier2PowerUp): void {
    this.clearPower();
    this.activePower = type;
    this.activePowerLabel = powerUpLabel(type);
    if (type === 'M') {
      for (const b of this.balls) {
        b.mega = true;
      }
    }
    if (type === 'D') {
      this.applyDisrupt();
    }
    this.cdr.markForCheck();
  }

  private applyDisrupt(): void {
    const src = this.balls.find((b) => !b.onPaddle && (b.vx !== 0 || b.vy !== 0));
    const base = src ?? this.balls[0];
    const speed = Math.hypot(base.vx, base.vy) || 4.2 + this.level * 0.15;
    const angle0 = Math.atan2(base.vy, base.vx || -1);
    const newBalls: Ball[] = [];
    for (let i = 0; i < DISRUPT_BALL_COUNT; i++) {
      const spread = ((i / DISRUPT_BALL_COUNT) * 2 - 1) * 0.85;
      const a = angle0 + spread;
      newBalls.push({
        x: base.x,
        y: base.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        onPaddle: false,
        mega: base.mega
      });
    }
    this.balls = newBalls;
  }

  private canSpawnFallingCapsule(): boolean {
    if (this.fallingCapsules.length > 0) {
      return false;
    }
    if (this.activePower === 'D' && this.balls.filter((b) => !b.onPaddle).length > 1) {
      return false;
    }
    return true;
  }

  private spawnCapsule(cx: number, cy: number, type: Tier2PowerUp): void {
    if (!this.canSpawnFallingCapsule()) {
      return;
    }
    this.fallingCapsules.push({
      x: cx - CAPSULE_W / 2,
      y: cy,
      vy: CAPSULE_FALL_SPEED,
      type
    });
  }

  private stepCapsuleBricks(): void {
    const now = performance.now();
    for (const b of this.bricks) {
      if (!b.alive || !b.hasCapsule || !b.capsuleRevealed) {
        continue;
      }
      if (now - b.lastCapsuleCycleAt >= CAPSULE_CYCLE_MS) {
        b.capsuleType = randomTier2PowerUp();
        b.lastCapsuleCycleAt = now;
      }
      if (now - b.capsuleRevealedAt >= CAPSULE_AUTO_RELEASE_MS) {
        this.releaseCapsuleFromBrick(b);
      }
    }
  }

  private releaseCapsuleFromBrick(b: Brick): void {
    if (!b.alive || !b.hasCapsule) {
      return;
    }
    this.spawnCapsule(b.x + b.w / 2, b.y + b.h / 2, b.capsuleType);
    b.alive = false;
    this.score += b.points;
    b.hasCapsule = false;
    b.capsuleRevealed = false;
  }

  private launchBalls(): void {
    const speed = 4.2 + this.level * 0.15;
    for (const b of this.balls) {
      if (!b.onPaddle) {
        continue;
      }
      b.onPaddle = false;
      b.vx = speed * (Math.random() > 0.5 ? 1 : -1);
      b.vy = -speed;
    }
    this.catchReleaseAt = 0;
  }

  private resetBallsOnPaddle(): void {
    this.balls = [
      {
        x: this.paddleX + PADDLE_W / 2,
        y: PADDLE_Y - BALL_R - 2,
        vx: 0,
        vy: 0,
        onPaddle: true,
        mega: this.activePower === 'M'
      }
    ];
  }

  private fireLaser(): void {
    const now = performance.now();
    if (now - this.lastLaserFireAt < LASER_FIRE_COOLDOWN_MS) {
      return;
    }
    if (this.lasers.length >= MAX_LASERS_ON_SCREEN) {
      return;
    }
    this.lastLaserFireAt = now;
    const cx = this.paddleX + PADDLE_W / 2;
    this.lasers.push({ x: cx - LASER_W / 2, y: PADDLE_Y - LASER_H });
  }

  private buildBricks(): void {
    this.bricks = [];
    this.fallingCapsules = [];
    this.lasers = [];
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
          indestructible: def.indestructible ?? false,
          hasCapsule: false,
          capsuleRevealed: false,
          capsuleType: 'C',
          capsuleRevealedAt: 0,
          lastCapsuleCycleAt: 0
        });
      }
    }
    this.assignCapsuleBricks();
  }

  /** Como Arkanoid II: pocos ladrillos de color marcados en el diseño del nivel. */
  private assignCapsuleBricks(): void {
    const candidates = this.bricks.filter((b) => b.alive && !b.indestructible && b.hitsLeft === 1);
    const n = capsuleBricksForLevel(candidates.length, this.level);
    if (n <= 0) {
      return;
    }
    const picked = seededShuffle(candidates, this.level * 9973 + 42).slice(0, n);
    for (const b of picked) {
      b.hasCapsule = true;
      b.hitsLeft = 2;
      b.capsuleType = randomTier2PowerUp();
    }
  }

  private damageBrick(b: Brick, fromMega = false): void {
    if (b.indestructible && !fromMega) {
      return;
    }
    if (b.indestructible && fromMega) {
      b.alive = false;
      this.score += Math.max(b.points, 50);
      return;
    }

    if (b.hasCapsule && !b.capsuleRevealed) {
      const now = performance.now();
      b.capsuleRevealed = true;
      b.capsuleRevealedAt = now;
      b.lastCapsuleCycleAt = now;
      b.capsuleType = randomTier2PowerUp();
      return;
    }

    if (b.hasCapsule && b.capsuleRevealed) {
      this.releaseCapsuleFromBrick(b);
      return;
    }

    b.hitsLeft--;
    if (b.hitsLeft <= 0) {
      b.alive = false;
      this.score += b.points;
    } else {
      b.color = '#cbd5e1';
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

    this.stepCapsuleBricks();
    this.stepCapsules();
    this.stepLasers();

    for (const b of this.balls) {
      if (b.onPaddle) {
        b.x = this.paddleX + PADDLE_W / 2;
        b.y = PADDLE_Y - BALL_R - 2;
      }
    }
    if (this.activePower === 'C' && this.catchReleaseAt > 0 && performance.now() >= this.catchReleaseAt) {
      this.launchBalls();
    }

    const activeBalls: Ball[] = [];
    for (const ball of this.balls) {
      if (ball.onPaddle) {
        activeBalls.push(ball);
        continue;
      }
      this.stepBall(ball);
      if (ball.y - BALL_R <= GAME_H + 20) {
        activeBalls.push(ball);
      }
    }
    this.balls = activeBalls;

    if (this.balls.length === 0) {
      this.loseLife();
      return;
    }

    if (this.bricks.filter((br) => !br.indestructible).every((br) => !br.alive)) {
      this.advanceLevel();
    }
  }

  private stepCapsules(): void {
    const paddleTop = PADDLE_Y;
    const paddleBottom = PADDLE_Y + PADDLE_H;
    const next: FallingCapsule[] = [];

    for (const cap of this.fallingCapsules) {
      cap.y += cap.vy;
      const capCx = cap.x + CAPSULE_W / 2;
      const capCy = cap.y + CAPSULE_H / 2;

      if (
        cap.y + CAPSULE_H >= paddleTop &&
        cap.y <= paddleBottom &&
        capCx >= this.paddleX &&
        capCx <= this.paddleX + PADDLE_W
      ) {
        this.applyPower(cap.type);
        continue;
      }

      if (cap.y < GAME_H + 20) {
        next.push(cap);
      }
    }
    this.fallingCapsules = next;
  }

  private stepLasers(): void {
    const next: LaserShot[] = [];
    for (const laser of this.lasers) {
      laser.y -= LASER_SPEED;
      if (laser.y + LASER_H < PLAY_TOP) {
        continue;
      }
      let hit = false;
      for (const b of this.bricks) {
        if (!b.alive) {
          continue;
        }
        if (
          laser.x < b.x + b.w &&
          laser.x + LASER_W > b.x &&
          laser.y < b.y + b.h &&
          laser.y + LASER_H > b.y
        ) {
          this.damageBrick(b);
          hit = true;
          break;
        }
      }
      if (!hit) {
        next.push(laser);
      }
    }
    this.lasers = next;
  }

  private stepBall(ball: Ball): void {
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x - BALL_R <= 0) {
      ball.x = BALL_R;
      if (!ball.mega) {
        ball.vx = Math.abs(ball.vx);
      } else {
        ball.vx = Math.abs(ball.vx);
      }
    } else if (ball.x + BALL_R >= GAME_W) {
      ball.x = GAME_W - BALL_R;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - BALL_R <= PLAY_TOP) {
      ball.y = PLAY_TOP + BALL_R;
      ball.vy = Math.abs(ball.vy);
    }

    if (
      ball.y + BALL_R >= PADDLE_Y &&
      ball.y - BALL_R <= PADDLE_Y + PADDLE_H &&
      ball.vy > 0 &&
      ball.x >= this.paddleX - BALL_R &&
      ball.x <= this.paddleX + PADDLE_W + BALL_R
    ) {
      if (this.activePower === 'C') {
        ball.onPaddle = true;
        ball.vx = 0;
        ball.vy = 0;
        ball.y = PADDLE_Y - BALL_R - 2;
        ball.x = this.paddleX + PADDLE_W / 2;
        this.catchReleaseAt = performance.now() + CATCH_AUTO_RELEASE_MS;
        return;
      }
      ball.y = PADDLE_Y - BALL_R;
      const hit = (ball.x - this.paddleX) / PADDLE_W - 0.5;
      const speed = Math.hypot(ball.vx, ball.vy) * 1.02;
      ball.vx = hit * speed * 1.35;
      ball.vy = -Math.abs(ball.vy);
      const maxVx = 9;
      ball.vx = Math.max(-maxVx, Math.min(maxVx, ball.vx));
    }

    for (const b of this.bricks) {
      if (!b.alive) {
        continue;
      }
      if (!this.circleRectHit(ball.x, ball.y, BALL_R, b.x, b.y, b.w, b.h)) {
        continue;
      }

      if (ball.mega) {
        this.damageBrick(b, true);
        continue;
      }

      const overlapLeft = ball.x + BALL_R - b.x;
      const overlapRight = b.x + b.w - (ball.x - BALL_R);
      const overlapTop = ball.y + BALL_R - b.y;
      const overlapBottom = b.y + b.h - (ball.y - BALL_R);
      const minOverlapX = Math.min(overlapLeft, overlapRight);
      const minOverlapY = Math.min(overlapTop, overlapBottom);
      if (minOverlapX < minOverlapY) {
        ball.vx = -ball.vx;
      } else {
        ball.vy = -ball.vy;
      }
      if (!b.indestructible) {
        this.damageBrick(b);
      }
      break;
    }
  }

  private loseLife(): void {
    this.lives--;
    if (this.lives <= 0) {
      this.endGame();
      return;
    }
    if (this.activePower === 'D') {
      this.clearPower();
    }
    this.resetBallsOnPaddle();
  }

  private advanceLevel(): void {
    this.level++;
    this.clearPower();
    this.showLevelBanner();
    this.buildBricks();
    this.resetBallsOnPaddle();
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
    this.clearPower();
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
      if (b.hasCapsule && b.capsuleRevealed) {
        const meta = POWERUP_META[b.capsuleType];
        const cx = b.x + b.w / 2;
        const cy = b.y - CAPSULE_H - 2;
        ctx.fillStyle = meta.fill;
        ctx.fillRect(cx - CAPSULE_W / 2, cy, CAPSULE_W, CAPSULE_H);
        ctx.strokeStyle = meta.stroke;
        ctx.strokeRect(cx - CAPSULE_W / 2 + 0.5, cy + 0.5, CAPSULE_W - 1, CAPSULE_H - 1);
        ctx.fillStyle = '#0a0818';
        ctx.font = 'bold 8px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(meta.letter, cx, cy + CAPSULE_H / 2);
      } else if (b.hasCapsule) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(b.x + b.w / 2 - 2, b.y + 2, 4, 4);
      }
    }

    for (const cap of this.fallingCapsules) {
      const meta = POWERUP_META[cap.type];
      ctx.fillStyle = meta.fill;
      ctx.fillRect(cap.x, cap.y, CAPSULE_W, CAPSULE_H);
      ctx.strokeStyle = meta.stroke;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cap.x + 0.5, cap.y + 0.5, CAPSULE_W - 1, CAPSULE_H - 1);
      ctx.fillStyle = '#0a0818';
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta.letter, cap.x + CAPSULE_W / 2, cap.y + CAPSULE_H / 2 + 0.5);
    }

    for (const laser of this.lasers) {
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(laser.x, laser.y, LASER_W, LASER_H);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(laser.x + 1, laser.y, 1, LASER_H);
    }

    ctx.fillStyle = '#7e57c2';
    ctx.fillRect(this.paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);
    if (this.activePower === 'L') {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(this.paddleX, PADDLE_Y - 3, PADDLE_W, 3);
    }

    for (const ball of this.balls) {
      if (ball.onPaddle) {
        continue;
      }
      ctx.fillStyle = ball.mega ? '#fb923c' : '#fff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.mega ? BALL_R + 1 : BALL_R, 0, Math.PI * 2);
      ctx.fill();
      if (ball.mega) {
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    for (const ball of this.balls) {
      if (!ball.onPaddle) {
        continue;
      }
      ctx.fillStyle = ball.mega ? '#fb923c' : '#fff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.activePowerLabel) {
      ctx.fillStyle = 'rgba(126, 87, 202, 0.35)';
      ctx.fillRect(8, GAME_H - 22, 120, 16);
      ctx.fillStyle = '#e1bee7';
      ctx.font = '11px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.activePowerLabel.toUpperCase(), 14, GAME_H - 14);
    }

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
