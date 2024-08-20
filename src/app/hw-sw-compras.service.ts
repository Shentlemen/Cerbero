import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HwSwComprasService {

  constructor() { }

  getHwSwCompras() {
    return [
      { 
        nroEquipo: 1, 
        nroSoftware: 1, 
        nroCompra: 101, 
        item: 'Microsoft Office 365', 
        pedido: 'Pedido 001' 
      },
      { 
        nroEquipo: 2, 
        nroSoftware: 2, 
        nroCompra: 102, 
        item: 'Adobe Photoshop', 
        pedido: 'Pedido 002' 
      },
      { 
        nroEquipo: 3, 
        nroSoftware: 3, 
        nroCompra: 103, 
        item: 'AutoCAD', 
        pedido: 'Pedido 003' 
      },
      { 
        nroEquipo: 4, 
        nroSoftware: 4, 
        nroCompra: 104, 
        item: 'Visual Studio Code', 
        pedido: 'Pedido 004' 
      },
      { 
        nroEquipo: 5, 
        nroSoftware: 5, 
        nroCompra: 105, 
        item: 'Slack', 
        pedido: 'Pedido 005' 
      },
      { 
        nroEquipo: 6, 
        nroSoftware: 6, 
        nroCompra: 106, 
        item: 'MySQL Workbench', 
        pedido: 'Pedido 006' 
      },
      { 
        nroEquipo: 7, 
        nroSoftware: 7, 
        nroCompra: 107, 
        item: 'Git', 
        pedido: 'Pedido 007' 
      },
      { 
        nroEquipo: 8, 
        nroSoftware: 8, 
        nroCompra: 108, 
        item: 'Node.js', 
        pedido: 'Pedido 008' 
      },
      { 
        nroEquipo: 9, 
        nroSoftware: 9, 
        nroCompra: 109, 
        item: 'JIRA', 
        pedido: 'Pedido 009' 
      },
      { 
        nroEquipo: 10, 
        nroSoftware: 10, 
        nroCompra: 110, 
        item: 'Postman', 
        pedido: 'Pedido 010' 
      }
    ];
  }
}
