import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ComprasPedidoService {

  constructor() { }

  getComprasPedido() {
    return [
      { 
        nroCompra: 301, 
        item: 'Laptop Dell XPS 13', 
        pedido: 'Pedido 001', 
        proveedor: 'Tech Supplies Inc.', 
        cantidad: 10, 
        fechaInicio: '2023-01-01', 
        fechaFinal: '2023-01-15' 
      },
      { 
        nroCompra: 302, 
        item: 'Microsoft Office 365', 
        pedido: 'Pedido 011', 
        proveedor: 'Microsoft Store', 
        cantidad: 50, 
        fechaInicio: '2023-01-10', 
        fechaFinal: '2023-01-20' 
      },
      { 
        nroCompra: 303, 
        item: 'Adobe Photoshop', 
        pedido: 'Pedido 012', 
        proveedor: 'Adobe Systems', 
        cantidad: 20, 
        fechaInicio: '2023-02-01', 
        fechaFinal: '2023-02-15' 
      },
      { 
        nroCompra: 304, 
        item: 'PC Escritorio HP Pavilion', 
        pedido: 'Pedido 002', 
        proveedor: 'HP Store', 
        cantidad: 15, 
        fechaInicio: '2023-02-05', 
        fechaFinal: '2023-02-20' 
      },
      { 
        nroCompra: 305, 
        item: 'AutoCAD', 
        pedido: 'Pedido 013', 
        proveedor: 'Autodesk', 
        cantidad: 30, 
        fechaInicio: '2023-03-01', 
        fechaFinal: '2023-03-10' 
      },
      { 
        nroCompra: 306, 
        item: 'Slack', 
        pedido: 'Pedido 015', 
        proveedor: 'Slack Technologies', 
        cantidad: 40, 
        fechaInicio: '2023-03-15', 
        fechaFinal: '2023-03-25' 
      },
      { 
        nroCompra: 307, 
        item: 'MySQL Workbench', 
        pedido: 'Pedido 016', 
        proveedor: 'Oracle Corporation', 
        cantidad: 25, 
        fechaInicio: '2023-04-01', 
        fechaFinal: '2023-04-10' 
      },
      { 
        nroCompra: 308, 
        item: 'Node.js', 
        pedido: 'Pedido 018', 
        proveedor: 'Node.js Foundation', 
        cantidad: 35, 
        fechaInicio: '2023-04-20', 
        fechaFinal: '2023-04-30' 
      },
      { 
        nroCompra: 309, 
        item: 'JIRA', 
        pedido: 'Pedido 019', 
        proveedor: 'Atlassian', 
        cantidad: 15, 
        fechaInicio: '2023-05-05', 
        fechaFinal: '2023-05-15' 
      },
      { 
        nroCompra: 310, 
        item: 'Postman', 
        pedido: 'Pedido 020', 
        proveedor: 'Postman Inc.', 
        cantidad: 50, 
        fechaInicio: '2023-05-20', 
        fechaFinal: '2023-06-01' 
      }
    ];
  }
}
