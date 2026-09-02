import { Almacen } from '../services/almacen.service';

function numero(a: Pick<Almacen, 'numero'> | null | undefined): string {
  return (a?.numero || '').toLowerCase().trim();
}

function nombre(a: Pick<Almacen, 'nombre'> | null | undefined): string {
  return (a?.nombre || '').toLowerCase();
}

export function esAlmacenCementerio(a: Pick<Almacen, 'numero' | 'nombre'> | null | undefined): boolean {
  if (!a) return false;
  const n = numero(a);
  const nom = nombre(a);
  return n === 'alm01' || n === 'alm 01' || nom.includes('subsuelo') || nom.includes('cementerio');
}

/** Pañol 3 / ALM05. No incluye Oficina Laboratorio. */
export function esAlmacenLaboratorio(a: Pick<Almacen, 'numero' | 'nombre'> | null | undefined): boolean {
  if (!a || esAlmacenOficinaLaboratorio(a)) return false;
  const n = numero(a);
  const nom = nombre(a);
  return n === 'alm05' || n === 'alm 05' || nom.includes('pañol 3');
}

export function esAlmacenOficinaLaboratorio(a: Pick<Almacen, 'numero' | 'nombre'> | null | undefined): boolean {
  if (!a) return false;
  const n = numero(a);
  const nom = nombre(a);
  return n === 'ofilab' || n === 'alm ofilab' || nom.includes('oficina laboratorio');
}

export function esAlmacenEspecialSinEstantes(a: Pick<Almacen, 'numero' | 'nombre'> | null | undefined): boolean {
  return esAlmacenCementerio(a) || esAlmacenLaboratorio(a) || esAlmacenOficinaLaboratorio(a);
}

export function findAlmacenCementerio(almacenes: Almacen[]): Almacen | undefined {
  return almacenes.find(esAlmacenCementerio);
}

export function findAlmacenLaboratorio(almacenes: Almacen[]): Almacen | undefined {
  return almacenes.find(esAlmacenLaboratorio);
}

export function findAlmacenOficinaLaboratorio(almacenes: Almacen[]): Almacen | undefined {
  return almacenes.find(esAlmacenOficinaLaboratorio);
}

export const OBS_OFICINA_LABORATORIO = 'Enviado a Oficina Laboratorio para configuración';
