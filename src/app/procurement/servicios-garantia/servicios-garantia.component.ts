import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ServiciosGarantiaService, ServicioGarantiaDTO } from '../../services/servicios-garantia.service';

@Component({
  selector: 'app-servicios-garantia',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './servicios-garantia.component.html',
  styleUrls: ['./servicios-garantia.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ServiciosGarantiaComponent implements OnInit {
  serviciosList: ServicioGarantiaDTO[] = [];
  serviciosFiltrados: ServicioGarantiaDTO[] = [];
  filterForm: FormGroup;
  servicioForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 11;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;

  constructor(
    private serviciosGarantiaService: ServiciosGarantiaService,
    private fb: FormBuilder,
    private modalService: NgbModal
  ) {
    this.filterForm = this.fb.group({
      nombre: [''],
      RUC: [''],
      nombreComercial: ['']
    });

    this.servicioForm = this.fb.group({
      nombre: ['', Validators.required],
      correoDeContacto: ['', [Validators.required, Validators.email]],
      telefonoDeContacto: ['', Validators.required],
      nombreComercial: ['', Validators.required],
      RUC: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadServiciosGarantia();
  }

  loadServiciosGarantia(): void {
    this.loading = true;
    this.error = null;
    
    this.serviciosGarantiaService.getServiciosGarantia().subscribe({
      next: (servicios) => {
        this.serviciosList = servicios;
        this.serviciosFiltrados = [...this.serviciosList];
        this.collectionSize = this.serviciosFiltrados.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar los servicios de garantía:', error);
        this.error = 'Error al cargar los servicios de garantía. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  get pagedServicios(): ServicioGarantiaDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.serviciosFiltrados.slice(startItem, endItem);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.serviciosFiltrados.sort((a, b) => {
      let valueA = a[column as keyof ServicioGarantiaDTO];
      let valueB = b[column as keyof ServicioGarantiaDTO];

      if (valueA === null || valueA === undefined) valueA = '';
      if (valueB === null || valueB === undefined) valueB = '';

      if (typeof valueA === 'string') valueA = valueA.toLowerCase();
      if (typeof valueB === 'string') valueB = valueB.toLowerCase();

      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  abrirModal(modal: any, servicio?: ServicioGarantiaDTO): void {
    if (servicio) {
      this.modoEdicion = true;
      this.servicioForm.patchValue(servicio);
    } else {
      this.modoEdicion = false;
      this.servicioForm.reset();
    }
    this.modalService.open(modal, { size: 'lg' });
  }

  guardarServicioGarantia(): void {
    if (this.servicioForm.valid) {
      const servicioData = this.servicioForm.value;
      
      if (this.modoEdicion) {
        this.serviciosGarantiaService.actualizarServicioGarantia(servicioData.idServicioGarantia, servicioData).subscribe({
          next: () => {
            this.loadServiciosGarantia();
            this.modalService.dismissAll();
          },
          error: (error) => {
            console.error('Error al actualizar el servicio de garantía:', error);
            this.error = 'Error al actualizar el servicio de garantía. Por favor, intente nuevamente.';
          }
        });
      } else {
        this.serviciosGarantiaService.crearServicioGarantia(servicioData).subscribe({
          next: () => {
            this.loadServiciosGarantia();
            this.modalService.dismissAll();
          },
          error: (error) => {
            console.error('Error al crear el servicio de garantía:', error);
            this.error = 'Error al crear el servicio de garantía. Por favor, intente nuevamente.';
          }
        });
      }
    }
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
    
    this.serviciosFiltrados = this.serviciosList.filter(servicio => {
      let cumpleFiltros = true;

      if (filtros.nombre && servicio.nombre) {
        cumpleFiltros = cumpleFiltros && 
          servicio.nombre.toLowerCase().includes(filtros.nombre.toLowerCase());
      }

      if (filtros.RUC && servicio.RUC) {
        cumpleFiltros = cumpleFiltros && 
          servicio.RUC.toLowerCase().includes(filtros.RUC.toLowerCase());
      }

      if (filtros.nombreComercial && servicio.nombreComercial) {
        cumpleFiltros = cumpleFiltros && 
          servicio.nombreComercial.toLowerCase().includes(filtros.nombreComercial.toLowerCase());
      }

      return cumpleFiltros;
    });

    this.collectionSize = this.serviciosFiltrados.length;
    this.page = 1;
  }

  eliminarServicioGarantia(id: number): void {
    if (confirm('¿Está seguro que desea eliminar este servicio de garantía?')) {
      this.serviciosGarantiaService.eliminarServicioGarantia(id).subscribe({
        next: () => {
          this.loadServiciosGarantia();
        },
        error: (error) => {
          console.error('Error al eliminar el servicio de garantía:', error);
          this.error = 'Error al eliminar el servicio de garantía. Por favor, intente nuevamente.';
        }
      });
    }
  }
} 