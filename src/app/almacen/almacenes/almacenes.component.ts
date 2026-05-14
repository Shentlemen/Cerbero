import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { StockAlmacenService } from '../../services/stock-almacen.service';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';
import { StockAlmacenComponent } from '../stock-almacen/stock-almacen.component';
import { EstadoEquipoService } from '../../services/estado-equipo.service';
import { EstadoDispositivoService } from '../../services/estado-dispositivo.service';
import { HardwareService } from '../../services/hardware.service';
import { BiosService } from '../../services/bios.service';
import { NetworkInfoService } from '../../services/network-info.service';
import { forkJoin } from 'rxjs';
import { TourRegistryService } from '../../services/tour-registry.service';
import { GuidedTourHostService, type GuidedTourStepDef } from '../../services/guided-tour-host.service';
import type { Driver, DriveStep } from 'driver.js';
import { driver } from 'driver.js';
import { RegistrarStockModalComponent } from '../../components/registrar-stock-modal/registrar-stock-modal.component';

@Component({
  selector: 'app-almacenes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    NotificationContainerComponent,
    StockAlmacenComponent
  ],
  templateUrl: './almacenes.component.html',
  styleUrls: ['./almacenes.component.css']
})
export class AlmacenesComponent implements OnInit, OnDestroy {
  almacenes: Almacen[] = [];
  almacenesFiltrados: Almacen[] = [];
  stock: any[] = []; // Stock del sistema (incluye stock normal + equipos especiales)
  loading: boolean = false;
  error: string | null = null;
  almacenForm: FormGroup;
  modoEdicion: boolean = false;
  almacenSeleccionado: Almacen | null = null;
  almacenAEliminar: Almacen | null = null;

  // Almacenes especiales
  almacenCementerio: Almacen | null = null; // alm01 subsuelo
  almacenLaboratorio: Almacen | null = null; // alm05 pañol 3

  // Paginación
  page = 1;
  pageSize = 10;
  collectionSize = 0;

  // Ordenamiento
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Filtrado
  searchTerm: string = '';
  searchResultsCount: number = 0;

  // Propiedades para el diálogo de confirmación
  showConfirmDialog: boolean = false;

  /** Almacén cuyo stock se muestra incrustado debajo de las tarjetas */
  almacenStockInline: Almacen | null = null;

  /** Si el usuario cerró el panel, no volver a abrir solo el almacén 1 al refrescar datos. */
  private omitirAbrirStockPorDefecto = false;
  private tourCleanup?: () => void;
  private pageTour?: Driver;

  /** Referencia al modal demo abierto para el tour de Registrar Stock. */
  private tourDemoStockModalRef?: import('@ng-bootstrap/ng-bootstrap').NgbModalRef;
  private tourRegistrarStock?: Driver;

  /** Validación y errores API en el modal crear/editar almacén (pie del modal). */
  almacenModalValidacion: { titulo: string; lineas: string[]; esError: boolean } | null = null;

  constructor(
    private stockAlmacenService: StockAlmacenService,
    private almacenService: AlmacenService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private estadoEquipoService: EstadoEquipoService,
    private estadoDispositivoService: EstadoDispositivoService,
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private networkInfoService: NetworkInfoService,
    private tourRegistry: TourRegistryService,
    private guidedTourHost: GuidedTourHostService
  ) {
    this.almacenForm = this.fb.group({
      numero: ['', [Validators.required, Validators.maxLength(50)]],
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      descripcion: ['', Validators.maxLength(500)]
    });

    this.almacenForm.valueChanges.subscribe(() => this.limpiarFeedbackAlmacenModal());
  }

  limpiarFeedbackAlmacenModal(): void {
    this.almacenModalValidacion = null;
  }

  private mensajeErrorHttp(error: unknown): string {
    const e = error as { error?: string | { message?: string }; message?: string };
    const body = e?.error;
    if (typeof body === 'string') {
      return body;
    }
    if (body && typeof body === 'object' && typeof body.message === 'string') {
      return body.message;
    }
    if (typeof e?.message === 'string') {
      return e.message;
    }
    return 'Ocurrió un error inesperado.';
  }

  private armarLineasValidacionAlmacen(): string[] {
    const lineas: string[] = [];
    const n = this.almacenForm.get('numero');
    const nom = this.almacenForm.get('nombre');
    if (n?.hasError('required')) {
      lineas.push('El número es obligatorio.');
    } else if (n?.hasError('maxlength')) {
      lineas.push('El número no puede exceder 50 caracteres.');
    }
    if (nom?.hasError('required')) {
      lineas.push('El nombre es obligatorio.');
    } else if (nom?.hasError('maxlength')) {
      lineas.push('El nombre no puede exceder 100 caracteres.');
    }
    return lineas;
  }

  ngOnInit(): void {
    this.omitirAbrirStockPorDefecto = false;
    this.cargarDatos();
    const tours: import('../../services/tour-registry.service').TourDefinition[] = [
      {
        id: 'almacenes-overview',
        title: 'Tour de almacenes',
        icon: 'fa-route',
        run: () => this.runTourAlmacenes(),
      }
    ];
    if (this.permissionsService.canManageWarehouseAssets()) {
      tours.push({
        id: 'almacenes-registrar-stock-detalle',
        title: 'Cómo registrar stock',
        icon: 'fa-box',
        run: () => this.runTourRegistrarStock(),
      });
    }
    this.tourCleanup = this.tourRegistry.register('almacenes', tours);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
    this.pageTour?.destroy();
    this.pageTour = undefined;
    this.tourRegistrarStock?.destroy();
    this.tourRegistrarStock = undefined;
    this.tourDemoStockModalRef?.dismiss();
  }

  /**
   * Tour completo de almacenes: primero recorre las tarjetas y luego abre el panel
   * de stock incrustado para mostrar el listado, el árbol de estanterías y los KPIs.
   */
  private runTourAlmacenes(): void {
    this.pageTour?.destroy();
    this.pageTour = undefined;

    const pasosCabecera: GuidedTourStepDef[] = [
      { selector: '#tour-almacenes-title', title: 'Almacenes',
        description: 'Vista en tarjetas de cada depósito físico y su numeración. Cada tarjeta resume su nombre, dirección y cantidad de ítems en stock.', side: 'bottom' },
      { selector: '#tour-almacenes-nuevo', title: 'Alta de almacén',
        description: 'Creá o editá datos del almacén según tu rol (GM, Admin, Almacén). Desde acá también podés definir su <strong>estructura interna</strong> de estanterías y estantes.', side: 'left' },
      { selector: '#tour-almacenes-cards', title: 'Tarjetas de almacenes',
        description: 'Hacé clic en una tarjeta para abrir el panel de stock <strong>incrustado debajo</strong> y operar movimientos sin salir de esta pantalla.', side: 'top' }
    ];

    const almacenParaTour = this.elegirAlmacenParaTour();
    if (almacenParaTour) {
      this.omitirAbrirStockPorDefecto = false;
      if (this.almacenStockInline?.id !== almacenParaTour.id) {
        this.almacenStockInline = almacenParaTour;
      }
    }

    const pasosStock: GuidedTourStepDef[] = [
      { selector: '#tour-stock-almacen-title', title: 'Stock del almacén',
        description: 'Al abrir el panel ves el <strong>stock incrustado</strong> del almacén elegido. Desde acá registrás entradas/salidas y movimientos internos sin perder la lista de almacenes de arriba.', side: 'bottom' },
      { selector: '#tour-stock-almacen-toolbar', title: 'Búsqueda y acciones',
        description: 'Buscá por <strong>ítem, número, descripción o estantería</strong> y usá las acciones del toolbar (alta, importar, exportar, etc.) según tus permisos.', side: 'bottom' },
      { selector: '.registrar-stock-btn', title: 'Registrar stock',
        description: 'Abre el modal de <strong>alta de stock</strong> con el almacén actual ya seleccionado. Podés asociar la entrada a una compra y un ítem de esa compra, o registrar un equipo identificado por número/descripción.', side: 'bottom' },
      { selector: '#tour-stock-almacen-kpis', title: 'Indicadores rápidos',
        description: 'Totales del almacén: <strong>cantidad de ítems</strong>, <strong>estanterías</strong> y <strong>estantes</strong> visibles. Se actualizan en vivo al filtrar.', side: 'bottom' },
      { selector: '#tour-stock-almacen-tree', title: 'Árbol de estanterías',
        description: 'En el panel izquierdo aparece la <strong>estructura física</strong> del almacén: estanterías (con su ícono de capas) y, al expandirlas, los estantes individuales. Cada nodo muestra cuántos ítems hay dentro.', side: 'right' },
      { selector: '#tour-stock-almacen-tree', title: 'Cómo seleccionar una estantería',
        description: 'Hacé clic en una <strong>estantería</strong> para ver sólo los ítems de esa estantería en el listado. Si la abrís, podés además clickear un <strong>estante</strong> específico y el listado se filtra al estante. Volvé a clickear para deseleccionar.', side: 'right' },
      { selector: '#tour-stock-almacen-listado', title: 'Listado de stock',
        description: 'El listado de la derecha muestra los ítems filtrados según lo que hayas seleccionado en el árbol y/o la búsqueda. Cada fila tiene el ítem, su ubicación (estantería/estante/sección), cantidad y acciones disponibles según tus permisos.', side: 'top' },
      { selector: '.transferir-btn', title: 'Transferir equipo',
        description: 'Sólo aparece en <strong>equipos especiales</strong> (PCs, notebooks, monitores, etc.). Abre el flujo para <strong>mover el equipo a otro almacén</strong> o a otra ubicación dentro del mismo, registrando el movimiento en el historial.', side: 'top' },
      { selector: '.reactivar-btn', title: 'Reactivar equipo',
        description: 'En equipos especiales que estén <strong>dados de baja</strong> o en el cementerio, este botón los <strong>vuelve a poner en circulación</strong> en el almacén seleccionado, conservando su historia y datos técnicos.', side: 'top' }
    ];

    const todos = almacenParaTour ? [...pasosCabecera, ...pasosStock] : pasosCabecera;

    const lanzar = (): void => {
      const driveSteps = this.guidedTourHost.buildSteps(todos);
      if (driveSteps.length === 0) {
        return;
      }
      const inst = this.guidedTourHost.startTour(driveSteps, () => {
        this.resetScrollToTop();
      });
      if (inst) {
        this.pageTour = inst;
      }
    };

    if (almacenParaTour) {
      // Esperar a que <app-stock-almacen> termine de montar sus secciones internas.
      this.esperarSelectores(
        ['#tour-stock-almacen-title', '#tour-stock-almacen-toolbar', '#tour-stock-almacen-listado'],
        2500
      ).then(() => lanzar());
    } else {
      lanzar();
    }
  }

  /**
   * Tour DEMO del modal "Registrar Stock". Abre el modal en modo demo (datos pre-cargados y
   * guardado bloqueado) y guía paso a paso por cada campo y card del formulario.
   */
  private runTourRegistrarStock(): void {
    this.tourRegistrarStock?.destroy();
    this.tourRegistrarStock = undefined;

    const almacenParaTour = this.elegirAlmacenParaTour();

    const modalRef = this.modalService.open(RegistrarStockModalComponent, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });
    modalRef.componentInstance.tourDemoActivo = true;
    if (almacenParaTour?.id != null) {
      modalRef.componentInstance.almacenIdPreseleccionado = Number(almacenParaTour.id);
    }
    this.tourDemoStockModalRef = modalRef;
    modalRef.result
      .then(() => this.finalizarTourRegistrarStock())
      .catch(() => this.finalizarTourRegistrarStock());

    const pasos: GuidedTourStepDef[] = [
      { selector: '#tour-stock-modal-card-compra', title: 'Compra e Ítem',
        description: 'Acá podés <strong>vincular</strong> el stock a una compra existente y a un ítem específico de esa compra. Es <em>opcional</em>: si el equipo no proviene de una compra registrada, podés dejarlo vacío.', side: 'right' },
      { selector: '#tour-stock-modal-compra', title: 'Buscar compra',
        description: 'Escribí parte del <strong>número de compra</strong> para filtrar. Al seleccionar una compra, el campo de ítem se habilita y muestra los ítems disponibles de esa compra.', side: 'right' },
      { selector: '#tour-stock-modal-item', title: 'Ítem de la compra',
        description: 'Una vez elegida la compra, podés enlazar un <strong>ítem concreto</strong> (un lote particular). Esto hereda atributos del ítem y permite trazabilidad.', side: 'left' },
      { selector: '#tour-stock-modal-card-ubicacion', title: 'Ubicación en almacén',
        description: 'Definí <strong>dónde va a quedar</strong> físicamente el stock dentro del almacén: depósito, estantería, estante y sección.', side: 'right' },
      { selector: '#tour-stock-modal-almacen', title: 'Almacén (obligatorio)',
        description: 'Elegí el <strong>depósito físico</strong>. Si abriste el modal desde un almacén, viene ya seleccionado para acelerar la carga.', side: 'right' },
      { selector: '#tour-stock-modal-estanteria', title: 'Estantería (obligatoria)',
        description: 'Lista las <strong>estanterías configuradas</strong> para el almacén seleccionado. Si tu almacén todavía no tiene estructura definida, hay que cargarla primero desde el editor del almacén.', side: 'left' },
      { selector: '#tour-stock-modal-estante', title: 'Estante (obligatorio)',
        description: 'El estante existente <strong>dentro de la estantería elegida</strong>. Las opciones cambian dinámicamente según la estantería.', side: 'right' },
      { selector: '#tour-stock-modal-division', title: 'Sección (opcional)',
        description: 'Una subdivisión más fina del estante (ej.: bin/casillero). Sólo aparece si tu almacén define <strong>secciones</strong>.', side: 'left' },
      { selector: '#tour-stock-modal-card-detalles', title: 'Detalles del stock',
        description: 'Lo último: <strong>cuánto</strong> entra y <strong>cómo lo identificás</strong> dentro del sistema.', side: 'top' },
      { selector: '#tour-stock-modal-cantidad', title: 'Cantidad (obligatoria)',
        description: 'Número de unidades a registrar. Para equipos individuales (PC, monitor, etc.) suele ser <strong>1</strong>; para consumibles podés ingresar el lote completo.', side: 'right' },
      { selector: '#tour-stock-modal-numero', title: 'Número',
        description: 'Identificador propio del equipo siguiendo el formato <em>PC14563</em> (las letras "PC" seguidas del número, sin guiones ni espacios). Si <strong>no</strong> elegiste un ítem de compra, este campo o la descripción son <strong>obligatorios</strong>.', side: 'left' },
      { selector: '#tour-stock-modal-descripcion', title: 'Descripción',
        description: 'Texto libre para diferenciar este registro. Alternativa o complemento al número. Sin ítem de compra, <strong>se necesita número o descripción</strong>.', side: 'top' },
      { selector: '#tour-stock-modal-save', title: 'Registrar',
        description: 'En uso normal, este botón guarda el stock. En este tour está <strong>bloqueado</strong> para no crear datos reales. Al apretar <strong>Finalizar</strong> se cierra el tour y el modal demo.', side: 'left' }
    ];

    this.esperarSelectores(
      ['#tour-stock-modal-header', '#tour-stock-modal-card-compra', '#tour-stock-modal-save'],
      3000
    ).then(() => {
      const driveSteps = this.guidedTourHost.buildSteps(pasos);
      if (driveSteps.length === 0) {
        return;
      }
      const inst: Driver = driver({
        showProgress: true,
        nextBtnText: 'Siguiente',
        prevBtnText: 'Anterior',
        doneBtnText: 'Finalizar',
        allowClose: true,
        overlayOpacity: 0.55,
        stagePadding: 6,
        steps: driveSteps as DriveStep[],
        onDestroyed: () => {
          this.tourRegistrarStock = undefined;
          this.tourDemoStockModalRef?.dismiss();
        }
      });
      inst.drive();
      this.tourRegistrarStock = inst;
    });
  }

  /** Limpia estado del tour demo cuando el modal de Registrar Stock se cierra. */
  private finalizarTourRegistrarStock(): void {
    this.tourRegistrarStock?.destroy();
    this.tourRegistrarStock = undefined;
    this.tourDemoStockModalRef = undefined;
  }

  /** Elige el primer almacén con stock; si no hay, devuelve el primero cargado. */
  private elegirAlmacenParaTour(): Almacen | null {
    if (!this.almacenes || this.almacenes.length === 0) {
      return null;
    }
    const conStock = this.almacenes.find((a) => a?.id != null && this.tieneStock(Number(a.id)));
    return conStock ?? this.almacenes[0] ?? null;
  }

  /** Polling: resuelve cuando todos los selectores están en el DOM o expira `timeoutMs`. */
  private esperarSelectores(
    selectores: string[],
    timeoutMs: number = 2500,
    intervalMs: number = 60
  ): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const todos = selectores.every((sel) => !!document.querySelector(sel));
        if (todos || Date.now() - start >= timeoutMs) {
          resolve();
          return;
        }
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  /**
   * Vuelve la ventana al tope tras finalizar el tour. `requestAnimationFrame` anidado para que
   * la animación corra después de que el host de tours restaure el zoom global.
   */
  private resetScrollToTop(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          window.scrollTo(0, 0);
        }
      });
    });
  }

  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    // Cargar almacenes y stock en paralelo
    Promise.all([
      this.almacenService.getAllAlmacenes().toPromise(),
      this.stockAlmacenService.getAllStock().toPromise()
    ]).then(([almacenes, stock]) => {
      if (almacenes) {
        this.almacenes = almacenes;
        this.almacenesFiltrados = [...this.almacenes];
        this.actualizarPaginacion();
        
        // Encontrar los almacenes especiales
        this.almacenCementerio = almacenes.find((a: Almacen) => 
          a.numero?.toLowerCase().trim() === 'alm01' || 
          a.numero?.toLowerCase().trim() === 'alm 01' ||
          a.nombre?.toLowerCase().includes('subsuelo') ||
          a.nombre?.toLowerCase().includes('cementerio')
        ) || null;
        
        this.almacenLaboratorio = almacenes.find((a: Almacen) => 
          a.numero?.toLowerCase().trim() === 'alm05' || 
          a.numero?.toLowerCase().trim() === 'alm 05' ||
          a.nombre?.toLowerCase().includes('pañol 3')
        ) || null;
      }
      if (stock) {
        this.stock = stock; // Asignar el stock normal
      }
      
      // Cargar equipos especiales del cementerio y almacén laboratorio
      this.cargarEquiposEspeciales();
    }).catch(error => {
      console.error('Error al cargar datos:', error);
      this.error = 'Error al cargar los datos';
      this.loading = false;
    });
  }

  cargarEquiposEspeciales(): void {
    forkJoin({
      equiposBaja: this.estadoEquipoService.getEquiposEnBaja(),
      dispositivosBaja: this.estadoDispositivoService.getDispositivosEnBaja(),
      equiposAlmacen: this.estadoEquipoService.getEquiposEnAlmacen(),
      dispositivosAlmacen: this.estadoDispositivoService.getDispositivosEnAlmacen(),
      hardware: this.hardwareService.getHardware(),
      bios: this.biosService.getAllBios(),
      networkInfo: this.networkInfoService.getNetworkInfo()
    }).subscribe({
      next: (response) => {
        const items: any[] = [];
        
        // IDs de almacenes especiales para filtrar
        const almacenCementerioId = this.almacenCementerio?.id;
        const almacenLaboratorioId = this.almacenLaboratorio?.id;

        // Convertir equipos del cementerio a formato StockAlmacen
        if (this.almacenCementerio) {
          const itemsCementerio = this.convertirEquiposAStock(
            response.equiposBaja,
            response.dispositivosBaja,
            Array.isArray(response.hardware) ? response.hardware : [],
            Array.isArray(response.bios) ? response.bios : [],
            response.networkInfo,
            this.almacenCementerio,
            'CEMENTERIO'
          );
          items.push(...itemsCementerio);
        }

        // Convertir equipos del almacén laboratorio a formato StockAlmacen
        if (this.almacenLaboratorio) {
          // Filtrar equipos del laboratorio (almacenId = almacenLaboratorioId)
          const equiposLab = response.equiposAlmacen?.success && Array.isArray(response.equiposAlmacen.data)
            ? response.equiposAlmacen.data.filter((e: any) => e.almacenId === almacenLaboratorioId)
            : [];
          const dispositivosLab = response.dispositivosAlmacen?.success && Array.isArray(response.dispositivosAlmacen.data)
            ? response.dispositivosAlmacen.data.filter((d: any) => d.almacenId === almacenLaboratorioId)
            : [];

          const itemsLaboratorio = this.convertirEquiposAStock(
            { success: true, data: equiposLab },
            { success: true, data: dispositivosLab },
            Array.isArray(response.hardware) ? response.hardware : [],
            Array.isArray(response.bios) ? response.bios : [],
            response.networkInfo,
            this.almacenLaboratorio,
            'ALMACEN'
          );
          items.push(...itemsLaboratorio);
        }

        // Cargar equipos en almacenes regulares (no cementerio ni laboratorio)
        const equiposEnAlmacenes = response.equiposAlmacen?.success && Array.isArray(response.equiposAlmacen.data)
          ? response.equiposAlmacen.data.filter((e: any) => 
              e.almacenId && 
              e.almacenId !== almacenCementerioId && 
              e.almacenId !== almacenLaboratorioId
            )
          : [];
        
        const dispositivosEnAlmacenes = response.dispositivosAlmacen?.success && Array.isArray(response.dispositivosAlmacen.data)
          ? response.dispositivosAlmacen.data.filter((d: any) => 
              d.almacenId && 
              d.almacenId !== almacenCementerioId && 
              d.almacenId !== almacenLaboratorioId
            )
          : [];

        // Agrupar por almacenId y convertir a formato StockAlmacen
        const equiposPorAlmacen = new Map<number, any[]>();
        const dispositivosPorAlmacen = new Map<number, any[]>();

        equiposEnAlmacenes.forEach((estado: any) => {
          if (estado.almacenId) {
            if (!equiposPorAlmacen.has(estado.almacenId)) {
              equiposPorAlmacen.set(estado.almacenId, []);
            }
            equiposPorAlmacen.get(estado.almacenId)!.push(estado);
          }
        });

        dispositivosEnAlmacenes.forEach((estado: any) => {
          if (estado.almacenId) {
            if (!dispositivosPorAlmacen.has(estado.almacenId)) {
              dispositivosPorAlmacen.set(estado.almacenId, []);
            }
            dispositivosPorAlmacen.get(estado.almacenId)!.push(estado);
          }
        });

        // Convertir equipos de cada almacén regular
        equiposPorAlmacen.forEach((equipos, almacenId) => {
          const almacen = this.almacenes.find(a => a.id === almacenId);
          if (almacen) {
            const dispositivos = dispositivosPorAlmacen.get(almacenId) || [];
            const itemsAlmacen = this.convertirEquiposAStock(
              { success: true, data: equipos },
              { success: true, data: dispositivos },
              Array.isArray(response.hardware) ? response.hardware : [],
              Array.isArray(response.bios) ? response.bios : [],
              response.networkInfo,
              almacen,
              'ALMACEN'
            );
            items.push(...itemsAlmacen);
          }
        });

        // Combinar con el stock normal, evitando duplicados por número
        // (cuando se transfiere un equipo, existe en stock_almacen Y en equiposEnAlmacen)
        this.stock = this.mergeSinDuplicadosPorNumero(this.stock, items);
        this.intentarAbrirStockAlmacen1PorDefecto();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar equipos especiales:', error);
        // Si falla, al menos mostrar el stock normal
        this.intentarAbrirStockAlmacen1PorDefecto();
        this.loading = false;
      }
    });
  }

  convertirEquiposAStock(
    equiposResponse: any,
    dispositivosResponse: any,
    hardware: any[],
    bios: any[],
    networkInfo: any,
    almacen: Almacen | null,
    tipo: 'CEMENTERIO' | 'ALMACEN'
  ): any[] {
    if (!almacen) return [];

    const items: any[] = [];
    
    if (!Array.isArray(hardware)) hardware = [];
    if (!Array.isArray(bios)) bios = [];
    
    const biosMap = new Map(bios.map((b: any) => [b.hardwareId, b]));

    // Normalizar el objeto almacen para que tenga la misma estructura que el stock normal
    const almacenNormalizado = {
      id: almacen.id,
      numero: almacen.numero,
      nombre: almacen.nombre
    };

    // Procesar equipos
    if (equiposResponse?.success && Array.isArray(equiposResponse.data)) {
      equiposResponse.data.forEach((estado: any) => {
        const hw = hardware.find((h: any) => h.id === estado.hardwareId);
        if (hw) {
          const biosData = biosMap.get(estado.hardwareId);
          items.push({
            id: `equipo-${estado.hardwareId}-${tipo}`,
            itemId: estado.hardwareId,
            idCompra: null,
            almacen: almacenNormalizado,
            estanteria: 'Equipos',
            estante: tipo === 'CEMENTERIO' ? 'En Baja' : 'En Almacén',
            cantidad: 1,
            numero: hw.name || `EQ-${estado.hardwareId}`,
            descripcion: `${hw.name || 'Equipo'} - ${biosData?.type || 'N/A'} | ${hw.osName || 'N/A'}`,
            fechaRegistro: estado.fechaCambio,
            item: {
              nombreItem: hw.name || `Equipo ${estado.hardwareId}`,
              descripcion: `${biosData?.type || 'N/A'} | ${hw.osName || 'N/A'}`
            },
            esEquipoEspecial: true,
            tipoEquipo: 'EQUIPO',
            estadoInfo: estado
          });
        }
      });
    }

    // Procesar dispositivos
    if (dispositivosResponse?.success && Array.isArray(dispositivosResponse.data) && 
        networkInfo?.success && Array.isArray(networkInfo.data)) {
      const networkInfoMap = new Map(
        networkInfo.data.map((device: any) => [device.mac, device])
      );

      dispositivosResponse.data.forEach((estado: any) => {
        const device: any = networkInfoMap.get(estado.mac);
        if (device) {
          items.push({
            id: `dispositivo-${estado.mac}-${tipo}`,
            itemId: null,
            idCompra: null,
            almacen: almacenNormalizado,
            estanteria: 'Dispositivos',
            estante: tipo === 'CEMENTERIO' ? 'En Baja' : 'En Almacén',
            cantidad: 1,
            numero: device.mac,
            descripcion: `${device.name || device.mac} - ${device.type || 'N/A'}`,
            fechaRegistro: estado.fechaCambio,
            item: {
              nombreItem: device.name || device.mac,
              descripcion: `${device.type || 'N/A'} | ${device.description || 'Sin descripción'}`
            },
            esEquipoEspecial: true,
            tipoEquipo: 'DISPOSITIVO',
            estadoInfo: estado
          });
        }
      });
    }

    return items;
  }

  abrirModalAlmacen(modal: any, almacen?: Almacen): void {
    this.almacenModalValidacion = null;
    this.modoEdicion = !!almacen;
    this.almacenSeleccionado = almacen || null;

    if (this.modoEdicion && almacen) {
      this.almacenForm.patchValue({
        numero: almacen.numero,
        nombre: almacen.nombre
      });
    } else {
      this.almacenForm.reset();
    }

    this.modalService.open(modal, {
      size: 'lg',
      windowClass: 'almacen-form-modal-window'
    });
  }

  guardarAlmacen(): void {
    if (!this.almacenForm.valid) {
      this.almacenForm.markAllAsTouched();
      const lineas = this.armarLineasValidacionAlmacen();
      this.almacenModalValidacion = {
        titulo: 'Revisá el formulario antes de guardar',
        lineas: lineas.length > 0 ? lineas : ['Completá los campos obligatorios.'],
        esError: false
      };
      return;
    }

    const formData = this.almacenForm.value;
    this.almacenModalValidacion = null;

    if (this.modoEdicion && this.almacenSeleccionado) {
      const almacenActualizado: Almacen = {
        ...this.almacenSeleccionado,
        numero: formData.numero,
        nombre: formData.nombre
      };

      this.almacenService.updateAlmacen(this.almacenSeleccionado.id, almacenActualizado).subscribe({
        next: () => {
          this.modalService.dismissAll();
          this.cargarDatos();
        },
        error: (error) => {
          console.error('Error al actualizar almacén:', error);
          this.almacenModalValidacion = {
            titulo: 'Error al actualizar el almacén',
            lineas: [this.mensajeErrorHttp(error)],
            esError: true
          };
        }
      });
    } else {
      const nuevoAlmacen: Omit<Almacen, 'id'> = {
        numero: formData.numero,
        nombre: formData.nombre
      };

      this.almacenService.createAlmacen(nuevoAlmacen).subscribe({
        next: () => {
          this.modalService.dismissAll();
          this.cargarDatos();
        },
        error: (error) => {
          console.error('Error al crear almacén:', error);
          this.almacenModalValidacion = {
            titulo: 'Error al crear el almacén',
            lineas: [this.mensajeErrorHttp(error)],
            esError: true
          };
        }
      });
    }
  }

  confirmarEliminacion(almacen: Almacen): void {
    this.almacenAEliminar = almacen;
    this.showConfirmDialog = true;
  }

  eliminarAlmacen(): void {
    if (this.almacenAEliminar) {
      this.almacenService.deleteAlmacen(this.almacenAEliminar.id).subscribe({
        next: () => {
          this.showConfirmDialog = false;
          this.almacenAEliminar = null;
          this.cargarDatos();
        },
        error: (error) => {
          console.error('Error al eliminar almacén:', error);
          this.showConfirmDialog = false;
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.almacenAEliminar = null;
  }



  canEditAlmacenes(): boolean {
    // En gestión de almacenes, GM, Admin y Almacén pueden crear/editar.
    return this.permissionsService.canManageWarehouseAssets();
  }

  canDeleteAlmacenes(): boolean {
    // Eliminar almacenes solo para GM/Admin.
    return this.permissionsService.isGMOrAdmin();
  }

  verStockAlmacen(almacen: Almacen): void {
    if (this.almacenStockInline?.id === almacen.id) {
      this.cerrarStockVistaInline();
      return;
    }
    this.almacenStockInline = almacen;
  }

  cerrarStockVistaInline(): void {
    this.omitirAbrirStockPorDefecto = true;
    this.almacenStockInline = null;
    this.cargarDatos();
  }

  /** Tras cargar datos: mostrar stock del almacén con id 1 si existe y no hay otra preferencia. */
  private intentarAbrirStockAlmacen1PorDefecto(): void {
    if (this.omitirAbrirStockPorDefecto) {
      return;
    }
    if (this.almacenStockInline != null) {
      return;
    }
    const alm1 = this.almacenes.find((a) => Number(a.id) === 1);
    if (alm1) {
      this.almacenStockInline = alm1;
    }
  }

  /**
   * Calcula el stock disponible por almacén
   */
  private calcularStockPorAlmacen(stock: any[]): void {
    // Esta función se puede implementar si es necesario para cálculos adicionales
  }

  /**
   * Combina stock existente con nuevos items evitando duplicados.
   * Un item se considera duplicado si ya existe en stock uno con el mismo almacen.id y numero
   * (por ej. cuando un equipo transferido está en stock_almacen Y en equiposEnAlmacen).
   */
  private mergeSinDuplicadosPorNumero(stockActual: any[], nuevosItems: any[]): any[] {
    const clavesExistentes = new Set<string>();
    stockActual.forEach(item => {
      if (item.almacen?.id != null && (item.numero || item.item?.nombreItem)) {
        const num = (item.numero || item.item?.nombreItem || '').toString().trim().toLowerCase();
        if (num) {
          clavesExistentes.add(`${Number(item.almacen.id)}:${num}`);
        }
      }
    });
    const añadidos = nuevosItems.filter(item => {
      if (!item.almacen?.id) return true;
      const num = (item.numero || item.item?.nombreItem || '').toString().trim().toLowerCase();
      if (!num) return true;
      const clave = `${Number(item.almacen.id)}:${num}`;
      return !clavesExistentes.has(clave);
    });
    return [...stockActual, ...añadidos];
  }

  /**
   * Verifica si un almacén tiene stock disponible
   */
  tieneStock(almacenId: number): boolean {
    // Buscar en el stock si hay items para este almacén
    if (!this.stock || !Array.isArray(this.stock)) return false;
    return this.stock.some((item: any) => {
      // Asegurar que el almacen existe y tiene id
      return item.almacen && item.almacen.id === almacenId;
    });
  }

  /**
   * Obtiene el stock disponible de un almacén
   */
  getStockDisponible(almacenId: number): number {
    if (!this.stock || !Array.isArray(this.stock)) return 0;
    return this.stock
      .filter((item: any) => {
        // Asegurar que el almacen existe y tiene id
        return item.almacen && item.almacen.id === almacenId;
      })
      .reduce((total: number, item: any) => total + (item.cantidad || 1), 0);
  }

  actualizarPaginacion(): void {
    this.collectionSize = this.almacenesFiltrados.length;
    this.page = 1;
  }

} 