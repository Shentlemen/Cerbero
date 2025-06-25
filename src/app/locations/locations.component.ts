import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UbicacionesService } from '../services/ubicaciones.service';
import { UbicacionDTO } from '../interfaces/ubicacion.interface';
import { SubnetService, SubnetDTO } from '../services/subnet.service';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { LocationSelectorModalComponent } from '../components/location-selector-modal/location-selector-modal.component';

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
export class LocationsComponent implements OnInit {
  ubicaciones: UbicacionDTO[] = [];
  subnets: SubnetDTO[] = [];
  loading: boolean = false;
  error: string | null = null;
  showConfirmDialog = false;
  ubicacionToDelete: UbicacionDTO | null = null;

  constructor(
    private ubicacionesService: UbicacionesService,
    private subnetService: SubnetService,
    private modalService: NgbModal
  ) {}

  ngOnInit() {
    console.log('Iniciando componente LocationsComponent');
    this.cargarSubnets();
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
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al eliminar la ubicación:', error);
          this.error = 'Error al eliminar la ubicación. Por favor, intente nuevamente.';
          this.loading = false;
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