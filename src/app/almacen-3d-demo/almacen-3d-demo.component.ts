import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Almacen3DComponent, CajaInfo, StockItem } from '../components/almacen-3d/almacen-3d.component';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { StockAlmacenService } from '../services/stock-almacen.service';
import { AlmacenService } from '../services/almacen.service';
import { AlmacenConfigService } from '../services/almacen-config.service';
import { NotificationService } from '../services/notification.service';
import { RegistrarStockModalComponent } from '../components/registrar-stock-modal/registrar-stock-modal.component';
import { ModificarCantidadModalComponent } from '../components/modificar-cantidad-modal/modificar-cantidad-modal.component';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { EstadoEquipoService } from '../services/estado-equipo.service';
import { EstadoDispositivoService } from '../services/estado-dispositivo.service';
import { HardwareService } from '../services/hardware.service';
import { BiosService } from '../services/bios.service';
import { NetworkInfoService } from '../services/network-info.service';
import { NetworkInfoDTO } from '../interfaces/network-info.interface';
import { AlmacenConfig } from '../interfaces/almacen-config.interface';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-almacen-3d-demo',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule, Almacen3DComponent, NotificationContainerComponent],
  templateUrl: './almacen-3d-demo.component.html',
  styleUrls: ['./almacen-3d-demo.component.css']
})
export class Almacen3DDemoComponent implements OnInit {
  
  cajaSeleccionada: CajaInfo | null = null;
  mostrarModal: boolean = false;
  loading: boolean = false;
  stockData3D: StockItem[] = [];
  almacenes: any[] = [];
  almacenSeleccionado: any = null;
  configSeleccionada: AlmacenConfig | null = null;
  almacenConfigsMap: Map<number, AlmacenConfig> = new Map();
  almacenIdParaModal: number = 2;

  constructor(
    private modalService: NgbModal,
    private stockAlmacenService: StockAlmacenService,
    private notificationService: NotificationService,
    private almacenService: AlmacenService,
    private almacenConfigService: AlmacenConfigService,
    private estadoEquipoService: EstadoEquipoService,
    private estadoDispositivoService: EstadoDispositivoService,
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private networkInfoService: NetworkInfoService
  ) {}

  ngOnInit(): void {
    forkJoin({
      almacenes: this.almacenService.getAllAlmacenes(),
      configs: this.almacenConfigService.getAllConfigs()
    }).subscribe({
      next: (res: any) => {
        this.almacenes = Array.isArray(res.almacenes) ? res.almacenes : [];
        this.almacenConfigsMap = new Map();
        if (Array.isArray(res.configs)) {
          res.configs.forEach((c: AlmacenConfig) => {
            if (c.almacen?.id) this.almacenConfigsMap.set(c.almacen.id, c);
          });
        }
        const defaultAlmacen = this.almacenes.find((a: any) =>
          a.id === 2 || a.numero?.toUpperCase().includes('ALM02')
        ) || this.almacenes[0];
        if (defaultAlmacen) {
          this.almacenSeleccionado = defaultAlmacen;
          this.configSeleccionada = this.almacenConfigsMap.get(defaultAlmacen.id) || null;
          this.cargarStockParaAlmacen(defaultAlmacen);
        }
      },
      error: (err) => {
        console.error('Error al cargar almacenes/config:', err);
      }
    });
  }

  compareAlmacenes(a: any, b: any): boolean {
    return a && b && a.id === b.id;
  }

  onAlmacenCambio(): void {
    if (!this.almacenSeleccionado) return;
    this.configSeleccionada = this.almacenConfigsMap.get(this.almacenSeleccionado.id) || null;
    this.cargarStockParaAlmacen(this.almacenSeleccionado);
  }

  esCementerio(almacen: any): boolean {
    if (!almacen) return false;
    const num = (almacen.numero || '').toString().toLowerCase().trim();
    const nom = (almacen.nombre || '').toString().toLowerCase();
    return num === 'alm01' || num === 'alm 01' || nom.includes('subsuelo') || nom.includes('cementerio');
  }

  cargarStockParaAlmacen(almacen: any, onComplete?: () => void, silent = false): void {
    if (!almacen) return;
    if (!silent) this.loading = true;
    this.almacenIdParaModal = almacen.id;
    const esCementerio = this.esCementerio(almacen);

    const observables: any = {
      stock: this.stockAlmacenService.getAllStock(),
      hardware: this.hardwareService.getHardware(),
      bios: this.biosService.getAllBios(),
      networkInfo: this.networkInfoService.getNetworkInfo()
    };
    if (esCementerio) {
      observables.equiposEnBaja = this.estadoEquipoService.getEquiposEnBaja();
      observables.dispositivosEnBaja = this.estadoDispositivoService.getDispositivosEnBaja();
    } else {
      observables.equiposAlmacen = this.estadoEquipoService.getEquiposEnAlmacen();
      observables.dispositivosAlmacen = this.estadoDispositivoService.getDispositivosEnAlmacen();
    }

    forkJoin(observables).subscribe({
      next: (response: any) => {
        let stockCompleto: any[] = [];
        if (Array.isArray(response.stock)) {
          stockCompleto = response.stock.filter((item: any) =>
            item.almacen && item.almacen.id === almacen.id
          );
        }
        if (esCementerio) {
          const itemsCementerio = this.convertirEnBajaAStock(
            response.equiposEnBaja,
            response.dispositivosEnBaja,
            Array.isArray(response.hardware) ? response.hardware : [],
            Array.isArray(response.bios) ? response.bios : [],
            response.networkInfo,
            almacen
          );
          stockCompleto = [...stockCompleto, ...itemsCementerio];
        } else {
          const equiposEnAlmacen = response.equiposAlmacen?.success && Array.isArray(response.equiposAlmacen.data)
            ? response.equiposAlmacen.data.filter((e: any) => e.almacenId === almacen.id)
            : [];
          const dispositivosEnAlmacen = response.dispositivosAlmacen?.success && Array.isArray(response.dispositivosAlmacen.data)
            ? response.dispositivosAlmacen.data.filter((d: any) => d.almacenId === almacen.id)
            : [];
          const itemsEquipos = this.convertirEquiposAStock(
            equiposEnAlmacen,
            Array.isArray(response.hardware) ? response.hardware : [],
            Array.isArray(response.bios) ? response.bios : [],
            almacen
          );
          const itemsDispositivos = this.convertirDispositivosAStock(
            dispositivosEnAlmacen,
            response.networkInfo,
            almacen
          );
          stockCompleto = [...stockCompleto, ...itemsEquipos, ...itemsDispositivos];
        }
        this.prepararStockData3D(stockCompleto, almacen);
        if (!silent) this.loading = false;
        onComplete?.();
      },
      error: (error) => {
        console.error('Error al cargar stock:', error);
        if (!silent) this.loading = false;
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

  /** Convierte equipos/dispositivos en baja a formato stock para cementerio */
  convertirEnBajaAStock(
    equiposEnBaja: any,
    dispositivosEnBaja: any,
    hardware: any[],
    bios: any[],
    networkInfo: any,
    almacen: any
  ): any[] {
    const items: any[] = [];
    const biosMap = new Map((bios || []).map((b: any) => [b.hardwareId, b]));
    const almacenNorm = { id: almacen.id, numero: almacen.numero, nombre: almacen.nombre };

    if (equiposEnBaja?.success && Array.isArray(equiposEnBaja.data)) {
      equiposEnBaja.data.forEach((estado: any) => {
        const hw = (hardware || []).find((h: any) => h.id === estado.hardwareId);
        if (hw) {
          const { estanteria, estante, seccion } = this.parsearEstanteriaYEstante(estado.observaciones);
          const biosData = biosMap.get(estado.hardwareId);
          items.push({
            almacen: almacenNorm,
            estanteria: estanteria || null,
            estante: estante || null,
            seccion: seccion || null,
            cantidad: 1,
            item: {
              nombreItem: hw.name || `Equipo ${estado.hardwareId}`,
              descripcion: `${biosData?.type || 'N/A'} | ${hw.osName || 'N/A'}`
            }
          });
        }
      });
    }

    if (dispositivosEnBaja?.success && Array.isArray(dispositivosEnBaja.data) &&
        networkInfo?.success && Array.isArray(networkInfo.data)) {
      const netMap = new Map(networkInfo.data.map((d: any) => [d.mac, d]));
      dispositivosEnBaja.data.forEach((estado: any) => {
        const device = netMap.get(estado.mac);
        if (device) {
          const { estanteria, estante, seccion } = this.parsearEstanteriaYEstante(estado.observaciones);
          items.push({
            almacen: almacenNorm,
            estanteria: estanteria || null,
            estante: estante || null,
            seccion: seccion || null,
            cantidad: 1,
            item: {
              nombreItem: (device as any).name || estado.mac,
              descripcion: `${(device as any).type || 'N/A'} | ${(device as any).description || 'Sin descripción'}`
            }
          });
        }
      });
    }
    return items;
  }

  prepararStockData3D(stock: any[], almacen: any): void {
    const almacenId = almacen?.id;
    const tieneConfig = this.configSeleccionada != null;

    let itemsFiltrados = stock.filter((item: any) =>
      item.almacen && item.almacen.id === almacenId
    );

    this.stockData3D = itemsFiltrados
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
        if (tieneConfig) {
          return !!(item.estanteria && item.estante && item.seccion);
        }
        return true;
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

  /** Indica si el modal muestra la montaña de cajas (almacén sin estructura) */
  esMontana(): boolean {
    return this.cajaSeleccionada?.estanteria === 'Montaña';
  }

  /** Actualiza el contenido de la caja seleccionada desde stockData3D */
  private actualizarContenidoCajaModal(): void {
    if (!this.cajaSeleccionada || !this.stockData3D.length) return;
    const estanteria = this.cajaSeleccionada.estanteria?.toString().toUpperCase().trim();
    const estante = this.cajaSeleccionada.nivel?.toString().trim();
    const seccion = this.cajaSeleccionada.seccion?.toString().toLowerCase().trim();
    if (!estanteria || !estante || !seccion) return;
    this.cajaSeleccionada.contenido = this.stockData3D.filter((item: any) => {
      const itemEst = item.estanteria?.toString().toUpperCase().trim();
      const itemNiv = item.estante?.toString().trim();
      const itemSec = item.seccion?.toString().toLowerCase().trim();
      return itemEst === estanteria && itemNiv === estante && itemSec === seccion;
    });
  }

  agregarItem(): void {
    if (!this.cajaSeleccionada) return;
    const modalRef = this.modalService.open(RegistrarStockModalComponent, { size: 'lg', backdrop: true });
    modalRef.componentInstance.almacenIdPreseleccionado = this.almacenIdParaModal;
    modalRef.componentInstance.ubicacionPreseleccionada = this.esMontana() ? undefined : {
      estanteria: this.cajaSeleccionada.estanteria,
      estante: String(this.cajaSeleccionada.nivel),
      division: (this.cajaSeleccionada.seccion || '').toUpperCase()
    };
    modalRef.result.then((result: { success?: boolean }) => {
      if (result?.success) {
        this.cargarStockParaAlmacen(this.almacenSeleccionado);
        this.cerrarModal();
      }
    }).catch(() => {});
  }

  abrirModalCantidad(item: any): void {
    if (!item?.id) return;
    const modalRef = this.modalService.open(ModificarCantidadModalComponent, { size: 'md' });
    modalRef.componentInstance.item = item;
    modalRef.result.then((result: { success?: boolean }) => {
      if (result?.success) {
        this.cargarStockParaAlmacen(this.almacenSeleccionado, () => this.actualizarContenidoCajaModal(), true);
      }
    }).catch(() => {});
  }

  transferirItem(item: any): void {
    this.notificationService.showInfo('Transferir', 'Funcionalidad de transferencia disponible en la vista principal de stock.');
  }
}

