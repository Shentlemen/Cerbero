export interface EquipoHistorialDTO {
  id: number;
  hardwareId: number | null;
  pcName: string;
  categoria: string;
  tipo: string;
  evento: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  ultimoUsuarioWin: string | null;
  ipEnEvento: string | null;
  usuarioCerberoId: number | null;
  usuarioCerberoNombre: string | null;
  origen: string;
  almacenOrigenId: number | null;
  almacenOrigenNombre: string | null;
  almacenDestinoId: number | null;
  almacenDestinoNombre: string | null;
  observacion: string | null;
  fecha: string | null;
}

export interface EquipoHistorialPageDTO {
  items: EquipoHistorialDTO[];
  total: number;
  page: number;
  size: number;
}
