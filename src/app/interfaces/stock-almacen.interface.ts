export interface StockAlmacen {
    id: number;
    item: {
        idItem: number;
        nombreItem: string;
    };
    almacen: {
        id: number;
        numero: string;
        nombre: string;
    };
    estanteria: string;
    estante: string;
    cantidad: number;
    numero?: string;
    descripcion?: string;
    fechaRegistro: string;
}

export interface StockAlmacenCreate {
    idCompra: number;
    itemId: number;
    almacenId: number;
    estanteria: string;
    estante: string;
    cantidad: number;
    numero?: string;
    descripcion?: string;
}

// Nueva interfaz para crear stock con información del ítem directamente
export interface StockAlmacenCreateWithItem {
    compraId: number; // ID de la compra
    itemId: number;   // ID del ítem específico de esa compra
    almacenId: number;
    estanteria: string;
    estante: string;
    cantidad: number;
    numero?: string;
    descripcion?: string;
} 