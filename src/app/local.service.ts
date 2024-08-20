import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LocalService {

  constructor() { }

  getLocal() {
    return [
      { 
        subred: '192.168.1.0', 
        piso: 1, 
        oficina: 101, 
        zona: 'Centro', 
        ciudad: 'Montevideo', 
        local: 'Edificio Central', 
        direccion: '18 de Julio 1234' 
      },
      { 
        subred: '192.168.1.0', 
        piso: 2, 
        oficina: 202, 
        zona: 'Pocitos', 
        ciudad: 'Montevideo', 
        local: 'Edificio Pocitos', 
        direccion: 'Av. Brasil 2567' 
      },
      { 
        subred: '192.168.2.0', 
        piso: 3, 
        oficina: 301, 
        zona: 'Buceo', 
        ciudad: 'Montevideo', 
        local: 'Edificio Buceo', 
        direccion: 'Ramón Anador 4321' 
      },
      { 
        subred: '192.168.2.0', 
        piso: 4, 
        oficina: 402, 
        zona: 'Carrasco', 
        ciudad: 'Montevideo', 
        local: 'Edificio Carrasco', 
        direccion: 'Av. Arocena 654' 
      },
      { 
        subred: '192.168.3.0', 
        piso: 5, 
        oficina: 501, 
        zona: 'Ciudad Vieja', 
        ciudad: 'Montevideo', 
        local: 'Edificio Ciudad Vieja', 
        direccion: 'Sarandí 765' 
      },
      { 
        subred: '192.168.3.0', 
        piso: 6, 
        oficina: 602, 
        zona: 'Malvín', 
        ciudad: 'Montevideo', 
        local: 'Edificio Malvín', 
        direccion: 'Av. Italia 987' 
      },
      { 
        subred: '192.168.4.0', 
        piso: 7, 
        oficina: 701, 
        zona: 'Punta Carretas', 
        ciudad: 'Montevideo', 
        local: 'Edificio Punta Carretas', 
        direccion: 'Ellauri 1122' 
      },
      { 
        subred: '192.168.4.0', 
        piso: 8, 
        oficina: 802, 
        zona: 'Parque Rodó', 
        ciudad: 'Montevideo', 
        local: 'Edificio Parque Rodó', 
        direccion: 'Julio Herrera y Reissig 334' 
      },
      { 
        subred: '192.168.5.0', 
        piso: 9, 
        oficina: 901, 
        zona: 'Tres Cruces', 
        ciudad: 'Montevideo', 
        local: 'Edificio Tres Cruces', 
        direccion: 'Bulevar Artigas 1550' 
      },
      { 
        subred: '192.168.5.0', 
        piso: 10, 
        oficina: 1002, 
        zona: 'Prado', 
        ciudad: 'Montevideo', 
        local: 'Edificio Prado', 
        direccion: 'Agraciada 2145' 
      }
    ];
  }
}
