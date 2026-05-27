import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { UbicacionesService } from '../services/ubicaciones.service';
import { UbicacionDTO } from '../interfaces/ubicacion.interface';
import { SubnetService, SubnetDTO } from '../services/subnet.service';
import { NgbModal, NgbModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { LocationSelectorModalComponent } from '../components/location-selector-modal/location-selector-modal.component';
import { TourRegistryService } from '../services/tour-registry.service';

type UbicacionSortColumn =
  | 'nombreGerencia'
  | 'nombreOficina'
  | 'piso'
  | 'numeroPuerta'
  | 'ciudad'
  | 'departamento'
  | 'direccion'
  | 'interno';

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    NgbPaginationModule
  ],
  templateUrl: './locations.component.html',
  styleUrls: ['./locations.component.css']
})
export class LocationsComponent implements OnInit, OnDestroy {
  ubicaciones: UbicacionDTO[] = [];
  ubicacionesFiltradas: UbicacionDTO[] = [];
  subnets: SubnetDTO[] = [];
  loading = false;
  error: string | null = null;
  showConfirmDialog = false;
  ubicacionToDelete: UbicacionDTO | null = null;

  searchTerm = '';
  page = 1;
  pageSize = 25;
  collectionSize = 0;
  sortColumn: UbicacionSortColumn = 'nombreGerencia';
  sortDirection: 'asc' | 'desc' = 'asc';

  private tourCleanup?: () => void;

  constructor(
    private ubicacionesService: UbicacionesService,
    private subnetService: SubnetService,
    private modalService: NgbModal,
    private tourRegistry: TourRegistryService
  ) {}

  ngOnInit() {
    this.cargarSubnets();
    this.tourCleanup = this.tourRegistry.register('locations', [{
      id: 'locations-overview',
      title: 'Tour de ubicaciones',
      icon: 'fa-route',
      steps: [
        { selector: '#tour-locations-title', title: 'Ubicaciones físicas', description: 'Catálogo jerárquico (gerencia, oficina, piso, puerta) usado en activos y stock.', side: 'bottom' },
        { selector: '#tour-locations-nueva', title: 'Nueva ubicación', description: 'Alta o edición mediante el selector de ubicación y validación de subred asociada si aplica.', side: 'left' },
        { selector: '#tour-locations-search', title: 'Búsqueda', description: 'Filtrá en tiempo real por cualquier dato visible de la ubicación.', side: 'bottom' },
        { selector: '#tour-locations-table', title: 'Listado', description: 'Ordená por columna, navegá con paginación, editá o eliminá ubicaciones.', side: 'top' }
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
        if (result) {
          this.cargarUbicaciones();
        }
      },
      () => {}
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
    this.loading = true;
    this.error = null;

    this.ubicacionesService.getUbicacionesData().subscribe({
      next: (ubicaciones) => {
        this.ubicaciones = ubicaciones;
        this.aplicarFiltrosYOrden();
        this.loading = false;
      },
      error: () => {
        this.error = 'Error al cargar las ubicaciones. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  get pagedUbicaciones(): UbicacionDTO[] {
    const start = (this.page - 1) * this.pageSize;
    return this.ubicacionesFiltradas.slice(start, start + this.pageSize);
  }

  get rangoDesde(): number {
    if (this.collectionSize === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get rangoHasta(): number {
    return Math.min(this.page * this.pageSize, this.collectionSize);
  }

  onSearchTermChange(): void {
    this.page = 1;
    this.aplicarFiltrosYOrden();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchTermChange();
  }

  sortData(column: UbicacionSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.page = 1;
    this.ordenarLista(this.ubicacionesFiltradas);
  }

  getSortIcon(column: UbicacionSortColumn): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  isSortActive(column: UbicacionSortColumn): boolean {
    return this.sortColumn === column;
  }

  private aplicarFiltrosYOrden(): void {
    const term = this.searchTerm.trim().toLowerCase();
    this.ubicacionesFiltradas = term
      ? this.ubicaciones.filter((u) => this.matchesSearch(u, term))
      : [...this.ubicaciones];
    this.ordenarLista(this.ubicacionesFiltradas);
    this.collectionSize = this.ubicacionesFiltradas.length;
    const maxPage = Math.max(1, Math.ceil(this.collectionSize / this.pageSize) || 1);
    if (this.page > maxPage) {
      this.page = maxPage;
    }
  }

  private matchesSearch(u: UbicacionDTO, term: string): boolean {
    const haystack = [
      u.nombreGerencia,
      u.nombreOficina,
      u.piso,
      u.numeroPuerta,
      u.ciudad,
      u.departamento,
      u.direccion,
      u.interno,
      this.getSubnetName(u.idSubnet ?? undefined)
    ]
      .map((v) => (v ?? '').toString().trim().toLowerCase())
      .join(' ');
    return haystack.includes(term);
  }

  private ordenarLista(lista: UbicacionDTO[]): void {
    const col = this.sortColumn;
    const dir = this.sortDirection;
    lista.sort((a, b) => {
      const valA = this.getSortValue(a, col);
      const valB = this.getSortValue(b, col);
      const cmp = valA.localeCompare(valB, 'es', { sensitivity: 'base' });
      return dir === 'asc' ? cmp : -cmp;
    });
  }

  private getSortValue(u: UbicacionDTO, col: UbicacionSortColumn): string {
    return (u[col] ?? '').toString().trim();
  }

  getSubnetName(idSubnet?: number): string {
    return this.subnets.find(s => s.pk === idSubnet)?.name || 'N/A';
  }

  displayValue(value: string | null | undefined): string {
    const v = value?.trim();
    return v ? v : 'N/A';
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
          this.cargarUbicaciones();
        }
      },
      () => {}
    );
  }
}
