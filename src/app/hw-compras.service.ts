import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HwComprasService {

  constructor() { }

  getHwCompras() {
    return [
      { 
        nroEquipo: 1, 
        nroCompra: 101, 
        item: 'Laptop Dell XPS 13', 
        pedido: 'Pedido 001', 
        descripcion: 'Compra de laptop para oficina 101' 
      },
      { 
        nroEquipo: 2, 
        nroCompra: 102, 
        item: 'PC Escritorio HP Pavilion', 
        pedido: 'Pedido 002', 
        descripcion: 'Compra de PC para oficina 102' 
      },
      { 
        nroEquipo: 3, 
        nroCompra: 103, 
        item: 'Laptop Lenovo ThinkPad', 
        pedido: 'Pedido 003', 
        descripcion: 'Compra de laptop para oficina 103' 
      },
      { 
        nroEquipo: 4, 
        nroCompra: 104, 
        item: 'PC Escritorio Acer Aspire', 
        pedido: 'Pedido 004', 
        descripcion: 'Compra de PC para oficina 104' 
      },
      { 
        nroEquipo: 5, 
        nroCompra: 105, 
        item: 'Laptop Apple MacBook Pro', 
        pedido: 'Pedido 005', 
        descripcion: 'Compra de laptop para oficina 105' 
      },
      { 
        nroEquipo: 6, 
        nroCompra: 106, 
        item: 'PC Escritorio Dell OptiPlex 3080', 
        pedido: 'Pedido 006', 
        descripcion: 'Compra de PC para oficina 106' 
      },
      { 
        nroEquipo: 7, 
        nroCompra: 107, 
        item: 'Laptop Asus ROG', 
        pedido: 'Pedido 007', 
        descripcion: 'Compra de laptop para oficina 107' 
      },
      { 
        nroEquipo: 8, 
        nroCompra: 108, 
        item: 'PC Escritorio HP ProDesk', 
        pedido: 'Pedido 008', 
        descripcion: 'Compra de PC para oficina 108' 
      },
      { 
        nroEquipo: 9, 
        nroCompra: 109, 
        item: 'Laptop Microsoft Surface', 
        pedido: 'Pedido 009', 
        descripcion: 'Compra de laptop para oficina 109' 
      },
      { 
        nroEquipo: 10, 
        nroCompra: 110, 
        item: 'PC Escritorio Lenovo IdeaCentre', 
        pedido: 'Pedido 010', 
        descripcion: 'Compra de PC para oficina 110' 
      }
    ];
  }
}
