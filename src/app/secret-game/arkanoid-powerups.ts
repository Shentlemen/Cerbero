/** Power-ups Tier 2 — Arkanoid II (C, L, D, M). */
export type Tier2PowerUp = 'C' | 'L' | 'D' | 'M';

export const TIER2_POWERUPS: Tier2PowerUp[] = ['C', 'L', 'D', 'M'];

export interface PowerUpMeta {
  type: Tier2PowerUp;
  name: string;
  letter: string;
  fill: string;
  stroke: string;
}

export const POWERUP_META: Record<Tier2PowerUp, PowerUpMeta> = {
  C: { type: 'C', name: 'Catch', letter: 'C', fill: '#4ade80', stroke: '#14532d' },
  L: { type: 'L', name: 'Laser', letter: 'L', fill: '#f87171', stroke: '#7f1d1d' },
  D: { type: 'D', name: 'Disrupt', letter: 'D', fill: '#38bdf8', stroke: '#0c4a6e' },
  M: { type: 'M', name: 'Mega', letter: 'M', fill: '#c084fc', stroke: '#581c87' }
};

export const CAPSULE_W = 22;
export const CAPSULE_H = 11;
export const CAPSULE_FALL_SPEED = 2.6;
export const CATCH_AUTO_RELEASE_MS = 4500;
export const LASER_W = 4;
export const LASER_H = 14;
export const LASER_SPEED = 12;
export const MAX_LASERS_ON_SCREEN = 3;
export const LASER_FIRE_COOLDOWN_MS = 140;
export const DISRUPT_BALL_COUNT = 8;

/**
 * En el NES no hay % global por ladrillo roto: solo **algunos** ladrillos de color
 * llevan cápsula (definidos en el nivel). Típico: 1–3 por pantalla.
 */
export const CAPSULE_BRICKS_MIN = 1;
export const CAPSULE_BRICKS_MAX = 3;
/** Proporción aprox. de ladrillos “con cápsula” sobre los de color (no plata/oro). */
export const CAPSULE_BRICK_RATIO = 0.04;
/** 1.er golpe: muestra la cápsula en el ladrillo; cambia de tipo cada ~2 s. */
export const CAPSULE_CYCLE_MS = 2000;
/** Si no pegás otra vez, se suelta sola tras ~5 s (como el original). */
export const CAPSULE_AUTO_RELEASE_MS = 5000;

export function randomTier2PowerUp(): Tier2PowerUp {
  return TIER2_POWERUPS[Math.floor(Math.random() * TIER2_POWERUPS.length)];
}

export function powerUpLabel(type: Tier2PowerUp | null): string {
  return type ? POWERUP_META[type].name : '';
}

/** Mezcla determinista por nivel (misma pantalla = mismos ladrillos con cápsula). */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function capsuleBricksForLevel(coloredBrickCount: number, level: number): number {
  if (coloredBrickCount < 8) {
    return coloredBrickCount >= 4 ? 1 : 0;
  }
  const byRatio = Math.floor(coloredBrickCount * CAPSULE_BRICK_RATIO);
  const base = Math.max(CAPSULE_BRICKS_MIN, byRatio);
  return Math.min(CAPSULE_BRICKS_MAX, base, coloredBrickCount);
}
