export interface AlmacenConfig {
  id: number;
  almacen: {
    id: number;
    numero: string;
    nombre: string;
  };
  nombre?: string;
  cantidadEstanterias: number;
  cantidadEstantesPorEstanteria: number;
  divisionesEstante: string; // Formato: "A,B,C" o "A,B,C,D"
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

export interface AlmacenConfigCreate {
  almacenId: number;
  nombre?: string;
  cantidadEstanterias: number;
  cantidadEstantesPorEstanteria: number;
  divisionesEstante: string;
}

