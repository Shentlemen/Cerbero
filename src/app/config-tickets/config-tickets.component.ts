import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalModule, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { PermissionsService } from '../services/permissions.service';
import { NotificationService } from '../services/notification.service';
import { AreasAdminComponent } from '../configuracion/areas-admin.component';
import { TicketTipoDTO, TicketTipoService } from '../services/ticket-tipo.service';
import { FlujoEditorComponent } from './flujo-editor.component';
import { TourRegistryService } from '../services/tour-registry.service';
import { GuidedTourHostService } from '../services/guided-tour-host.service';

type ConfigTab = 'bandejas' | 'flujos';

@Component({
  selector: 'app-config-tickets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgbModalModule,
    AreasAdminComponent,
    FlujoEditorComponent
  ],
  templateUrl: './config-tickets.component.html',
  styleUrl: './config-tickets.component.css'
})
export class ConfigTicketsComponent implements OnInit, OnDestroy {
  @ViewChild('nuevoTipoModal') nuevoTipoModalTpl!: TemplateRef<unknown>;

  tab: ConfigTab = 'flujos';
  tipos: TicketTipoDTO[] = [];
  tiposLoading = false;
  tiposError: string | null = null;
  tipoSeleccionado: TicketTipoDTO | null = null;

  nuevoCodigo = '';
  nuevoNombre = '';
  nuevoDescripcion = '';
  creando = false;
  /** Si el usuario editó el código a mano, no lo autocompletamos desde el nombre. */
  private codigoEditadoManual = false;
  private nuevoTipoModalRef: NgbModalRef | null = null;
  private tourCleanup?: () => void;

  constructor(
    private permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private ticketTipoService: TicketTipoService,
    private modalService: NgbModal,
    private tourRegistry: TourRegistryService,
    private guidedTourHost: GuidedTourHostService
  ) {}

  ngOnInit(): void {
    if (this.canManage()) {
      this.cargarTipos();
    }
    this.tourCleanup = this.tourRegistry.register('config-tickets', [
      {
        id: 'config-tickets-flujos',
        title: 'Tour de flujos',
        icon: 'fa-route',
        run: () => this.runTourFlujos()
      },
      {
        id: 'config-tickets-bandejas',
        title: 'Tour de bandejas',
        icon: 'fa-inbox',
        run: () => this.runTourBandejas()
      }
    ]);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
  }

  private runTourFlujos(): void {
    this.tab = 'flujos';
    window.setTimeout(() => {
      const steps = this.guidedTourHost.buildSteps([
        { selector: '#tour-config-hub-tabs', title: 'Secciones de configuración', description: 'Esta pestaña «Tickets» define tipos, flujos y bandejas. Las demás pestañas son catálogos (ubicaciones, tipos de activo, etc.).', side: 'bottom' },
        { selector: '#tour-config-tickets-title', title: 'Config tickets', description: 'Acá se diseñan los tipos de reclamo y las bandejas extra para usuarios fuera de TI.', side: 'bottom' },
        { selector: '#tour-config-tickets-tabs', title: 'Flujos y bandejas', description: '«Flujos» arma el circuito de cada tipo (botones y estados). «Bandejas» crea áreas asignables a usuarios rol Usuario.', side: 'bottom' },
        { selector: '#tour-config-tickets-tipos', title: 'Tipos de ticket', description: '«Común» no tiene flujo: se gestiona a mano. Los demás tipos se seleccionan para editar o publicar su flujo.', side: 'right' },
        { selector: '#tour-config-tickets-nuevo-tipo', title: 'Nuevo tipo', description: 'Creá un tipo con nombre visible y código interno. Después diseñás su flujo en el editor de la derecha.', side: 'left' },
        { selector: '#tour-config-tickets-editor', title: 'Editor de flujo', description: 'Definí estados y botones del circuito. Hasta publicarlo, el tipo queda en borrador.', side: 'left' }
      ]);
      this.guidedTourHost.startTour(steps);
    }, 80);
  }

  private runTourBandejas(): void {
    this.tab = 'bandejas';
    window.setTimeout(() => {
      const steps = this.guidedTourHost.buildSteps([
        { selector: '#tour-config-tickets-tabs', title: 'Bandejas', description: 'Además de las bandejas fijas de TI (almacén, inventario, etc.), acá creás áreas extra para otros sectores.', side: 'bottom' },
        { selector: '#tour-config-tickets-bandejas', title: 'Áreas configurables', description: 'Código y nombre de la bandeja. Los usuarios rol Usuario pueden tener una asignada en Gestión de usuarios. Las áreas de TI no se eliminan desde aquí.', side: 'top' }
      ]);
      this.guidedTourHost.startTour(steps);
    }, 80);
  }

  canManage(): boolean {
    return this.permissionsService.canManageTicketBandejas();
  }

  canManageAreas(): boolean {
    return this.permissionsService.isGM();
  }

  setTab(tab: ConfigTab): void {
    this.tab = tab;
    if (tab === 'flujos' && this.tipos.length === 0) {
      this.cargarTipos();
    }
  }

  cargarTipos(): void {
    this.tiposLoading = true;
    this.tiposError = null;
    this.ticketTipoService.listarTodosAdmin().subscribe({
      next: (list) => {
        this.tipos = list;
        this.tiposLoading = false;
        if (this.tipoSeleccionado) {
          this.tipoSeleccionado = list.find((t) => t.id === this.tipoSeleccionado!.id) || null;
        }
        if (!this.tipoSeleccionado) {
          this.tipoSeleccionado = list.find((t) => !t.esComun) || list[0] || null;
        }
      },
      error: (err: Error) => {
        this.tiposError = err.message || 'No se pudieron cargar los tipos';
        this.tiposLoading = false;
      }
    });
  }

  seleccionarTipo(tipo: TicketTipoDTO): void {
    this.tipoSeleccionado = tipo;
  }

  abrirModalNuevoTipo(): void {
    this.nuevoCodigo = '';
    this.nuevoNombre = '';
    this.nuevoDescripcion = '';
    this.codigoEditadoManual = false;
    this.nuevoTipoModalRef = this.modalService.open(this.nuevoTipoModalTpl, {
      centered: true,
      backdrop: 'static',
      size: 'md'
    });
  }

  cerrarModalNuevoTipo(): void {
    this.nuevoTipoModalRef?.dismiss();
    this.nuevoTipoModalRef = null;
  }

  esNuevoTipoValido(): boolean {
    return this.nuevoCodigo.trim().length > 0 && this.nuevoNombre.trim().length > 0;
  }

  crearTipo(): void {
    const codigo = this.nuevoCodigo.trim();
    const nombre = this.nuevoNombre.trim();
    if (!codigo || !nombre) {
      this.notificationService.showError('Datos incompletos', 'Ingresá nombre y código del tipo.');
      return;
    }
    this.creando = true;
    this.ticketTipoService.crear(codigo, nombre, this.nuevoDescripcion.trim() || undefined).subscribe({
      next: (tipo) => {
        this.creando = false;
        this.nuevoCodigo = '';
        this.nuevoNombre = '';
        this.nuevoDescripcion = '';
        this.codigoEditadoManual = false;
        this.cerrarModalNuevoTipo();
        this.notificationService.showSuccessMessage('Tipo creado.');
        this.cargarTipos();
        this.tipoSeleccionado = tipo;
      },
      error: (err: Error) => {
        this.creando = false;
        this.notificationService.showError('Error', err.message);
      }
    });
  }

  onNombreNuevoChange(nombre: string): void {
    this.nuevoNombre = nombre;
    if (!this.codigoEditadoManual) {
      this.nuevoCodigo = this.sugerirCodigoDesdeNombre(nombre);
    }
  }

  onCodigoNuevoChange(codigo: string): void {
    this.nuevoCodigo = codigo;
    this.codigoEditadoManual = codigo.trim().length > 0;
  }

  /** Clave interna única (sin tildes/espacios), no es el nombre visible. */
  private sugerirCodigoDesdeNombre(nombre: string): string {
    return nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40);
  }

  toggleActivo(tipo: TicketTipoDTO): void {
    if (tipo.esComun) {
      return;
    }
    this.ticketTipoService.actualizar(tipo.id, { activo: !tipo.activo }).subscribe({
      next: () => {
        this.notificationService.showSuccessMessage(tipo.activo ? 'Tipo desactivado.' : 'Tipo activado.');
        this.cargarTipos();
      },
      error: (err: Error) => this.notificationService.showError('Error', err.message)
    });
  }

  onFlujoPublicado(tipo: TicketTipoDTO): void {
    this.cargarTipos();
    this.tipoSeleccionado = tipo;
  }
}
