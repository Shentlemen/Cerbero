import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UbicacionesService, Ubicacion } from '../services/ubicaciones.service';
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
  ubicaciones: Ubicacion[] = [];
  subnets: SubnetDTO[] = [];
  loading: boolean = false;
  error: string | null = null;
  showConfirmDialog = false;
  ubicacionToDelete: Ubicacion | null = null;

  constructor(
    private ubicacionesService: UbicacionesService,
    private subnetService: SubnetService,
    private modalService: NgbModal
  ) {}

  ngOnInit() {
    console.log('Iniciando componente LocationsComponent');
    this.cargarSubnets();
    this.cargarUbicaciones();
  }

  openNewLocationModal() {
    const modalRef = this.modalService.open(LocationSelectorModalComponent, { 
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });
    
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
    
    this.ubicacionesService.getUbicaciones().subscribe({
      next: (ubicaciones) => {
        console.log('Ubicaciones recibidas del servidor:', ubicaciones);
        if (Array.isArray(ubicaciones)) {
          this.ubicaciones = ubicaciones.map(ubicacion => ({
            ...ubicacion,
            subnet: this.subnets.find(s => s.pk === ubicacion.idSubnet)?.name || 'N/A'
          }));
          console.log('Número de ubicaciones cargadas:', ubicaciones.length);
        } else {
          console.error('La respuesta no es un array:', ubicaciones);
          this.error = 'Error en el formato de datos recibidos';
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar ubicaciones:', error);
        if (error.status) {
          console.error('Status del error:', error.status);
        }
        if (error.message) {
          console.error('Mensaje del error:', error.message);
        }
        this.error = 'Error al cargar las ubicaciones. Por favor, intente nuevamente.';
        this.loading = false;
      },
      complete: () => {
        console.log('Carga de ubicaciones completada');
        this.loading = false;
      }
    });
  }

  getSubnetName(idSubnet?: number): string {
    return this.subnets.find(s => s.pk === idSubnet)?.name || 'N/A';
  }

  confirmarEliminar(ubicacion: Ubicacion) {
    this.ubicacionToDelete = ubicacion;
    this.showConfirmDialog = true;
  }

  confirmarEliminacion(): void {
    if (this.ubicacionToDelete?.idUbicacion) {
      this.loading = true;
      this.ubicacionesService.eliminarUbicacion(this.ubicacionToDelete.idUbicacion).subscribe({
        next: () => {
          console.log('Ubicación eliminada exitosamente');
          this.cargarUbicaciones();
          this.showConfirmDialog = false;
          this.ubicacionToDelete = null;
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

  editarUbicacion(ubicacion: Ubicacion) {
    const modalRef = this.modalService.open(LocationSelectorModalComponent, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });

    // Pasar la ubicación al modal para edición
    modalRef.componentInstance.ubicacion = ubicacion;
    
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