import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { NotificationService } from '../services/notification.service';
import { PermissionsService } from '../services/permissions.service';
import { TicketPrioridad, TicketsService } from '../services/tickets.service';

@Component({
  selector: 'app-ticket-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NotificationContainerComponent],
  templateUrl: './ticket-create.component.html',
  styleUrls: ['./ticket-create.component.css']
})
export class TicketCreateComponent implements OnInit {
  creando = false;

  form = {
    titulo: '',
    descripcion: '',
    areaDestino: '',
    prioridad: 'MEDIA' as TicketPrioridad,
    nota: ''
  };

  readonly areas = ['ALMACEN', 'INVENTARIO', 'COMPRAS', 'GESTION_EQUIP', 'IMPRESION', 'GARANTIA'];
  readonly prioridades: TicketPrioridad[] = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];

  constructor(
    private ticketsService: TicketsService,
    private notificationService: NotificationService,
    private router: Router,
    private permissionsService: PermissionsService
  ) {}

  ngOnInit(): void {
    if (!this.permissionsService.canCreateTickets()) {
      this.notificationService.showError('Sin permisos', 'No tenés permisos para crear tickets.');
      this.router.navigate(['/menu/tickets']);
    }
  }

  guardar(): void {
    if (!this.form.titulo.trim() || !this.form.descripcion.trim() || !this.form.areaDestino) {
      this.notificationService.showWarning('Campos requeridos', 'Completá título, descripción y área destino.');
      return;
    }

    this.creando = true;
    this.ticketsService.crear({
      titulo: this.form.titulo.trim(),
      descripcion: this.form.descripcion.trim(),
      areaDestino: this.form.areaDestino,
      prioridad: this.form.prioridad,
      nota: this.form.nota.trim() || undefined
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.showSuccessMessage(`Ticket ${response.data.codigo} creado correctamente.`);
          this.router.navigate(['/menu/tickets', response.data.id]);
        } else {
          this.notificationService.showError('Error', response.message || 'No se pudo crear el ticket.');
        }
      },
      error: (error) => {
        this.notificationService.showError('Error', error?.error?.message || 'No se pudo crear el ticket.');
      },
      complete: () => {
        this.creando = false;
      }
    });
  }
}

