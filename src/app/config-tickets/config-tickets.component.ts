import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalModule, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { PermissionsService } from '../services/permissions.service';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { BandejasReclamosComponent } from '../bandejas-reclamos/bandejas-reclamos.component';
import { TicketTipoDTO, TicketTipoService } from '../services/ticket-tipo.service';
import { FlujoEditorComponent } from './flujo-editor.component';

type ConfigTab = 'bandejas' | 'flujos';

@Component({
  selector: 'app-config-tickets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgbModalModule,
    NotificationContainerComponent,
    BandejasReclamosComponent,
    FlujoEditorComponent
  ],
  templateUrl: './config-tickets.component.html',
  styleUrl: './config-tickets.component.css'
})
export class ConfigTicketsComponent implements OnInit {
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

  constructor(
    private permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private ticketTipoService: TicketTipoService,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    if (this.canManage()) {
      this.cargarTipos();
    }
  }

  canManage(): boolean {
    return this.permissionsService.canManageTicketBandejas();
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
