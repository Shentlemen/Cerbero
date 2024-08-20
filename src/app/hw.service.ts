import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HwService {

  constructor() { }

  getHardware() {
    return [
      { 
        nroEquipo: 1, 
        tipoEquipo: 'Laptop', 
        marca: 'Dell', 
        modelo: 'XPS 13', 
        nroSerie: 'DXPS13-001', 
        disco: '512GB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'Intel Iris Xe', 
        nroSerieTeclado: 'KBD001', 
        nroSerieMouse: 'MSE001', 
        propietario: 'Juan Pérez' 
      },
      { 
        nroEquipo: 2, 
        tipoEquipo: 'PC Escritorio', 
        marca: 'HP', 
        modelo: 'Pavilion', 
        nroSerie: 'HPP-002', 
        disco: '1TB HDD', 
        memoria: '8GB', 
        tarjetaVideo: 'NVIDIA GeForce GTX 1650', 
        nroSerieTeclado: 'KBD002', 
        nroSerieMouse: 'MSE002', 
        propietario: 'María García' 
      },
      { 
        nroEquipo: 3, 
        tipoEquipo: 'Laptop', 
        marca: 'Lenovo', 
        modelo: 'ThinkPad', 
        nroSerie: 'LT-003', 
        disco: '256GB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'Intel UHD Graphics 620', 
        nroSerieTeclado: 'KBD003', 
        nroSerieMouse: 'MSE003', 
        propietario: 'Carlos Gómez' 
      },
      { 
        nroEquipo: 4, 
        tipoEquipo: 'PC Escritorio', 
        marca: 'Acer', 
        modelo: 'Aspire', 
        nroSerie: 'AC-004', 
        disco: '512GB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'AMD Radeon RX 550', 
        nroSerieTeclado: 'KBD004', 
        nroSerieMouse: 'MSE004', 
        propietario: 'Ana López' 
      },
      { 
        nroEquipo: 5, 
        tipoEquipo: 'Laptop', 
        marca: 'Apple', 
        modelo: 'MacBook Pro', 
        nroSerie: 'MBP-005', 
        disco: '1TB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'Apple M1 GPU', 
        nroSerieTeclado: 'KBD005', 
        nroSerieMouse: 'MSE005', 
        propietario: 'Sofía Martínez' 
      },
      { 
        nroEquipo: 6, 
        tipoEquipo: 'PC Escritorio', 
        marca: 'Dell', 
        modelo: 'OptiPlex 3080', 
        nroSerie: 'OP-006', 
        disco: '1TB HDD', 
        memoria: '8GB', 
        tarjetaVideo: 'NVIDIA Quadro P620', 
        nroSerieTeclado: 'KBD006', 
        nroSerieMouse: 'MSE006', 
        propietario: 'Pedro Fernández' 
      },
      { 
        nroEquipo: 7, 
        tipoEquipo: 'Laptop', 
        marca: 'Asus', 
        modelo: 'ROG', 
        nroSerie: 'ASUS-007', 
        disco: '512GB SSD', 
        memoria: '32GB', 
        tarjetaVideo: 'NVIDIA GeForce RTX 3080', 
        nroSerieTeclado: 'KBD007', 
        nroSerieMouse: 'MSE007', 
        propietario: 'Luis Herrera' 
      },
      { 
        nroEquipo: 8, 
        tipoEquipo: 'PC Escritorio', 
        marca: 'HP', 
        modelo: 'ProDesk', 
        nroSerie: 'HPD-008', 
        disco: '512GB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'NVIDIA Quadro P2000', 
        nroSerieTeclado: 'KBD008', 
        nroSerieMouse: 'MSE008', 
        propietario: 'Marta Sánchez' 
      },
      { 
        nroEquipo: 9, 
        tipoEquipo: 'Laptop', 
        marca: 'Microsoft', 
        modelo: 'Surface', 
        nroSerie: 'MS-009', 
        disco: '256GB SSD', 
        memoria: '8GB', 
        tarjetaVideo: 'Intel Iris Plus Graphics', 
        nroSerieTeclado: 'KBD009', 
        nroSerieMouse: 'MSE009', 
        propietario: 'José Ruiz' 
      },
      { 
        nroEquipo: 10, 
        tipoEquipo: 'PC Escritorio', 
        marca: 'Lenovo', 
        modelo: 'IdeaCentre', 
        nroSerie: 'LC-010', 
        disco: '1TB HDD', 
        memoria: '8GB', 
        tarjetaVideo: 'AMD Radeon RX 570', 
        nroSerieTeclado: 'KBD010', 
        nroSerieMouse: 'MSE010', 
        propietario: 'Isabel Moreno' 
      },
      { 
        nroEquipo: 11, 
        tipoEquipo: 'Laptop', 
        marca: 'Dell', 
        modelo: 'Inspiron', 
        nroSerie: 'DIN-011', 
        disco: '512GB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'Intel Iris Xe', 
        nroSerieTeclado: 'KBD011', 
        nroSerieMouse: 'MSE011', 
        propietario: 'Pablo Castillo' 
      },
      { 
        nroEquipo: 12, 
        tipoEquipo: 'PC Escritorio', 
        marca: 'HP', 
        modelo: 'Z240', 
        nroSerie: 'HPZ-012', 
        disco: '2TB SSD', 
        memoria: '32GB', 
        tarjetaVideo: 'NVIDIA Quadro P2000', 
        nroSerieTeclado: 'KBD012', 
        nroSerieMouse: 'MSE012', 
        propietario: 'Laura Ortiz' 
      },
      { 
        nroEquipo: 13, 
        tipoEquipo: 'Laptop', 
        marca: 'Dell', 
        modelo: 'Latitude', 
        nroSerie: 'DL-013', 
        disco: '512GB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'Intel UHD Graphics 620', 
        nroSerieTeclado: 'KBD013', 
        nroSerieMouse: 'MSE013', 
        propietario: 'Diego Torres' 
      },
      { 
        nroEquipo: 14, 
        tipoEquipo: 'PC Escritorio', 
        marca: 'Dell', 
        modelo: 'OptiPlex 7070', 
        nroSerie: 'OP-014', 
        disco: '1TB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'NVIDIA GeForce GTX 1660', 
        nroSerieTeclado: 'KBD014', 
        nroSerieMouse: 'MSE014', 
        propietario: 'Manuel Rojas' 
      },
      { 
        nroEquipo: 15, 
        tipoEquipo: 'Laptop', 
        marca: 'Lenovo', 
        modelo: 'Yoga', 
        nroSerie: 'LY-015', 
        disco: '256GB SSD', 
        memoria: '8GB', 
        tarjetaVideo: 'Intel UHD Graphics 620', 
        nroSerieTeclado: 'KBD015', 
        nroSerieMouse: 'MSE015', 
        propietario: 'Lucía Ramírez' 
      }
    ];
  }
}
