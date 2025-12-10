import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Almacen3DComponent, CajaInfo, StockItem } from '../components/almacen-3d/almacen-3d.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { StockAlmacenService } from '../services/stock-almacen.service';
import { AlmacenService } from '../services/almacen.service';
import { EstadoEquipoService } from '../services/estado-equipo.service';
import { EstadoDispositivoService } from '../services/estado-dispositivo.service';
import { HardwareService } from '../services/hardware.service';
import { BiosService } from '../services/bios.service';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-almacen-3d-demo',
  standalone: true,
  imports: [CommonModule, Almacen3DComponent],
  templateUrl: './almacen-3d-demo.component.html',
  styleUrls: ['./almacen-3d-demo.component.css']
})
export class Almacen3DDemoComponent implements OnInit {
  
  cajaSeleccionada: CajaInfo | null = null;
  mostrarModal: boolean = false;
  loading: boolean = false;
  stockData3D: StockItem[] = [];
  
  // Datos de ejemplo para las cajas (fallback)
  contenidoEjemplo: any[] = [
    { id: 1, nombre: 'Monitor Dell 24"', tipo: 'MONITOR', cantidad: 2 },
    { id: 2, nombre: 'Teclado Logitech K120', tipo: 'TECLADO', cantidad: 5 },
    { id: 3, nombre: 'Mouse Logitech M100', tipo: 'MOUSE', cantidad: 8 }
  ];

  constructor(
    private modalService: NgbModal,
    private stockAlmacenService: StockAlmacenService,
    private almacenService: AlmacenService,
    private estadoEquipoService: EstadoEquipoService,
    private estadoDispositivoService: EstadoDispositivoService,
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private networkInfoService: NetworkInfoService
  ) {}

  ngOnInit(): void {
    this.cargarStockALM03();
  }

  cargarStockALM03(): void {
    this.loading = true;
    
    // Cargar almacenes primero para encontrar ALM03
    this.almacenService.getAllAlmacenes().subscribe({
      next: (almacenes) => {
        const almacenALM03 = almacenes.find((a: any) => 
          a.id === 3 || 
          a.numero?.toUpperCase().includes('ALM03') ||
          a.nombre?.toUpperCase().includes('ALMACEN PRINCIPAL')
        );

        if (!almacenALM03) {
          console.warn('⚠️ No se encontró ALM03');
          this.loading = false;
          return;
        }

        // Cargar stock y equipos especiales
        forkJoin({
          stock: this.stockAlmacenService.getAllStock(),
          equiposAlmacen: this.estadoEquipoService.getEquiposEnAlmacen(),
          dispositivosAlmacen: this.estadoDispositivoService.getDispositivosEnAlmacen(),
          hardware: this.hardwareService.getHardware(),
          bios: this.biosService.getAllBios(),
          networkInfo: this.networkInfoService.getNetworkInfo()
        }).subscribe({
          next: (response) => {
            let stockCompleto: any[] = [];
            
            // Agregar stock normal del ALM03
            if (Array.isArray(response.stock)) {
              stockCompleto = response.stock.filter((item: any) => 
                item.almacen && item.almacen.id === almacenALM03.id
              );
            }

            // Agregar equipos transferidos a ALM03
            const equiposEnAlmacen = response.equiposAlmacen?.success && Array.isArray(response.equiposAlmacen.data)
              ? response.equiposAlmacen.data.filter((e: any) => e.almacenId === almacenALM03.id)
              : [];
            
            const dispositivosEnAlmacen = response.dispositivosAlmacen?.success && Array.isArray(response.dispositivosAlmacen.data)
              ? response.dispositivosAlmacen.data.filter((d: any) => d.almacenId === almacenALM03.id)
              : [];

            // Convertir equipos y dispositivos a formato StockAlmacen
            const itemsEquipos = this.convertirEquiposAStock(
              equiposEnAlmacen,
              Array.isArray(response.hardware) ? response.hardware : [],
              Array.isArray(response.bios) ? response.bios : [],
              almacenALM03
            );

            const itemsDispositivos = this.convertirDispositivosAStock(
              dispositivosEnAlmacen,
              response.networkInfo,
              almacenALM03
            );

            stockCompleto = [...stockCompleto, ...itemsEquipos, ...itemsDispositivos];
            
            // Preparar datos para el componente 3D
            this.prepararStockData3D(stockCompleto);
            this.loading = false;
          },
          error: (error) => {
            console.error('Error al cargar stock:', error);
            this.loading = false;
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar almacenes:', error);
        this.loading = false;
      }
    });
  }

  convertirEquiposAStock(equipos: any[], hardware: any[], bios: any[], almacen: any): any[] {
    const items: any[] = [];
    const biosMap = new Map(bios.map((b: any) => [b.hardwareId, b]));

    equipos.forEach((estado: any) => {
      const hw = hardware.find((h: any) => h.id === estado.hardwareId);
      if (!hw) return;

      const { estanteria, estante, seccion } = this.parsearEstanteriaYEstante(estado.observaciones);
      const biosData = biosMap.get(estado.hardwareId);

      console.log(`🔍 Parseando equipo ${hw.name}:`, {
        observaciones: estado.observaciones,
        parseado: { estanteria, estante, seccion }
      });

      items.push({
        almacen: almacen,
        estanteria: estanteria || null,
        estante: estante || null,
        seccion: seccion || null,
        cantidad: 1,
        item: {
          nombreItem: hw.name || `Equipo ${estado.hardwareId}`,
          descripcion: `${biosData?.type || 'N/A'} | ${hw.osName || 'N/A'}`
        }
      });
    });

    return items;
  }

  convertirDispositivosAStock(dispositivos: any[], networkInfo: any, almacen: any): any[] {
    const items: any[] = [];

    if (!networkInfo?.success || !Array.isArray(networkInfo.data)) {
      return items;
    }

    const networkInfoMap = new Map<string, NetworkInfoDTO>(
      networkInfo.data.map((device: NetworkInfoDTO) => [device.mac, device])
    );

    dispositivos.forEach((estado: any) => {
      const device: NetworkInfoDTO | undefined = networkInfoMap.get(estado.mac);
      if (!device) return;

      const { estanteria, estante, seccion } = this.parsearEstanteriaYEstante(estado.observaciones);

      console.log(`🔍 Parseando dispositivo ${device.mac}:`, {
        observaciones: estado.observaciones,
        parseado: { estanteria, estante, seccion }
      });

      items.push({
        almacen: almacen,
        estanteria: estanteria || null,
        estante: estante || null,
        seccion: seccion || null,
        cantidad: 1,
        item: {
          nombreItem: device.name || device.mac,
          descripcion: `${device.type || 'N/A'} | ${device.description || 'Sin descripción'}`
        }
      });
    });

    return items;
  }

  parsearEstanteriaYEstante(observaciones: string | null | undefined): { estanteria: string | null, estante: string | null, seccion: string | null } {
    if (!observaciones) {
      return { estanteria: null, estante: null, seccion: null };
    }

    let estanteria: string | null = null;
    let estante: string | null = null;
    let seccion: string | null = null;

    const estanteriaMatch = observaciones.match(/Estanter[íi]a:\s*([^,|]+)/i);
    if (estanteriaMatch && estanteriaMatch[1]) {
      estanteria = estanteriaMatch[1].trim();
    }

    const estanteMatch = observaciones.match(/Estante:\s*([^,|]+)/i);
    if (estanteMatch && estanteMatch[1]) {
      estante = estanteMatch[1].trim();
    }

    const seccionMatch = observaciones.match(/Secci[óo]n:\s*([^,|]+)/i);
    if (seccionMatch && seccionMatch[1]) {
      seccion = seccionMatch[1].trim();
    }

    return { estanteria, estante, seccion };
  }

  prepararStockData3D(stock: any[]): void {
    console.log('📦 Preparando StockData3D. Stock recibido:', stock.length, 'items');
    console.log('📦 Stock crudo (primeros 5):', stock.slice(0, 5).map(item => ({
      estanteria: item.estanteria,
      estante: item.estante,
      seccion: item.seccion,
      almacen: item.almacen?.id
    })));

    this.stockData3D = stock
      .filter(item => {
        // Solo incluir items del ALM03
        const esALM03 = item.almacen && (item.almacen.id === 3 || 
          item.almacen.numero?.toUpperCase().includes('ALM03') ||
          item.almacen.nombre?.toUpperCase().includes('ALMACEN PRINCIPAL'));
        return esALM03;
      })
      .map(item => {
        // Normalizar estantería (E1, E2, etc.)
        let estanteria = item.estanteria?.toString().trim().toUpperCase() || '';
        if (estanteria && !estanteria.startsWith('E')) {
          const numMatch = estanteria.match(/\d+/);
          if (numMatch) {
            estanteria = `E${numMatch[0]}`;
          } else if (estanteria) {
            // Si tiene texto pero no número, intentar extraer
            estanteria = '';
          }
        }

        // Normalizar estante (1, 2, 3)
        let estante = item.estante?.toString().trim() || '';
        if (estante && !/^\d+$/.test(estante)) {
          const numMatch = estante.match(/\d+/);
          if (numMatch) {
            estante = numMatch[0];
          } else {
            estante = '';
          }
        }

        // Normalizar sección (A, B, C)
        let seccion = item.seccion?.toString().trim().toUpperCase() || '';
        if (seccion && !/^[A-Z]$/.test(seccion)) {
          const letraMatch = seccion.match(/[A-Z]/);
          if (letraMatch) {
            seccion = letraMatch[0];
          } else {
            seccion = '';
          }
        }

        const resultado = {
          estanteria: estanteria || undefined,
          estante: estante || undefined,
          seccion: seccion || undefined,
          cantidad: item.cantidad || 1,
          ...item
        } as StockItem;

        if (estanteria && estante && seccion) {
          console.log(`✅ Item normalizado: ${estanteria}/${estante}/${seccion}`, {
            original: {
              estanteria: item.estanteria,
              estante: item.estante,
              seccion: item.seccion
            },
            normalizado: { estanteria, estante, seccion }
          });
        } else {
          console.warn(`⚠️ Item sin datos completos:`, {
            original: {
              estanteria: item.estanteria,
              estante: item.estante,
              seccion: item.seccion
            },
            normalizado: { estanteria, estante, seccion },
            item: item['item']?.nombreItem || 'Sin nombre'
          });
        }

        return resultado;
      })
      .filter(item => {
        // Solo incluir items que tengan estantería, estante Y sección
        const tieneDatosCompletos = item.estanteria && item.estante && item.seccion;
        if (!tieneDatosCompletos) {
          console.warn(`❌ Item excluido por falta de datos:`, {
            estanteria: item.estanteria,
            estante: item.estante,
            seccion: item.seccion
          });
        }
        return tieneDatosCompletos;
      });

    console.log('📦 StockData3D preparado para demo:', this.stockData3D.length, 'items válidos');
    console.log('📦 Detalles finales:', this.stockData3D.map(item => ({
      estanteria: item.estanteria,
      estante: item.estante,
      seccion: item.seccion,
      nombre: item['item']?.nombreItem
    })));
  }

  onCajaSeleccionada(info: CajaInfo): void {
    console.log('Caja seleccionada:', info);
    
    // Usar el contenido real de la caja si está disponible
    // Si no hay contenido, usar datos de ejemplo como fallback
    if (!info.contenido || info.contenido.length === 0) {
      // Fallback a datos de ejemplo solo si no hay contenido real
      if (info.nivel === 1 && info.posicion === 1) {
        info.contenido = this.contenidoEjemplo;
      } else {
        info.contenido = [];
      }
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

