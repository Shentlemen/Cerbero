export interface Alerta {
  id: number;
  hardwareId: number;
  pcName: string;
  fecha: string;
  memory: boolean;
  disk: boolean;
  ip: boolean;
  video: boolean;
  monitor: boolean;
  storageHw: boolean;
  softwareForbidden: boolean;
  confirmada: boolean;
  valorAnterior?: string;
  valorNuevo?: string;
  new_hardware: number;
}
