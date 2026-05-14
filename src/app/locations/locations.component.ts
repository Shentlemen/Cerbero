import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { UbicacionesService } from '../services/ubicaciones.service';
import { UbicacionDTO } from '../interfaces/ubicacion.interface';
import { SubnetService, SubnetDTO } from '../services/subnet.service';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { LocationSelectorModalComponent } from '../components/location-selector-modal/location-selector-modal.component';
import { TourRegistryService } from '../services/tour-registry.service';

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule
  ],
  templateUrl: './locations.component.html',
  styleUrls: ['./locations.component.css']
})
export class LocationsComponent implements OnInit, OnDestroy {
  ubicaciones: UbicacionDTO[] = [];
  subnets: SubnetDTO[] = [];
  loading: boolean = false;
  error: string | null = null;
  showConfirmDialog = false;
  ubicacionToDelete: UbicacionDTO | null = null;
  private tourCleanup?: () => void;

  constructor(
    private ubicacionesService: UbicacionesService,
    private subnetService: SubnetService,
    private modalService: NgbModal,
    private tourRegistry: TourRegistryService
  ) {}

  ngOnInit() {
    console.log('Iniciando componente LocationsComponent');
    this.cargarSubnets();
    this.tourCleanup = this.tourRegistry.register('locations', [{
      id: 'locations-overview',
      title: 'Tour de ubicaciones',
      icon: 'fa-route',
      steps: [
        { selector: '#tour-locations-title', title: 'Ubicaciones físicas', description: 'Catálogo jerárquico (gerencia, oficina, piso, puerta) usado en activos y stock.', side: 'bottom' },
        { selector: '#tour-locations-nueva', title: 'Nueva ubicación', description: 'Alta o edición mediante el selector de ubicación y validación de subred asociada si aplica.', side: 'left' },
        { selector: '#tour-locations-table', title: 'Listado', description: 'Editá o eliminá ubicaciones; los cambios impactan asignaciones de equipos.', side: 'top' }
      ]
    }]);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
  }

  openNewLocationModal() {
    const modalRef = this.modalService.open(LocationSelectorModalComponent, { 
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });
    
    modalRef.componentInstance.isAssignmentMode = false;
    
    modalRef.result.then(
      (result) => {
        console.log('Modal cerrado con resultado:', result);
        if (result) {
          this.cargarUbicaciones();
        }
      },
      (reason) => {
        console.log('Modal cerrado por:', reason);
      }
    );
  }

  cargarSubnets() {
    this.subnetService.getSubnets().subscribe({
      next: (subnets) => {
        this.subnets = subnets;
        this.cargarUbicaciones();
      },
      error: (error) => console.error('Error al cargar subnets:', error)
    });
  }

  cargarUbicaciones() {
    console.log('Iniciando carga de ubicaciones...');
    this.loading = true;
    this.error = null;
    
    this.ubicacionesService.getUbicacionesData().subscribe({
      next: (ubicaciones) => {
        console.log('Ubicaciones recibidas del servidor:', ubicaciones);
        this.ubicaciones = ubicaciones;
        console.log('Número de ubicaciones cargadas:', ubicaciones.length);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar ubicaciones:', error);
        this.error = 'Error al cargar las ubicaciones. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  getSubnetName(idSubnet?: number): string {
    return this.subnets.find(s => s.pk === idSubnet)?.name || 'N/A';
  }

  confirmarEliminar(ubicacion: UbicacionDTO) {
    this.ubicacionToDelete = ubicacion;
    this.showConfirmDialog = true;
  }

  confirmarEliminacion(): void {
    if (this.ubicacionToDelete?.id) {
      this.loading = true;
      this.ubicacionesService.eliminarUbicacionData(this.ubicacionToDelete.id).subscribe({
        next: (response) => {
          if (response.success) {
            console.log('Ubicación eliminada exitosamente');
            this.cargarUbicaciones();
            this.showConfirmDialog = false;
            this.ubicacionToDelete = null;
          } else {
            this.error = response.message || 'Error al eliminar la ubicación';
            this.showConfirmDialog = false;
            this.ubicacionToDelete = null;
          }
          this.loading = false;
        },
        error: (error: HttpErrorResponse) => {
          console.error('Error al eliminar la ubicación:', error);
          const body = error.error as { message?: string } | string | null | undefined;
          const serverMsg =
            typeof body === 'string'
              ? body
              : typeof body?.message === 'string'
                ? body.message.trim()
                : '';
          this.error =
            serverMsg || 'Error al eliminar la ubicación. Por favor, intente nuevamente.';
          this.loading = false;
          this.showConfirmDialog = false;
          this.ubicacionToDelete = null;
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.ubicacionToDelete = null;
  }

  editarUbicacion(ubicacion: UbicacionDTO) {
    const modalRef = this.modalService.open(LocationSelectorModalComponent, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });

    modalRef.componentInstance.ubicacion = ubicacion;
    modalRef.componentInstance.isAssignmentMode = false;
    
    modalRef.result.then(
      (result) => {
        if (result) {
          console.log('Ubicación actualizada exitosamente');
          this.cargarUbicaciones();
        }
      },
      (reason) => {
        console.log('Modal cerrado por:', reason);
      }
    );
  }

} 