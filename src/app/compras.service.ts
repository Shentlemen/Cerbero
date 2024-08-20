import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ComprasService {

  constructor() { }

  getCompras() {
    return [
      { 
        nroCompra: 401, 
        item: 'Laptop Dell XPS 13', 
        descripcion: 'Compra de laptop para oficina de desarrollo', 
        proveedor: 'Tech Supplies Inc.', 
        fechaInicio: '2023-01-01', 
        fechaFinal: '2023-01-15' 
      },
      { 
        nroCompra: 402, 
        item: 'Microsoft Office 365', 
        descripcion: 'Compra de licencias para toda la empresa', 
        proveedor: 'Microsoft Store', 
        fechaInicio: '2023-01-10', 
        fechaFinal: '2023-01-20' 
      },
      { 
        nroCompra: 403, 
        item: 'Adobe Photoshop', 
        descripcion: 'Licencias para el equipo de diseño gráfico', 
        proveedor: 'Adobe Systems', 
        fechaInicio: '2023-02-01', 
        fechaFinal: '2023-02-15' 
      },
      { 
        nroCompra: 404, 
        item: 'PC Escritorio HP Pavilion', 
        descripcion: 'Compra de PCs para el departamento de ventas', 
        proveedor: 'HP Store', 
        fechaInicio: '2023-02-05', 
        fechaFinal: '2023-02-20' 
      },
      { 
        nroCompra: 405, 
        item: 'AutoCAD', 
        descripcion: 'Licencias para el equipo de ingeniería', 
        proveedor: 'Autodesk', 
        fechaInicio: '2023-03-01', 
        fechaFinal: '2023-03-10' 
      },
      { 
        nroCompra: 406, 
        item: 'Slack', 
        descripcion: 'Suscripción para comunicación interna en toda la empresa', 
        proveedor: 'Slack Technologies', 
        fechaInicio: '2023-03-15', 
        fechaFinal: '2023-03-25' 
      },
      { 
        nroCompra: 407, 
        item: 'MySQL Workbench', 
        descripcion: 'Herramienta de administración de bases de datos para TI', 
        proveedor: 'Oracle Corporation', 
        fechaInicio: '2023-04-01', 
        fechaFinal: '2023-04-10' 
      },
      { 
        nroCompra: 408, 
        item: 'Node.js', 
        descripcion: 'Entorno de ejecución para desarrollo backend', 
        proveedor: 'Node.js Foundation', 
        fechaInicio: '2023-04-20', 
        fechaFinal: '2023-04-30' 
      },
      { 
        nroCompra: 409, 
        item: 'JIRA', 
        descripcion: 'Herramienta de gestión de proyectos para IT', 
        proveedor: 'Atlassian', 
        fechaInicio: '2023-05-05', 
        fechaFinal: '2023-05-15' 
      },
      { 
        nroCompra: 410, 
        item: 'Postman', 
        descripcion: 'Herramienta de pruebas de API para desarrollo', 
        proveedor: 'Postman Inc.', 
        fechaInicio: '2023-05-20', 
        fechaFinal: '2023-06-01' 
      }
    ];
  }
}
