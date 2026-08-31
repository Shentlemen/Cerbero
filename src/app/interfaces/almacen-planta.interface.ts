export type AlmacenPlantaTipo = 'ESTANTERIA' | 'HABITACION' | 'PASILLO' | 'MUELLE' | 'OFICINA' | 'STAGING';

export interface AlmacenPlantaOcupacion {
  registros: number;
  unidades: number;
}

export interface AlmacenPlantaObjeto {
  id?: number;
  plantaId?: number;
  tipo: AlmacenPlantaTipo;
  estanteriaCodigo?: string | null;
  etiqueta?: string | null;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  color?: string | null;
  /** Clave local para el editor (objetos aún no persistidos). */
  clientKey?: string;
}

export interface AlmacenPlanta {
  id?: number | null;
  almacenId: number;
  gridCols: number;
  gridRows: number;
  objetos: AlmacenPlantaObjeto[];
  ocupacionPorEstanteria?: Record<string, AlmacenPlantaOcupacion>;
}

export interface PlantaPendingPlacement {
  tipo: AlmacenPlantaTipo;
  estanteriaCodigo?: string | null;
  etiqueta: string;
}

export const PLANTA_TIPOS_ZONA: { tipo: AlmacenPlantaTipo; etiqueta: string; icon: string }[] = [
  { tipo: 'HABITACION', etiqueta: 'Habitación', icon: 'fa-door-open' },
  { tipo: 'PASILLO', etiqueta: 'Pasillo', icon: 'fa-road' },
  { tipo: 'MUELLE', etiqueta: 'Muelle', icon: 'fa-truck' },
  { tipo: 'OFICINA', etiqueta: 'Oficina', icon: 'fa-building' },
  { tipo: 'STAGING', etiqueta: 'Staging', icon: 'fa-boxes' },
];

export const PLANTA_TAMANO_DEFAULT: Record<AlmacenPlantaTipo, { ancho: number; alto: number }> = {
  ESTANTERIA: { ancho: 4, alto: 2 },
  HABITACION: { ancho: 12, alto: 10 },
  PASILLO: { ancho: 2, alto: 8 },
  MUELLE: { ancho: 6, alto: 3 },
  OFICINA: { ancho: 4, alto: 4 },
  STAGING: { ancho: 5, alto: 3 },
};

export const PLANTA_COLORES_ESTANTERIA: string[] = [
  '#38bdf8',
  '#f59e0b',
  '#a78bfa',
  '#fb7185',
  '#2dd4bf',
  '#818cf8',
  '#f97316',
  '#34d399',
  '#e879f9',
  '#60a5fa',
  '#facc15',
  '#f472b6',
];

export function colorEstanteriaPorCodigo(codigo: string | null | undefined): string {
  const n = parseInt(String(codigo || '').replace(/\D/g, ''), 10);
  const idx = Number.isFinite(n) && n > 0 ? n - 1 : 0;
  return PLANTA_COLORES_ESTANTERIA[((idx % PLANTA_COLORES_ESTANTERIA.length) + PLANTA_COLORES_ESTANTERIA.length) % PLANTA_COLORES_ESTANTERIA.length];
}

export function colorFillDeObjeto(obj: Pick<AlmacenPlantaObjeto, 'tipo' | 'color' | 'estanteriaCodigo'>): string | null {
  if (obj.color) {
    return obj.color;
  }
  if (obj.tipo === 'ESTANTERIA') {
    return colorEstanteriaPorCodigo(obj.estanteriaCodigo);
  }
  return null;
}

export function colorTextoSobre(hex: string): string {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map(c => c + c).join('') : n;
  if (full.length !== 6) {
    return '#1e2937';
  }
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.62 ? '#1e2937' : '#ffffff';
}

export function ocupacionDe(
  ocupacion: Record<string, AlmacenPlantaOcupacion> | undefined,
  codigo: string | null | undefined
): AlmacenPlantaOcupacion {
  if (!codigo || !ocupacion) {
    return { registros: 0, unidades: 0 };
  }
  const target = normalizeCodigoEstanteria(codigo);
  for (const [k, v] of Object.entries(ocupacion)) {
    if (normalizeCodigoEstanteria(k) === target) {
      return v;
    }
  }
  return { registros: 0, unidades: 0 };
}

function normalizeCodigoEstanteria(raw: string): string {
  const t = (raw ?? '').trim().toUpperCase();
  if (!t) {
    return '';
  }
  return t.startsWith('E') ? `E${t.slice(1).trim()}` : `E${t}`;
}
