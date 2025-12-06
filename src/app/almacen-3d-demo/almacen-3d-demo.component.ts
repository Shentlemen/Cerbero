import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Almacen3DComponent, CajaInfo } from '../components/almacen-3d/almacen-3d.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-almacen-3d-demo',
  standalone: true,
  imports: [CommonModule, Almacen3DComponent],
  templateUrl: './almacen-3d-demo.component.html',
  styleUrls: ['./almacen-3d-demo.component.css']
})
export class Almacen3DDemoComponent {
  
  cajaSeleccionada: CajaInfo | null = null;
  mostrarModal: boolean = false;
  
  // Datos de ejemplo para las cajas
  contenidoEjemplo: any[] = [
    { id: 1, nombre: 'Monitor Dell 24"', tipo: 'MONITOR', cantidad: 2 },
    { id: 2, nombre: 'Teclado Logitech K120', tipo: 'TECLADO', cantidad: 5 },
    { id: 3, nombre: 'Mouse Logitech M100', tipo: 'MOUSE', cantidad: 8 }
  ];

  constructor(private modalService: NgbModal) {}

  onCajaSeleccionada(info: CajaInfo): void {
    console.log('Caja seleccionada:', info);
    
    // Simular que algunas cajas tienen contenido
    if (info.nivel === 1 && info.posicion === 1) {
      info.contenido = this.contenidoEjemplo;
    } else if (info.nivel === 2 && info.posicion === 2) {
      info.contenido = [
        { id: 4, nombre: 'PC Dell OptiPlex 7090', tipo: 'PC', cantidad: 1 },
        { id: 5, nombre: 'PC HP ProDesk 400', tipo: 'PC', cantidad: 1 }
      ];
    } else {
      info.contenido = [];
    }
    
    this.cajaSeleccionada = info;
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.cajaSeleccionada = null;
  }

  tieneContenido(): boolean {
    return !!(this.cajaSeleccionada?.contenido && this.cajaSeleccionada.contenido.length > 0);
  }

  agregarItem(): void {
    // TODO: Implementar lógica de agregar item
    console.log('Agregar item a la caja');
  }

  quitarItem(item: any): void {
    // TODO: Implementar lógica de quitar item
    console.log('Quitar item:', item);
  }

  transferirItem(item: any): void {
    // TODO: Implementar lógica de transferir
    console.log('Transferir item:', item);
  }
}

