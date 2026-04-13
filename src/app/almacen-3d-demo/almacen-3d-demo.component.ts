import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Almacen3DComponent, CajaInfo, StockItem, EstanteriaLayout } from '../components/almacen-3d/almacen-3d.component';
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
import { TransferirEquipoModalComponent } from '../components/transferir-equipo-modal/transferir-equipo-modal.component';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-almacen-3d-demo',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule, Almacen3DComponent, NotificationContainerComponent],
  templateUrl: './almacen-3d-demo.component.html',
  styleUrls: ['./almacen-3d-demo.component.css']
})
export class Almacen3DDemoComponent implements OnInit, OnDestroy {
  
  cajaSeleccionada: CajaInfo | null = null;
  mostrarModal: boolean = false;
  loading: boolean = false;
  stockData3D: StockItem[] = [];
  almacenes: any[] = [];
  almacenSeleccionado: any = null;
  configSeleccionada: AlmacenConfig | null = null;
  almacenConfigsMap: Map<number, AlmacenConfig> = new Map();
  almacenIdParaModal: number = 2;
  editLayoutMode: boolean = false;
  /** Layout persistido (localStorage) y usado fuera del modo edición. */
  estanteriasLayout: EstanteriaLayout[] = [];
  /** Borrador editable en el panel; no se envía al 3D hasta "Aplicar al 3D" o "Guardar". */
  estanteriasLayoutDraft: EstanteriaLayout[] = [];
  /** Lo que recibe app-almacen-3d (evita reconstruir la escena en cada tecla). */
  estanteriasLayoutFor3d: EstanteriaLayout[] = [];
  transferiendoItemId: string | number | null = null;
  reactivandoItemId: string | number | null = null;

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
    private networkInfoService: NetworkInfoService,
    private authService: AuthService
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
          this.cargarLayoutGuardado(defaultAlmacen.id);
          this.cargarStockParaAlmacen(defaultAlmacen);
        }
      },
      error: (err) => {
        console.error('Error al cargar almacenes/config:', err);
      }
    });
  }

  ngOnDestroy(): void {
  }

  compareAlmacenes(a: any, b: any): boolean {
    return a && b && a.id === b.id;
  }

  onAlmacenCambio(): void {
    if (!this.almacenSeleccionado) return;
    this.configSeleccionada = this.almacenConfigsMap.get(this.almacenSeleccionado.id) || null;
    this.editLayoutMode = false;
    this.cargarLayoutGuardado(this.almacenSeleccionado.id);
    this.cargarStockParaAlmacen(this.almacenSeleccionado);
  }

  private getLayoutStorageKey(almacenId: number): string {
    return `almacen-layout-${almacenId}`;
  }

  private cargarLayoutGuardado(almacenId: number): void {
    try {
      const raw = localStorage.getItem(this.getLayoutStorageKey(almacenId));
      const parsed = raw ? JSON.parse(raw) : [];
      this.estanteriasLayout = Array.isArray(parsed) ? parsed : [];
      this.estanteriasLayoutDraft = this.cloneLayout(this.estanteriasLayout);
      this.estanteriasLayoutFor3d = this.cloneLayout(this.estanteriasLayout);
    } catch {
      this.estanteriasLayout = [];
      this.estanteriasLayoutDraft = [];
      this.estanteriasLayoutFor3d = [];
    }
  }

  private cloneLayout(layout: EstanteriaLayout[]): EstanteriaLayout[] {
    return layout.map(e => ({ ...e }));
  }

  toggleEditLayoutMode(): void {
    if (this.editLayoutMode) {
      this.editLayoutMode = false;
      this.estanteriasLayoutFor3d = this.cloneLayout(this.estanteriasLayout);
      this.estanteriasLayoutDraft = this.cloneLayout(this.estanteriasLayout);
      return;
    }
    this.editLayoutMode = true;
    this.estanteriasLayoutDraft = this.cloneLayout(this.estanteriasLayout);
    if (this.estanteriasLayoutDraft.length === 0 && this.configSeleccionada) {
      this.estanteriasLayoutDraft = this.generarLayoutBase(this.configSeleccionada.cantidadEstanterias);
    }
    this.estanteriasLayoutFor3d = this.cloneLayout(this.estanteriasLayoutDraft);
  }

  /** Actualiza la escena 3D con los valores del borrador (un solo rebuild). */
  aplicarLayoutAl3d(): void {
    this.estanteriasLayoutFor3d = this.cloneLayout(this.estanteriasLayoutDraft);
  }

  guardarLayout(): void {
    if (!this.almacenSeleccionado?.id) return;
    this.estanteriasLayout = this.cloneLayout(this.estanteriasLayoutDraft);
    localStorage.setItem(this.getLayoutStorageKey(this.almacenSeleccionado.id), JSON.stringify(this.estanteriasLayout));
    this.estanteriasLayoutFor3d = this.cloneLayout(this.estanteriasLayout);
    this.notificationService.showSuccessMessage('Layout del almacén guardado correctamente.');
    this.editLayoutMode = false;
  }

  resetLayout(): void {
    if (!this.almacenSeleccionado?.id || !this.configSeleccionada) return;
    localStorage.removeItem(this.getLayoutStorageKey(this.almacenSeleccionado.id));
    this.estanteriasLayout = [];
    this.estanteriasLayoutDraft = this.generarLayoutBase(this.configSeleccionada.cantidadEstanterias);
    this.estanteriasLayoutFor3d = [];
    this.notificationService.showSuccessMessage('Layout restablecido al modo automático.');
  }

  private generarLayoutBase(cantidadEstanterias: number): EstanteriaLayout[] {
    const espacioEntreEstanterias = 7;
    const espacioEntreFilas = 8;
    const profundidadEstanteria = 1.5;
    const anchoEstanteria = 18;
    const numCols = Math.ceil(Math.sqrt(cantidadEstanterias));
    const numFilas = Math.ceil(cantidadEstanterias / numCols);
    const anchoTotal = numFilas * anchoEstanteria + (numFilas - 1) * espacioEntreFilas;
    const profTotal = numCols * profundidadEstanteria + (numCols - 1) * espacioEntreEstanterias;
    const offsetInicialX = -anchoTotal / 2 + anchoEstanteria / 2;
    const offsetInicialZ = -profTotal / 2 + profundidadEstanteria / 2;

    const output: EstanteriaLayout[] = [];
    let idx = 0;
    for (let fila = 0; fila < numFilas && idx < cantidadEstanterias; fila++) {
      const offsetX = offsetInicialX + fila * (anchoEstanteria + espacioEntreFilas);
      for (let col = 0; col < numCols && idx < cantidadEstanterias; col++) {
        const offsetZ = offsetInicialZ + col * (profundidadEstanteria + espacioEntreEstanterias);
        output.push({
          estanteriaId: `E${idx + 1}`,
          offsetX,
          offsetZ,
          rotationY: 0
        });
        idx++;
      }
    }
    return output;
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
        esEquipoEspecial: true,
        tipoEquipo: 'EQUIPO',
        itemId: estado.hardwareId,
        numero: hw.name || `Equipo ${estado.hardwareId}`,
        estadoInfo: estado,
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
        esEquipoEspecial: true,
        tipoEquipo: 'DISPOSITIVO',
        numero: estado.mac || device.mac,
        estadoInfo: estado,
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
            esEquipoEspecial: true,
            tipoEquipo: 'EQUIPO',
            itemId: estado.hardwareId,
            numero: hw.name || `Equipo ${estado.hardwareId}`,
            estadoInfo: estado,
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
            esEquipoEspecial: true,
            tipoEquipo: 'DISPOSITIVO',
            numero: estado.mac || (device as any).mac,
            estadoInfo: estado,
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
    if (!this.esEquipoEspecial(item)) return;

    const tipo = this.getTipoEquipo(item);
    if (tipo === 'EQUIPO') {
      const hardwareId = item.itemId || item.estadoInfo?.hardwareId;
      if (!hardwareId) {
        this.notificationService.showError('Error', 'No se pudo identificar el equipo a transferir.');
        return;
      }

      const modalRef = this.modalService.open(TransferirEquipoModalComponent, { size: 'lg' });
      modalRef.componentInstance.item = { tipo: 'EQUIPO', name: item.numero || item.item?.nombreItem || 'Equipo' };

      modalRef.result.then((transferData: any) => {
        if (!transferData) return;
        this.transferiendoItemId = item.itemId || item.numero;
        const requestData = {
          ...transferData,
          usuario: this.authService.getUsuarioParaAuditoria()
        };
        this.estadoEquipoService.transferirEquipo(hardwareId, requestData).subscribe({
          next: (response: any) => {
            if (response?.success) {
              this.notificationService.showSuccessMessage('Equipo transferido exitosamente.');
              this.cargarStockParaAlmacen(this.almacenSeleccionado, () => this.actualizarContenidoCajaModal(), true);
            } else {
              this.notificationService.showError('Error al transferir', response?.message || 'No se pudo transferir el equipo.');
            }
          },
          error: () => this.notificationService.showError('Error al transferir', 'No se pudo transferir el equipo.'),
          complete: () => this.transferiendoItemId = null
        });
      }).catch(() => {});
      return;
    }

    const mac = item.numero || item.estadoInfo?.mac || item.item?.nombreItem;
    if (!mac) {
      this.notificationService.showError('Error', 'No se pudo identificar el dispositivo a transferir.');
      return;
    }

    const modalRef = this.modalService.open(TransferirEquipoModalComponent, { size: 'lg' });
    modalRef.componentInstance.item = { tipo: 'DISPOSITIVO', name: item.item?.nombreItem || mac, mac };
    modalRef.result.then((transferData: any) => {
      if (!transferData) return;
      this.transferiendoItemId = item.numero || mac;
      const requestData = {
        ...transferData,
        usuario: this.authService.getUsuarioParaAuditoria()
      };
      this.estadoDispositivoService.transferirDispositivo(mac, requestData).subscribe({
        next: (response: any) => {
          if (response?.success) {
            this.notificationService.showSuccessMessage('Dispositivo transferido exitosamente.');
            this.cargarStockParaAlmacen(this.almacenSeleccionado, () => this.actualizarContenidoCajaModal(), true);
          } else {
            this.notificationService.showError('Error al transferir', response?.message || 'No se pudo transferir el dispositivo.');
          }
        },
        error: () => this.notificationService.showError('Error al transferir', 'No se pudo transferir el dispositivo.'),
        complete: () => this.transferiendoItemId = null
      });
    }).catch(() => {});
  }

  reactivarItem(item: any): void {
    if (!this.esEquipoEspecial(item)) return;

    const tipo = this.getTipoEquipo(item);
    if (tipo === 'EQUIPO') {
      const hardwareId = item.itemId || item.estadoInfo?.hardwareId;
      if (!hardwareId) {
        this.notificationService.showError('Error', 'No se pudo identificar el equipo a reactivar.');
        return;
      }
      this.reactivandoItemId = item.itemId || item.numero;
      const request = {
        observaciones: 'Reactivado desde almacén 3D',
        usuario: this.authService.getUsuarioParaAuditoria()
      };
      this.estadoEquipoService.reactivarEquipo(hardwareId, request).subscribe({
        next: (response: any) => {
          if (response?.success) {
            this.notificationService.showSuccessMessage('Equipo reactivado exitosamente.');
            this.cargarStockParaAlmacen(this.almacenSeleccionado, () => this.actualizarContenidoCajaModal(), true);
          } else {
            this.notificationService.showError('Error al reactivar', response?.message || 'No se pudo reactivar el equipo.');
          }
        },
        error: () => this.notificationService.showError('Error al reactivar', 'No se pudo reactivar el equipo.'),
        complete: () => this.reactivandoItemId = null
      });
      return;
    }

    const mac = item.numero || item.estadoInfo?.mac || item.item?.nombreItem;
    if (!mac) {
      this.notificationService.showError('Error', 'No se pudo identificar el dispositivo a reactivar.');
      return;
    }
    this.reactivandoItemId = item.numero || mac;
    const request = {
      observaciones: 'Reactivado desde almacén 3D',
      usuario: this.authService.getUsuarioParaAuditoria()
    };
    this.estadoDispositivoService.reactivarDispositivo(mac, request).subscribe({
      next: (response: any) => {
        if (response?.success) {
          this.notificationService.showSuccessMessage('Dispositivo reactivado exitosamente.');
          this.cargarStockParaAlmacen(this.almacenSeleccionado, () => this.actualizarContenidoCajaModal(), true);
        } else {
          this.notificationService.showError('Error al reactivar', response?.message || 'No se pudo reactivar el dispositivo.');
        }
      },
      error: () => this.notificationService.showError('Error al reactivar', 'No se pudo reactivar el dispositivo.'),
      complete: () => this.reactivandoItemId = null
    });
  }

  esEquipoEspecial(item: any): boolean {
    return item?.esEquipoEspecial === true || (!item?.id && !!item?.tipoEquipo);
  }

  getTipoEquipo(item: any): 'EQUIPO' | 'DISPOSITIVO' | '' {
    const tipo = (item?.tipoEquipo || '').toString().toUpperCase();
    return (tipo === 'EQUIPO' || tipo === 'DISPOSITIVO') ? tipo : '';
  }

  onItemClick(item: any): void {
    if (item?.id) {
      this.abrirModalCantidad(item);
    }
  }
}

