export type TipoUbicacion = 'EQUIPO' | 'DISPOSITIVO' | 'RED';

export interface UbicacionDTO {
    id: number;
    tipo: 'EQUIPO' | 'DISPOSITIVO';
    hardwareId: number | null;
    macaddr: string | null;
    ciudad: string | null;
    departamento: string | null;
    direccion: string | null;
    interno: string | null;
    nombreGerencia: string | null;
    nombreOficina: string | null;
    numeroPuerta: string | null;
    piso: string | null;
    idSubnet: number | null;
    deviceName: string | null;
}

export interface UbicacionSimpleDTO {
    idUbicacion: number;
    idSubnet?: number;
    ciudad?: string;
    departamento?: string;
    direccion?: string;
    interno?: string;
    nombreGerencia: string;
    nombreOficina: string;
    piso: string;
    numeroPuerta?: string;
}

export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data?: T;
} 