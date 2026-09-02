import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';
import { StockAlmacenComponent } from '../stock-almacen/stock-almacen.component';
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
    RouterLink,
    NotificationContainerComponent,
    StockAlmacenComponent
  ],
  templateUrl: './almacenes.component.html',
  styleUrls: ['./almacenes.component.css']
})
export class AlmacenesComponent implements OnInit, OnDestroy {
  almacenes: Almacen[] = [];
  loading = false;
  error: string | null = null;
  almacenStockInline: Almacen | null = null;

  private tourCleanup?: () => void;
  private pageTour?: Driver;
  private tourDemoStockModalRef?: import('@ng-bootstrap/ng-bootstrap').NgbModalRef;
  private tourRegistrarStock?: Driver;

  constructor(
    private almacenService: AlmacenService,
    private modalService: NgbModal,
    public permissionsService: PermissionsService,
    private tourRegistry: TourRegistryService,
    private guidedTourHost: GuidedTourHostService
  ) {}

  ngOnInit(): void {
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

  private runTourAlmacenes(): void {
    this.pageTour?.destroy();
    this.pageTour = undefined;

    const pasosCabecera: GuidedTourStepDef[] = [
      { selector: '#tour-almacenes-title', title: 'Almacenes',
        description: 'Acá ves el stock de cada depósito. El alta, edición y baja de almacenes se hace en <strong>Configuración de almacén</strong>.', side: 'bottom' },
      { selector: '#tour-almacenes-cards', title: 'Pestañas de almacenes',
        description: 'Cada pestaña es un depósito (código y nombre). Hacé clic para ver su stock, planta y ubicaciones debajo.', side: 'top' }
    ];

    const almacenParaTour = this.elegirAlmacenParaTour();
    if (almacenParaTour && this.almacenStockInline?.id !== almacenParaTour.id) {
      this.almacenStockInline = almacenParaTour;
    }

    const pasosStock: GuidedTourStepDef[] = [
      { selector: '#tour-stock-almacen-title', title: 'Stock del almacén',
        description: 'Al abrir el panel ves el <strong>stock incrustado</strong> del almacén elegido. Desde acá registrás entradas/salidas y movimientos internos sin perder la lista de almacenes de arriba.', side: 'bottom' },
      { selector: '#tour-stock-almacen-toolbar', title: 'Búsqueda y acciones',
        description: 'Buscá por <strong>ítem, número, descripción o estantería</strong> y usá las acciones del toolbar (alta, importar, exportar, etc.) según tus permisos.', side: 'bottom' },
      { selector: '.registrar-stock-btn', title: 'Registrar stock',
        description: 'Abre el modal de <strong>alta de stock</strong> con el almacén actual ya seleccionado. Podés asociar la entrada a una compra y un ítem de esa compra, o registrar un equipo identificado por número/descripción.', side: 'bottom' },
      { selector: '#tour-almacenes-bulk-transfer', title: 'Transferir en masa',
        description: 'Mové <strong>varios equipos</strong> a otro almacén. Pegá números separados por espacio (14506 14530) y usá <strong>Seleccionar todo</strong> para tildar los que coincidan.', side: 'bottom' },
      { selector: '#tour-almacenes-bulk-reactivar', title: 'Reactivar en masa',
        description: 'Devolvé varios equipos o dispositivos a inventario activo. <strong>Seleccionar todo</strong> marca lo del almacén actual.', side: 'bottom' },
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
      this.esperarSelectores(
        ['#tour-stock-almacen-title', '#tour-stock-almacen-toolbar', '#tour-stock-almacen-listado'],
        2500
      ).then(() => lanzar());
    } else {
      lanzar();
    }
  }

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

  private finalizarTourRegistrarStock(): void {
    this.tourRegistrarStock?.destroy();
    this.tourRegistrarStock = undefined;
    this.tourDemoStockModalRef = undefined;
  }

  private elegirAlmacenParaTour(): Almacen | null {
    if (!this.almacenes.length) {
      return null;
    }
    return this.almacenes.find((a) => Number(a.id) === 1) ?? this.almacenes[0] ?? null;
  }

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
    this.almacenService.getAllAlmacenes().subscribe({
      next: (almacenes) => {
        this.almacenes = almacenes || [];
        this.intentarAbrirStockAlmacen1PorDefecto();
        this.loading = false;
      },
      error: () => {
        this.error = 'Error al cargar los datos';
        this.loading = false;
      }
    });
  }

  verStockAlmacen(almacen: Almacen): void {
    this.almacenStockInline = almacen;
  }

  private intentarAbrirStockAlmacen1PorDefecto(): void {
    if (this.almacenStockInline != null) {
      return;
    }
    const alm1 = this.almacenes.find((a) => Number(a.id) === 1);
    this.almacenStockInline = alm1 ?? this.almacenes[0] ?? null;
  }
}
