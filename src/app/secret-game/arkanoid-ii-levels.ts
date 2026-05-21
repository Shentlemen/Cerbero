/**
 * Pantallas Arkanoid II — grilla fija 13×N (como el NES).
 *
 * Cada fila del array `rows` es exactamente {@link ARKANOID_II_COLS} caracteres.
 * Un carácter = una celda: color, golpes para romper y si es indestructible.
 *
 * Leyenda: r o y g c b w p · s plata (2 golpes) · G oro (indestructible) · `.` vacío
 */
export interface ArkanoidIiLevel {
  round: string;
  title: string;
  rows: string[];
  palette?: Record<string, string>;
}

export interface BrickCellDef {
  color: string;
  /** Golpes para destruir (default 1). */
  hits?: number;
  indestructible?: boolean;
  points?: number;
}

export const ARKANOID_II_COLS = 13;

/** Definición por carácter (plantilla 2D del nivel). */
export const BRICK_CELLS: Record<string, BrickCellDef> = {
  '.': { color: '' },
  r: { color: '#ef4444', points: 10 },
  o: { color: '#f97316', points: 10 },
  y: { color: '#eab308', points: 10 },
  g: { color: '#22c55e', points: 10 },
  c: { color: '#22d3ee', points: 10 },
  b: { color: '#3b82f6', points: 10 },
  w: { color: '#f8fafc', points: 10 },
  p: { color: '#ec4899', points: 10 },
  s: { color: '#94a3b8', hits: 2, points: 15 },
  G: { color: '#fbbf24', indestructible: true, points: 0 }
};

export const ARKANOID_II_PALETTE: Record<string, string> = Object.fromEntries(
  Object.entries(BRICK_CELLS).map(([k, v]) => [k, v.color])
);

/**
 * Arma la grilla sin centrar ni recortar: cada línea debe medir 13 caracteres.
 * (Antes `row()` centraba filas cortas y deformaba cruces, escaleras, etc.)
 */
export function grid(...lines: string[]): string[] {
  return lines.map((line, index) => {
    const t = line.replace(/ /g, '.');
    if (t.length === ARKANOID_II_COLS) {
      return t;
    }
    if (t.length > ARKANOID_II_COLS) {
      console.warn(`[arkanoid] Fila ${index + 1} truncada (${t.length}→${ARKANOID_II_COLS}): ${t}`);
      return t.slice(0, ARKANOID_II_COLS);
    }
    console.warn(`[arkanoid] Fila ${index + 1} rellenada a la derecha (${t.length}→${ARKANOID_II_COLS}): ${t}`);
    return t.padEnd(ARKANOID_II_COLS, '.');
  });
}

export function getBrickCellDef(ch: string): BrickCellDef | null {
  if (ch === '.' || !BRICK_CELLS[ch]) {
    return null;
  }
  return BRICK_CELLS[ch];
}

export const ARKANOID_II_LEVELS: ArkanoidIiLevel[] = [
  {
    round: 'L-01',
    title: 'Cruz',
    rows: grid(
      '.s....r....s.',
      '.s...rrr...s.',
      '..s.rrrrr.s..',
      '...rrrrrrr...',
      '..rrrrrrrrr..',
      '.rrrrrrrrrrr.',
      '...rrrrrrr...',
      '....rrrrr....',
      '...bbbbbbb...',
      '..bbbbbbbbb..',
      '.bbbbbbbbbbb.',
      '...bbbbbbb...',
      '.s....b....s.'
    )
  },
  {
    round: 'R-01',
    title: 'Nave',
    rows: grid(
      '......w......',
      '.....www.....',
      '....wwwww....',
      '...ccccccc...',
      '..ccccccccc..',
      '.ccccccccccc.',
      'yyyyyyyyyyyyy',
      '.ggggggggggg.',
      '..bbbbbbbbb..',
      '...rrrrrrr...',
      '....rrrrr....'
    )
  },
  {
    round: 'L-02',
    title: 'Arco iris',
    rows: grid(
      '......r......',
      '.....ror.....',
      '....royog....',
      '...roygcb....',
      '..roygcbwr...',
      '.roygcbwrygcb',
      '..roygcbwr...',
      '...roygcb....',
      '....royog....',
      '.....ror.....',
      '......r......'
    )
  },
  {
    round: 'R-02',
    title: 'Franjas',
    rows: grid(
      'rrrrrrrrrrrrr',
      'ooooooooooooo',
      'yyyyyyyyyyyyy',
      'ggggggggggggg',
      'ccccccccccccc',
      'bbbbbbbbbbbbb',
      'wwwwwwwwwwwww'
    )
  },
  {
    round: 'L-03',
    title: 'Tenis',
    rows: grid(
      '.....rrrr....',
      '....rrrrrr...',
      '...wwwwwww...',
      '...ww..bbb...',
      '...ww.b..b...',
      '...ww..bbb...',
      '....wwwww....',
      '.....www.....',
      '......w......'
    )
  },
  {
    round: 'R-03',
    title: 'Globo',
    rows: grid(
      '......r......',
      '.....ror.....',
      '....ryoyr....',
      '...ryoyoyr...',
      '..ryoyoyoyr..',
      '.ryoyoyoyoyr.',
      '...oyoyoy....',
      '....ooo......',
      '.....o.......',
      '.....o.......',
      '....ooo......'
    )
  },
  {
    round: 'L-04',
    title: 'Escalera',
    rows: grid(
      'r............',
      'or...........',
      'yor..........',
      'gyor.........',
      'cgyor........',
      'bcgyor.......',
      'wbcgyor......',
      'wbcgyor......',
      'wbcgyor......',
      'wbcgyor......',
      'wbcgyor......'
    )
  },
  {
    round: 'R-04',
    title: 'Diamante',
    rows: grid(
      '......w......',
      '.....wcw.....',
      '....wcbcw....',
      '...wcbcbcw...',
      '..wcbcbcbcw..',
      '.wcbcbcbcbcw.',
      '..wcbcbcbcw..',
      '...wcbcbcw...',
      '....wcbcw....',
      '.....wcw.....',
      '......w......',
      '.....sss.....',
      '....sssss....'
    )
  },
  {
    round: 'L-10',
    title: 'Columnas',
    rows: grid(
      'r.r.r.r.r.r.r',
      'rorororororor',
      'r.r.r.r.r.r.r',
      '.............',
      'g.g.g.g.g.g.g',
      'gogogogogogog',
      'g.g.g.g.g.g.g',
      '.............',
      'b.b.b.b.b.b.b',
      'bobobobobobob',
      'b.b.b.b.b.b.b'
    )
  },
  {
    round: 'R-10',
    title: 'Mosaico',
    rows: grid(
      'rygcbwrygcbwr',
      'ygcbwrygcbwry',
      'gcbwrygcbwryg',
      'cbwrygcbwrygc',
      'bwrygcbwrygcb',
      'wrygcbwrygcbw',
      'rygcbwrygcbwr',
      'ygcbwrygcbwry',
      'gcbwrygcbwryg',
      'cbwrygcbwrygc'
    )
  },
  {
    round: 'L-17',
    title: 'Cerebro',
    rows: grid(
      '.....ppp.....',
      '....ppppp....',
      '...ppppppp...',
      '..ppppppppp..',
      '.ppppppppppp.',
      'ppppppppppppp',
      'ppppppppppppp',
      '.ppppppppppp.',
      '..ppppppppp..',
      '...ppppppp...',
      '....ppppp....',
      '.....ppp.....'
    )
  },
  {
    round: 'L-19',
    title: 'Corazón',
    rows: grid(
      '..rr.....rr..',
      '.rrrr...rrrr.',
      'rrrrrrrrrrrrr',
      'rrrrrrrrrrrrr',
      '.rrrrrrrrrrr.',
      '..rrrrrrrrr..',
      '...rrrrrrr...',
      '....rrrrr....',
      '.....rrr.....',
      '......r......'
    )
  },
  {
    round: 'L-27',
    title: 'Cerveza',
    rows: grid(
      '.....www.....',
      '....wwwww....',
      '...wwwwwww...',
      '...yyyyyyy...',
      '...yyyyyyy...',
      '...yyyyyyy...',
      '...yyyyyyy...',
      '....ooooo....',
      '.....ooo.....',
      '......o......'
    )
  },
  {
    round: 'R-25',
    title: 'Despertador',
    rows: grid(
      '..b.......b..',
      '.bbbbbbbbbbb.',
      'bwwwwwwwwwwwb',
      'bwywywywywywb',
      'bwwwwwwwwwwwb',
      '.bbbbbbbbbbb.',
      '....bbbbb....',
      '.....bbb.....',
      '......b......'
    )
  },
  {
    round: 'L-28',
    title: 'Helicóptero',
    rows: grid(
      '....rrrrr....',
      '...rrrrrrr...',
      'rrrrrrrrrrrrr',
      '.....ggg.....',
      '....ggggg....',
      '...ggggggg...',
      '....ggggg....',
      '.....ggg.....',
      '......g......',
      '......g......'
    )
  },
  {
    round: 'R-29',
    title: 'Tomate',
    rows: grid(
      '......g......',
      '.....ggg.....',
      '....rrrrr....',
      '...rrrrrrr...',
      '..rrrrrrrrr..',
      '.rrrrrrrrrrr.',
      'rrrrrrrrrrrrr',
      '.rrrrrrrrrrr.',
      '..rrrrrrrrr..',
      '...rrrrrrr...',
      '....rrrrr....'
    )
  },
  {
    round: 'L-24',
    title: 'Marco',
    rows: grid(
      'GGGGGGGGGGGGG',
      'G...........G',
      'G..rrrrrrr..G',
      'G..r.....r..G',
      'G..r.....r..G',
      'G..rrrrrrr..G',
      'G...........G',
      'GGGGGGGGGGGGG'
    )
  },
  {
    round: 'VS',
    title: 'VS Mode',
    rows: grid(
      'rrrrrrrrrrrrr',
      '.............',
      'ggggggggggggg',
      '.............',
      'bbbbbbbbbbbbb',
      '.............',
      'yyyyyyyyyyyyy'
    )
  }
];

export function getArkanoidIiLevel(level: number): ArkanoidIiLevel {
  const index = (Math.max(1, level) - 1) % ARKANOID_II_LEVELS.length;
  return ARKANOID_II_LEVELS[index];
}

export function formatRoundLabel(round: string): string {
  return `ROUND ${round}`;
}
