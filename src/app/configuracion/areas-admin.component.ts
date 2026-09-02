import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { PermissionsService } from '../services/permissions.service';
import { TicketAreaDTO, TicketAreaService } from '../services/ticket-area.service';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-areas-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModalModule],
  templateUrl: './areas-admin.component.html',
  styleUrl: './areas-admin.component.css'
})
export class AreasAdminComponent implements OnInit {
  areas: TicketAreaDTO[] = [];
  loading = false;
  error: string | null = null;
  guardando = false;
  nuevaCodigo = '';
  nuevaNombre = '';
  nuevaColor = '#64748b';
  areaEliminar: TicketAreaDTO | null = null;

  constructor(
    private permissions: PermissionsService,
    private ticketAreaService: TicketAreaService,
    private notification: NotificationService,
    private modal: NgbModal
  ) {}

  ngOnInit(): void {
    if (this.canManage()) {
      this.cargar();
    }
  }

  canManage(): boolean {
    return this.permissions.canManageAreas();
  }

  cargar(): void {
    this.loading = true;
    this.error = null;
    this.ticketAreaService.listarTodasAdmin().subscribe({
      next: (list) => {
        this.areas = list;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.message || 'No se pudieron cargar las áreas';
        this.loading = false;
      }
    });
  }

  crear(): void {
    const codigo = this.nuevaCodigo.trim();
    const nombre = this.nuevaNombre.trim();
    if (!codigo || !nombre) {
      this.notification.showError('Áreas', 'Completá código y nombre.');
      return;
    }
    this.guardando = true;
    this.ticketAreaService.crear(codigo, nombre, this.nuevaColor).subscribe({
      next: () => {
        this.nuevaCodigo = '';
        this.nuevaNombre = '';
        this.guardando = false;
        this.notification.showSuccessMessage('Área creada');
        this.cargar();
        this.ticketAreaService.refreshAreasActivas().subscribe();
      },
      error: (err) => {
        this.guardando = false;
        this.notification.showError('Áreas', err?.message || 'No se pudo crear');
      }
    });
  }

  toggleActiva(area: TicketAreaDTO): void {
    this.ticketAreaService.actualizar(area.id, { activa: !area.activa }).subscribe({
      next: () => this.cargar(),
      error: (err) => this.notification.showError('Áreas', err?.message || 'No se pudo actualizar')
    });
  }

  guardarNombre(area: TicketAreaDTO): void {
    this.ticketAreaService.actualizar(area.id, { nombre: area.nombre, color: area.color }).subscribe({
      next: () => this.notification.showSuccessMessage('Área actualizada'),
      error: (err) => this.notification.showError('Áreas', err?.message || 'No se pudo actualizar')
    });
  }

  abrirEliminar(area: TicketAreaDTO, tpl: unknown): void {
    this.areaEliminar = area;
    this.modal.open(tpl, { centered: true, size: 'md' });
  }

  confirmarEliminar(modal: { close: (r?: string) => void }): void {
    if (!this.areaEliminar) {
      return;
    }
    const id = this.areaEliminar.id;
    this.ticketAreaService.eliminar(id).subscribe({
      next: () => {
        modal.close();
        this.areaEliminar = null;
        this.notification.showSuccessMessage('Área eliminada');
        this.cargar();
        this.ticketAreaService.refreshAreasActivas().subscribe();
      },
      error: (err) => this.notification.showError('Áreas', err?.message || 'No se pudo eliminar')
    });
  }
}
