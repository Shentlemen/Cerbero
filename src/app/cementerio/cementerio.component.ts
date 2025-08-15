import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { HardwareService } from '../services/hardware.service';
import { BiosService } from '../services/bios.service';
import { EstadoEquipoService, CambioEstadoRequest, EstadoEquipo } from '../services/estado-equipo.service';
import { PermissionsService } from '../services/permissions.service';
import { NotificationService } from '../services/notification.service';
import { NotificationContainerComponent } from '../components/notification-container/notification-container.component';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-cementerio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, HttpClientModule, NgbPaginationModule, NotificationContainerComponent],
  templateUrl: './cementerio.component.html',
  styleUrls: ['./cementerio.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class CementerioComponent implements OnInit {

  equiposEnBaja: any[] = [];
  equiposFiltrados: any[] = [];
  loading: boolean = true;
  
  // Paginación
  page = 1;
  pageSize = 20;
  collectionSize = 0;

  // Filtro de búsqueda
  nombreEquipoControl = new FormControl('');

  // Reactivación
  showReactivarDialog: boolean = false;
  equipoToReactivar: any = null;
  reactivatingEquipoId: number | null = null;

  constructor(
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private estadoEquipoService: EstadoEquipoService,
    private router: Router,
    private permissionsService: PermissionsService,
    private notificationService: NotificationService
  ) {
    // Suscribirse a cambios en el filtro de nombre
    this.nombreEquipoControl.valueChanges.subscribe(value => {
      this.aplicarFiltroNombre(value || '');
    });
  }

  ngOnInit(): void {
    this.loadEquiposEnBaja();
  }

  loadEquiposEnBaja(): void {
    this.loading = true;
    
    forkJoin([
      this.estadoEquipoService.getEquiposEnBaja(),
      this.hardwareService.getHardware(),
      this.biosService.getAllBios()
    ]).subscribe({
      next: ([estadosResponse, hardwareList, biosList]) => {
        if (estadosResponse.success) {
          const estadosEnBaja: EstadoEquipo[] = estadosResponse.data;
          const biosMap = new Map(biosList.map(b => [b.hardwareId, b]));
          
          // Combinar datos de estado con datos de hardware
          this.equiposEnBaja = estadosEnBaja.map(estado => {
            const hardware = hardwareList.find(h => h.id === estado.hardwareId);
            const bios = biosMap.get(estado.hardwareId);
            
            return {
              ...hardware,
              estadoInfo: estado,
              biosType: (bios?.type || 'DESCONOCIDO').trim().toUpperCase(),
              smanufacturer: bios?.smanufacturer || 'DESCONOCIDO',
              fechaBaja: estado.fechaCambio,
              observaciones: estado.observaciones,
              usuarioCambio: estado.usuarioCambio
            };
          }).filter(equipo => equipo.id); // Filtrar solo equipos que existen en hardware
          
          this.equiposFiltrados = [...this.equiposEnBaja];
          this.actualizarPaginacion();
          this.loading = false;
        } else {
          throw new Error(estadosResponse.message || 'Error al cargar equipos en baja');
        }
      },
      error: (error) => {
        console.error('Error al cargar equipos en baja:', error);
        this.notificationService.showError(
          'Error al cargar datos',
          'No se pudieron cargar los equipos dados de baja: ' + (error.message || 'Error desconocido')
        );
        this.loading = false;
      }
    });
  }

  private aplicarFiltroNombre(nombre: string): void {
    if (!nombre.trim()) {
      this.equiposFiltrados = [...this.equiposEnBaja];
    } else {
      this.equiposFiltrados = this.equiposEnBaja.filter(equipo => 
        equipo.name?.toLowerCase().includes(nombre.toLowerCase())
      );
    }
    this.actualizarPaginacion();
  }

  private actualizarPaginacion(): void {
    this.collectionSize = this.equiposFiltrados.length;
    this.page = 1;
  }

  get pagedEquipos(): any[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.equiposFiltrados.slice(startItem, endItem);
  }

  verDetallesEquipo(equipo: any): void {
    if (equipo && equipo.id) {
      this.router.navigate(['/menu/asset-details', equipo.id]);
    } else {
      console.error('Equipo ID is undefined or null', equipo);
    }
  }

  reactivarEquipo(equipo: any): void {
    this.equipoToReactivar = equipo;
    this.showReactivarDialog = true;
  }

  confirmarReactivacion(): void {
    if (!this.equipoToReactivar) {
      return;
    }

    this.reactivatingEquipoId = this.equipoToReactivar.id;

    const request: CambioEstadoRequest = {
      observaciones: '', // No se requieren observaciones para reactivar
      usuario: 'Usuario' // TODO: Obtener del contexto de autenticación
    };

    // Nota: Esto marca el equipo como activo (baja=false, almacen=false) en estado_equipos
    // Alternativa: usar eliminarEstado() para quitar completamente el registro
    this.estadoEquipoService.reactivarEquipo(this.equipoToReactivar.id, request).subscribe({
      next: (response) => {
        if (response.success) {
          // Eliminar el equipo de las listas locales
          this.equiposEnBaja = this.equiposEnBaja.filter(e => e.id !== this.equipoToReactivar.id);
          this.equiposFiltrados = this.equiposFiltrados.filter(e => e.id !== this.equipoToReactivar.id);
          
          this.actualizarPaginacion();
          
          this.notificationService.showSuccessMessage(
            `Equipo "${this.equipoToReactivar.name}" reactivado exitosamente.`
          );
        } else {
          throw new Error(response.message || 'Error al reactivar el equipo');
        }
      },
      error: (error) => {
        console.error('Error al reactivar equipo:', error);
        this.notificationService.showError(
          'Error al reactivar equipo',
          `No se pudo reactivar el equipo "${this.equipoToReactivar.name}": ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        this.reactivatingEquipoId = null;
        this.showReactivarDialog = false;
        this.equipoToReactivar = null;
      }
    });
  }

  cancelarReactivacion(): void {
    this.showReactivarDialog = false;
    this.equipoToReactivar = null;
    this.reactivatingEquipoId = null;
  }

  canManageAssets(): boolean {
    return this.permissionsService.canManageAssets();
  }

  formatFecha(fecha: string): string {
    if (!fecha) return 'No disponible';
    
    try {
      const date = new Date(fecha);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  }

  getEquipoIcon(biosType: string): string {
    switch (biosType?.toUpperCase()) {
      case 'DESKTOP':
      case 'LOW PROFILE DESKTOP':
        return 'fa-desktop';
      case 'LAPTOP':
      case 'NOTEBOOK':
        return 'fa-laptop';
      case 'MINI PC':
        return 'fa-tablet-alt';
      case 'TOWER':
      case 'MINI TOWER':
        return 'fa-server';
      default:
        return 'fa-question-circle';
    }
  }

  getTypeBadgeClass(biosType: string): string {
    switch (biosType?.toUpperCase()) {
      case 'DESKTOP':
        return 'desktop';
      case 'LAPTOP':
      case 'NOTEBOOK':
        return 'laptop';
      case 'MINI PC':
        return 'mini';
      case 'TOWER':
        return 'tower';
      case 'LOW PROFILE DESKTOP':
        return 'low-profile';
      case 'MINI TOWER':
        return 'mini-tower';
      default:
        return 'desconocido';
    }
  }
} 