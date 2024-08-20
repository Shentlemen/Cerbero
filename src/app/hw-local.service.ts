import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HwLocalService {

  constructor() { }

  getHwLocal() {
    return [
      { 
        nroSoftware: 1, 
        subred: '192.168.1.0', 
        piso: 1, 
        oficina: 101, 
        descripcion: 'Oficina Principal' 
      },
      { 
        nroSoftware: 2, 
        subred: '192.168.1.0', 
        piso: 1, 
        oficina: 102, 
        descripcion: 'Sala de Reuniones' 
      },
      { 
        nroSoftware: 3, 
        subred: '192.168.2.0', 
        piso: 2, 
        oficina: 201, 
        descripcion: 'Oficina de Ventas' 
      },
      { 
        nroSoftware: 4, 
        subred: '192.168.2.0', 
        piso: 2, 
        oficina: 202, 
        descripcion: 'Oficina de Finanzas' 
      },
      { 
        nroSoftware: 5, 
        subred: '192.168.3.0', 
        piso: 3, 
        oficina: 301, 
        descripcion: 'Desarrollo de Software' 
      },
      { 
        nroSoftware: 6, 
        subred: '192.168.3.0', 
        piso: 3, 
        oficina: 302, 
        descripcion: 'Soporte Técnico' 
      },
      { 
        nroSoftware: 7, 
        subred: '192.168.4.0', 
        piso: 4, 
        oficina: 401, 
        descripcion: 'Dirección General' 
      },
      { 
        nroSoftware: 8, 
        subred: '192.168.4.0', 
        piso: 4, 
        oficina: 402, 
        descripcion: 'Recursos Humanos' 
      },
      { 
        nroSoftware: 9, 
        subred: '192.168.5.0', 
        piso: 5, 
        oficina: 501, 
        descripcion: 'Marketing' 
      },
      { 
        nroSoftware: 10, 
        subred: '192.168.5.0', 
        piso: 5, 
        oficina: 502, 
        descripcion: 'Investigación y Desarrollo' 
      }
    ];
  }
}
