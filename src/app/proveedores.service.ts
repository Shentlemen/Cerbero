import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ProveedoresService {

  constructor() { }

  getProveedores() {
    return [
      { 
        nroProveedor: 101, 
        descripcion: 'Tech Supplies Inc.', 
        direccion: 'Av. 18 de Julio 1234, Montevideo, Uruguay', 
        telefonos: '+598 2901 2345' 
      },
      { 
        nroProveedor: 102, 
        descripcion: 'Microsoft Store', 
        direccion: 'Av. Brasil 5678, Montevideo, Uruguay', 
        telefonos: '+598 2708 9101' 
      },
      { 
        nroProveedor: 103, 
        descripcion: 'Adobe Systems', 
        direccion: 'Calle Sarandí 789, Montevideo, Uruguay', 
        telefonos: '+598 2912 3456' 
      },
      { 
        nroProveedor: 104, 
        descripcion: 'HP Store', 
        direccion: 'Bulevar Artigas 1020, Montevideo, Uruguay', 
        telefonos: '+598 2200 4567' 
      },
      { 
        nroProveedor: 105, 
        descripcion: 'Autodesk', 
        direccion: 'Av. Italia 987, Montevideo, Uruguay', 
        telefonos: '+598 2601 5678' 
      },
      { 
        nroProveedor: 106, 
        descripcion: 'Slack Technologies', 
        direccion: 'Av. Arocena 123, Montevideo, Uruguay', 
        telefonos: '+598 2600 6789' 
      },
      { 
        nroProveedor: 107, 
        descripcion: 'Oracle Corporation', 
        direccion: 'Av. Luis Alberto de Herrera 1000, Montevideo, Uruguay', 
        telefonos: '+598 2301 7890' 
      },
      { 
        nroProveedor: 108, 
        descripcion: 'Node.js Foundation', 
        direccion: 'Calle Rivera 123, Montevideo, Uruguay', 
        telefonos: '+598 2700 8901' 
      },
      { 
        nroProveedor: 109, 
        descripcion: 'Atlassian', 
        direccion: 'Av. Garzón 456, Montevideo, Uruguay', 
        telefonos: '+598 2201 9012' 
      },
      { 
        nroProveedor: 110, 
        descripcion: 'Postman Inc.', 
        direccion: 'Calle Colonia 789, Montevideo, Uruguay', 
        telefonos: '+598 2902 3456' 
      }
    ];
  }
}
