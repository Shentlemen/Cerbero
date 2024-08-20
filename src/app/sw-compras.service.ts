import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SwComprasService {

  constructor() { }

  getSwCompras() {
    return [
      { 
        nroSoftware: 1, 
        nroCompra: 201, 
        item: 'Microsoft Office 365', 
        pedido: 'Pedido 011', 
        descripcion: 'Compra de licencia Office 365 para equipo de oficina 101' 
      },
      { 
        nroSoftware: 2, 
        nroCompra: 202, 
        item: 'Adobe Photoshop', 
        pedido: 'Pedido 012', 
        descripcion: 'Compra de licencia Adobe Photoshop para oficina de diseño' 
      },
      { 
        nroSoftware: 3, 
        nroCompra: 203, 
        item: 'AutoCAD', 
        pedido: 'Pedido 013', 
        descripcion: 'Compra de licencia AutoCAD para oficina de ingeniería' 
      },
      { 
        nroSoftware: 4, 
        nroCompra: 204, 
        item: 'Visual Studio Code', 
        pedido: 'Pedido 014', 
        descripcion: 'Software de desarrollo para equipo de programación' 
      },
      { 
        nroSoftware: 5, 
        nroCompra: 205, 
        item: 'Slack', 
        pedido: 'Pedido 015', 
        descripcion: 'Compra de suscripción Slack para comunicación interna' 
      },
      { 
        nroSoftware: 6, 
        nroCompra: 206, 
        item: 'MySQL Workbench', 
        pedido: 'Pedido 016', 
        descripcion: 'Herramienta de administración de base de datos para oficina 301' 
      },
      { 
        nroSoftware: 7, 
        nroCompra: 207, 
        item: 'Git', 
        pedido: 'Pedido 017', 
        descripcion: 'Software de control de versiones para oficina de desarrollo' 
      },
      { 
        nroSoftware: 8, 
        nroCompra: 208, 
        item: 'Node.js', 
        pedido: 'Pedido 018', 
        descripcion: 'Entorno de ejecución JavaScript para oficina de desarrollo' 
      },
      { 
        nroSoftware: 9, 
        nroCompra: 209, 
        item: 'JIRA', 
        pedido: 'Pedido 019', 
        descripcion: 'Herramienta de gestión de proyectos para equipo de gestión' 
      },
      { 
        nroSoftware: 10, 
        nroCompra: 210, 
        item: 'Postman', 
        pedido: 'Pedido 020', 
        descripcion: 'Herramienta de pruebas de API para oficina de desarrollo' 
      }
    ];
  }
}
