import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { PermissionsService } from '../services/permissions.service';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { TicketAreaService, TicketAreaDTO } from '../services/ticket-area.service';

@Component({
  selector: 'app-bandejas-reclamos',
  standalone: true,
  imports: [CommonModule, NgbModule, NotificationContainerComponent, FormsModule],
  templateUrl: './bandejas-reclamos.component.html',
  styleUrl: './bandejas-reclamos.component.css'
})
export class BandejasReclamosComponent implements OnInit {
  /** Cuando está dentro de Config tickets, oculta el layout de página completo. */
  @Input() embedded = false;

  bandejasTicket: TicketAreaDTO[] = [];
  bandejasLoading = false;
  bandejasError: string | null = null;
  bandejaNuevaCodigo = '';
  bandejaNuevaNombre = '';
  bandejaGuardando = false;
  bandejaEliminar: TicketAreaDTO | null = null;

  constructor(
    private modalService: NgbModal,
    private permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private ticketAreaService: TicketAreaService
  ) {}

  ngOnInit(): void {
    if (this.canManage()) {
      this.cargarBandejasTicket();
    }
  }

  canManage(): boolean {
    return this.permissionsService.canManageTicketBandejas();
  }

  cargarBandejasTicket(): void {
    this.bandejasLoading = true;
    this.bandejasError = null;
    this.ticketAreaService.listarTodasAdmin().subscribe({
      next: (list) => {
        this.bandejasTicket = list;
        this.bandejasLoading = false;
      },
      error: (err: Error) => {
        this.bandejasError = err.message || 'No se pudieron cargar las bandejas';
        this.bandejasLoading = false;
      }
    });
  }

  esBandejaConfigurable(area: TicketAreaDTO): boolean {
  esBandejaConfigurable(area: TicketAreaDTO): boolean {
    return !area.sistema;
  }
  }

  crearBandejaTicket(): void {
    const codigo = this.bandejaNuevaCodigo.trim();
    const nombre = this.bandejaNuevaNombre.trim();
    if (!codigo || !nombre) {
      this.notificationService.showError('Datos incompletos', 'Ingresá código y nombre de la bandeja.');
      return;
    }
    this.bandejaGuardando = true;
    this.ticketAreaService.crear(codigo, nombre).subscribe({
      next: () => {
        this.bandejaNuevaCodigo = '';
        this.bandejaNuevaNombre = '';
        this.bandejaGuardando = false;
        this.notificationService.showSuccessMessage('Bandeja creada.');
        this.cargarBandejasTicket();
        this.ticketAreaService.refreshAreasActivas().subscribe();
      },
      error: (err: Error) => {
        this.bandejaGuardando = false;
        this.notificationService.showError('Error', err.message);
      }
    });
  }

  toggleBandejaActiva(area: TicketAreaDTO): void {
    this.ticketAreaService.actualizar(area.id, { activa: !area.activa }).subscribe({
      next: () => {
        this.notificationService.showSuccessMessage(area.activa ? 'Bandeja desactivada.' : 'Bandeja activada.');
        this.cargarBandejasTicket();
        this.ticketAreaService.refreshAreasActivas().subscribe();
      },
      error: (err: Error) => this.notificationService.showError('Error', err.message)
    });
  }

  confirmarEliminarBandeja(area: TicketAreaDTO, modal: { close: (r: string) => void }): void {
    if (!this.esBandejaConfigurable(area)) {
      return;
    }
    this.ticketAreaService.eliminar(area.id).subscribe({
      next: () => {
        modal.close('ok');
        this.notificationService.showSuccessMessage('Bandeja eliminada. Se borraron los tickets en esa bandeja.');
        this.cargarBandejasTicket();
        this.ticketAreaService.refreshAreasActivas().subscribe();
      },
      error: (err: Error) => this.notificationService.showError('Error', err.message)
    });
  }

  abrirConfirmEliminarBandeja(area: TicketAreaDTO, tpl: unknown): void {
    if (!this.esBandejaConfigurable(area)) {
      this.notificationService.showError('No permitido', 'Las bandejas de TI del sistema no se pueden eliminar.');
      return;
    }
    this.bandejaEliminar = area;
    this.modalService.open(tpl, { centered: true }).result.then(
      () => { this.bandejaEliminar = null; },
      () => { this.bandejaEliminar = null; }
    );
  }
}
