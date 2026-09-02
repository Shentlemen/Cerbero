import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PermissionsService } from '../services/permissions.service';
import { AreaPermisoDTO, TicketAreaDTO, TicketAreaService } from '../services/ticket-area.service';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-permisos-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './permisos-admin.component.html',
  styleUrl: './permisos-admin.component.css'
})
export class PermisosAdminComponent implements OnInit {
  areas: TicketAreaDTO[] = [];
  areaId: number | null = null;
  permisos: AreaPermisoDTO[] = [];
  loading = false;
  saving = false;
  error: string | null = null;

  constructor(
    private permissions: PermissionsService,
    private ticketAreaService: TicketAreaService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    if (!this.canManage()) {
      return;
    }
    this.ticketAreaService.listarTodasAdmin().subscribe({
      next: (list) => {
        this.areas = list.filter((a) => a.activa);
        if (this.areas.length > 0) {
          this.areaId = this.areas[0].id;
          this.cargarPermisos();
        }
      },
      error: (err) => { this.error = err?.message || 'No se pudieron cargar las áreas'; }
    });
  }

  canManage(): boolean {
    return this.permissions.canManageAreas();
  }

  grupos(): string[] {
    const seen: string[] = [];
    for (const p of this.permisos) {
      if (!seen.includes(p.grupo)) {
        seen.push(p.grupo);
      }
    }
    return seen;
  }

  permisosDeGrupo(grupo: string): AreaPermisoDTO[] {
    return this.permisos.filter((p) => p.grupo === grupo);
  }

  cargarPermisos(): void {
    if (this.areaId == null) {
      this.permisos = [];
      return;
    }
    this.loading = true;
    this.error = null;
    this.ticketAreaService.listarPermisos(this.areaId).subscribe({
      next: (list) => {
        this.permisos = list;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.message || 'No se pudieron cargar los permisos';
        this.loading = false;
      }
    });
  }

  onVerChange(row: AreaPermisoDTO): void {
    if (!row.puedeVer) {
      row.puedeEditar = false;
      row.puedeEliminar = false;
    }
  }

  onEditarChange(row: AreaPermisoDTO): void {
    if (row.puedeEditar) {
      row.puedeVer = true;
    }
  }

  onEliminarChange(row: AreaPermisoDTO): void {
    if (row.puedeEliminar) {
      row.puedeVer = true;
    }
  }

  guardar(): void {
    if (this.areaId == null) {
      return;
    }
    this.saving = true;
    this.ticketAreaService.guardarPermisos(this.areaId, this.permisos).subscribe({
      next: (list) => {
        this.permisos = list;
        this.saving = false;
        this.notification.showSuccessMessage('Permisos guardados');
      },
      error: (err) => {
        this.saving = false;
        this.notification.showError('Permisos', err?.message || 'No se pudieron guardar');
      }
    });
  }
}
