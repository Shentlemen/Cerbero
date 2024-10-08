import { Injectable } from '@angular/core';

// Definimos una interfaz para el tipo de hardware
interface Hardware {
  NAME: string;
  tipoEquipo: string;
  marca: string;
  modelo: string;
  nroSerie: string;
  disco: string;
  memoria: string;
  tarjetaVideo: string;
  nroSerieTeclado: string;
  nroSerieMouse: string;
  propietario: string;
  OSNAME: string;
  IPADDR: string;
  TYPE: string;
}

@Injectable({
  providedIn: 'root'
})
export class HwService {

  constructor() { }

  // Método para obtener todos los equipos de hardware
  getHardware(): Hardware[] {
    return [
      { 
        NAME: 'PC45678', 
        tipoEquipo: 'Laptop', 
        marca: 'Dell', 
        modelo: 'XPS 13', 
        nroSerie: 'DXPS13-001', 
        disco: '512GB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'Intel Iris Xe', 
        nroSerieTeclado: 'KBD001', 
        nroSerieMouse: 'MSE001', 
        propietario: 'Juan Pérez',
        OSNAME: 'Windows 11 Pro',
        IPADDR: '192.168.1.101',
        TYPE: 'LAPTOP'
      },
      { 
        NAME: 'PC23456', 
        tipoEquipo: 'PC Escritorio', 
        marca: 'HP', 
        modelo: 'Pavilion', 
        nroSerie: 'HPP-002', 
        disco: '1TB HDD', 
        memoria: '8GB', 
        tarjetaVideo: 'NVIDIA GeForce GTX 1650', 
        nroSerieTeclado: 'KBD002', 
        nroSerieMouse: 'MSE002', 
        propietario: 'María García',
        OSNAME: 'Windows 10 Home',
        IPADDR: '192.168.1.102',
        TYPE: 'DESKTOP'
      },
      { 
        NAME: 'PC78901', 
        tipoEquipo: 'Laptop', 
        marca: 'Lenovo', 
        modelo: 'ThinkPad', 
        nroSerie: 'LT-003', 
        disco: '256GB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'Intel UHD Graphics 620', 
        nroSerieTeclado: 'KBD003', 
        nroSerieMouse: 'MSE003', 
        propietario: 'Carlos Gómez',
        OSNAME: 'Ubuntu 22.04 LTS',
        IPADDR: '192.168.1.103',
        TYPE: 'LAPTOP'
      },
      { 
        NAME: 'PC34567', 
        tipoEquipo: 'PC Escritorio', 
        marca: 'Acer', 
        modelo: 'Aspire', 
        nroSerie: 'AC-004', 
        disco: '512GB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'AMD Radeon RX 550', 
        nroSerieTeclado: 'KBD004', 
        nroSerieMouse: 'MSE004', 
        propietario: 'Ana López',
        OSNAME: 'Windows 11 Home',
        IPADDR: '192.168.1.104',
        TYPE: 'DESKTOP'
      },
      { 
        NAME: 'PC89012', 
        tipoEquipo: 'Laptop', 
        marca: 'Apple', 
        modelo: 'MacBook Pro', 
        nroSerie: 'MBP-005', 
        disco: '1TB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'Apple M1 GPU', 
        nroSerieTeclado: 'KBD005', 
        nroSerieMouse: 'MSE005', 
        propietario: 'Sofía Martínez',
        OSNAME: 'macOS Monterey',
        IPADDR: '192.168.1.105',
        TYPE: 'LAPTOP'
      },
      { 
        NAME: 'PC56789', 
        tipoEquipo: 'PC Escritorio', 
        marca: 'Dell', 
        modelo: 'OptiPlex 3080', 
        nroSerie: 'OP-006', 
        disco: '1TB HDD', 
        memoria: '8GB', 
        tarjetaVideo: 'NVIDIA Quadro P620', 
        nroSerieTeclado: 'KBD006', 
        nroSerieMouse: 'MSE006', 
        propietario: 'Pedro Fernández',
        OSNAME: 'Windows 10 Pro',
        IPADDR: '192.168.1.106',
        TYPE: 'DESKTOP'
      },
      { 
        NAME: 'PC12345', 
        tipoEquipo: 'Laptop', 
        marca: 'Asus', 
        modelo: 'ROG', 
        nroSerie: 'ASUS-007', 
        disco: '512GB SSD', 
        memoria: '32GB', 
        tarjetaVideo: 'NVIDIA GeForce RTX 3080', 
        nroSerieTeclado: 'KBD007', 
        nroSerieMouse: 'MSE007', 
        propietario: 'Luis Herrera',
        OSNAME: 'Windows 11 Pro',
        IPADDR: '192.168.1.107',
        TYPE: 'LAPTOP'
      },
      { 
        NAME: 'PC67890', 
        tipoEquipo: 'PC Escritorio', 
        marca: 'HP', 
        modelo: 'ProDesk', 
        nroSerie: 'HPD-008', 
        disco: '512GB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'NVIDIA Quadro P2000', 
        nroSerieTeclado: 'KBD008', 
        nroSerieMouse: 'MSE008', 
        propietario: 'Marta Sánchez',
        OSNAME: 'Windows 10 Enterprise',
        IPADDR: '192.168.1.108',
        TYPE: 'DESKTOP'
      },
      { 
        NAME: 'PC90123', 
        tipoEquipo: 'Laptop', 
        marca: 'Microsoft', 
        modelo: 'Surface', 
        nroSerie: 'MS-009', 
        disco: '256GB SSD', 
        memoria: '8GB', 
        tarjetaVideo: 'Intel Iris Plus Graphics', 
        nroSerieTeclado: 'KBD009', 
        nroSerieMouse: 'MSE009', 
        propietario: 'José Ruiz',
        OSNAME: 'Windows 11 Home',
        IPADDR: '192.168.1.109',
        TYPE: 'LAPTOP'
      },
      { 
        NAME: 'PC01234', 
        tipoEquipo: 'PC Escritorio', 
        marca: 'Lenovo', 
        modelo: 'IdeaCentre', 
        nroSerie: 'LC-010', 
        disco: '1TB HDD', 
        memoria: '8GB', 
        tarjetaVideo: 'AMD Radeon RX 570', 
        nroSerieTeclado: 'KBD010', 
        nroSerieMouse: 'MSE010', 
        propietario: 'Isabel Moreno',
        OSNAME: 'Windows 10 Home',
        IPADDR: '192.168.1.110',
        TYPE: 'DESKTOP'
      },
      { 
        NAME: 'PC54321', 
        tipoEquipo: 'Laptop', 
        marca: 'Dell', 
        modelo: 'Inspiron', 
        nroSerie: 'DIN-011', 
        disco: '512GB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'Intel Iris Xe', 
        nroSerieTeclado: 'KBD011', 
        nroSerieMouse: 'MSE011', 
        propietario: 'Pablo Castillo',
        OSNAME: 'Ubuntu 20.04 LTS',
        IPADDR: '192.168.1.111',
        TYPE: 'LAPTOP'
      },
      { 
        NAME: 'PC98765', 
        tipoEquipo: 'PC Escritorio', 
        marca: 'HP', 
        modelo: 'Z240', 
        nroSerie: 'HPZ-012', 
        disco: '2TB SSD', 
        memoria: '32GB', 
        tarjetaVideo: 'NVIDIA Quadro P2000', 
        nroSerieTeclado: 'KBD012', 
        nroSerieMouse: 'MSE012', 
        propietario: 'Laura Ortiz',
        OSNAME: 'Windows 10 Pro',
        IPADDR: '192.168.1.112',
        TYPE: 'DESKTOP'
      },
      { 
        NAME: 'PC43210', 
        tipoEquipo: 'Laptop', 
        marca: 'Dell', 
        modelo: 'Latitude', 
        nroSerie: 'DL-013', 
        disco: '512GB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'Intel UHD Graphics 620', 
        nroSerieTeclado: 'KBD013', 
        nroSerieMouse: 'MSE013', 
        propietario: 'Diego Torres',
        OSNAME: 'Windows 11 Pro',
        IPADDR: '192.168.1.113',
        TYPE: 'LAPTOP'
      },
      { 
        NAME: 'PC87654', 
        tipoEquipo: 'PC Escritorio', 
        marca: 'Dell', 
        modelo: 'OptiPlex 7070', 
        nroSerie: 'OP-014', 
        disco: '1TB SSD', 
        memoria: '16GB', 
        tarjetaVideo: 'NVIDIA GeForce GTX 1660', 
        nroSerieTeclado: 'KBD014', 
        nroSerieMouse: 'MSE014', 
        propietario: 'Manuel Rojas',
        OSNAME: 'Windows 10 Enterprise',
        IPADDR: '192.168.1.114',
        TYPE: 'DESKTOP'
      },
      { 
        NAME: 'PC32109', 
        tipoEquipo: 'Laptop', 
        marca: 'Lenovo', 
        modelo: 'Yoga', 
        nroSerie: 'LY-015', 
        disco: '256GB SSD', 
        memoria: '8GB', 
        tarjetaVideo: 'Intel UHD Graphics 620', 
        nroSerieTeclado: 'KBD015', 
        nroSerieMouse: 'MSE015', 
        propietario: 'Lucía Ramírez',
        OSNAME: 'Windows 11 Home',
        IPADDR: '192.168.1.115',
        TYPE: 'LAPTOP'
      },
      { 
        NAME: 'MB10001', 
        tipoEquipo: 'Smartphone', 
        marca: 'Samsung', 
        modelo: 'Galaxy S21', 
        nroSerie: 'SG21-001', 
        disco: '128GB', 
        memoria: '8GB', 
        tarjetaVideo: 'Adreno 660', 
        nroSerieTeclado: 'N/A', 
        nroSerieMouse: 'N/A', 
        propietario: 'Carmen Vega',
        OSNAME: 'Android 12',
        IPADDR: '192.168.1.116',
        TYPE: 'MOBILE'
      },
      { 
        NAME: 'MB10002', 
        tipoEquipo: 'Tablet', 
        marca: 'Apple', 
        modelo: 'iPad Pro', 
        nroSerie: 'IPP-002', 
        disco: '256GB', 
        memoria: '8GB', 
        tarjetaVideo: 'Apple GPU', 
        nroSerieTeclado: 'N/A', 
        nroSerieMouse: 'N/A', 
        propietario: 'Roberto Méndez',
        OSNAME: 'iPadOS 15',
        IPADDR: '192.168.1.117',
        TYPE: 'MOBILE'
      },
      { 
        NAME: 'MB10003', 
        tipoEquipo: 'Smartphone', 
        marca: 'Google', 
        modelo: 'Pixel 6', 
        nroSerie: 'GP6-003', 
        disco: '128GB', 
        memoria: '8GB', 
        tarjetaVideo: 'Mali-G78 MP20', 
        nroSerieTeclado: 'N/A', 
        nroSerieMouse: 'N/A', 
        propietario: 'Elena Fuentes',
        OSNAME: 'Android 13',
        IPADDR: '192.168.1.118',
        TYPE: 'MOBILE'
      },
      { 
        NAME: 'MB10004', 
        tipoEquipo: 'Tablet', 
        marca: 'Samsung', 
        modelo: 'Galaxy Tab S7', 
        nroSerie: 'GTS7-004', 
        disco: '128GB', 
        memoria: '6GB', 
        tarjetaVideo: 'Adreno 650', 
        nroSerieTeclado: 'N/A', 
        nroSerieMouse: 'N/A', 
        propietario: 'Javier Soto',
        OSNAME: 'Android 12',
        IPADDR: '192.168.1.119',
        TYPE: 'MOBILE'
      },
      { 
        NAME: 'MB10005', 
        tipoEquipo: 'Smartphone', 
        marca: 'Apple', 
        modelo: 'iPhone 13', 
        nroSerie: 'IP13-005', 
        disco: '256GB', 
        memoria: '6GB', 
        tarjetaVideo: 'Apple GPU', 
        nroSerieTeclado: 'N/A', 
        nroSerieMouse: 'N/A', 
        propietario: 'Marta Jiménez',
        OSNAME: 'iOS 15',
        IPADDR: '192.168.1.120',
        TYPE: 'MOBILE'
      }
    ];
  }

  // Método para obtener hardware por ID (NAME en este caso)
  getHardwareById(id: string | number): Hardware | null {
    console.log('Buscando hardware con ID:', id);
    const hardware = this.getHardware();
    const asset = hardware.find(item => item.NAME.toString() === id.toString());
    console.log('Asset encontrado:', asset);
    return asset || null;
  }
}
