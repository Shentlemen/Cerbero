export interface AlmacenEstanteriaDef {
  id?: number;
  almacenConfigId?: number;
  codigo: string;
  orden?: number;
  cantidadEstantes: number;
  divisionesEstante: string;
}

export interface AlmacenConfig {
  id: number;
  almacen: {
    id: number;
    numero: string;
    nombre: string;
  };
  nombre?: string;
  /** Derivado del backend (resumen legacy); preferir {@link estanterias} */
  cantidadEstanterias: number;
  cantidadEstantesPorEstanteria: number;
  divisionesEstante: string;
  estanterias?: AlmacenEstanteriaDef[];
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

export interface AlmacenConfigCreate {
  almacenId: number;
  nombre?: string;
  cantidadEstanterias?: number;
  cantidadEstantesPorEstanteria?: number;
  divisionesEstante?: string;
  estanterias: AlmacenEstanteriaDef[];
}

/** Lista ordenada de definiciones (o sintéticas desde campos legacy) */
export function estanteriasOrdenadas(cfg: AlmacenConfig): AlmacenEstanteriaDef[] {
  const list = cfg.estanterias;
  if (list && list.length > 0) {
    return [...list].sort(
      (a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.codigo.localeCompare(b.codigo)
    );
  }
  const n = cfg.cantidadEstanterias >= 1 ? cfg.cantidadEstanterias : 1;
  const est =
    cfg.cantidadEstantesPorEstanteria >= 1 ? cfg.cantidadEstantesPorEstanteria : 1;
  const div = cfg.divisionesEstante?.trim() ? cfg.divisionesEstante : 'A,B,C';
  return Array.from({ length: n }, (_, i) => ({
    codigo: `E${i + 1}`,
    orden: i + 1,
    cantidadEstantes: est,
    divisionesEstante: div,
  }));
}

export function defEstanteria(cfg: AlmacenConfig, codigoEstanteria: string): AlmacenEstanteriaDef | undefined {
  const norm = normalizeCodigoEstanteria(codigoEstanteria);
  return estanteriasOrdenadas(cfg).find(
    (d) => normalizeCodigoEstanteria(d.codigo) === norm
  );
}

function normalizeCodigoEstanteria(raw: string): string {
  const t = (raw ?? '').trim().toUpperCase();
  if (!t) return '';
  return t.startsWith('E') ? `E${t.slice(1).trim()}` : `E${t}`;
}
