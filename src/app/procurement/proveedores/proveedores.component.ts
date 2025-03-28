import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProveedoresService, ProveedorDTO } from '../../services/proveedores.service';

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './proveedores.component.html',
  styleUrls: ['./proveedores.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ProveedoresComponent implements OnInit {
  proveedoresList: ProveedorDTO[] = [];
  proveedoresFiltrados: ProveedorDTO[] = [];
  filterForm: FormGroup;
  proveedorForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 11;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  proveedorSeleccionado: ProveedorDTO | null = null;

  constructor(
    private proveedoresService: ProveedoresService,
    private fb: FormBuilder,
    private modalService: NgbModal
  ) {
    this.filterForm = this.fb.group({
      nombre: [''],
      RUC: [''],
      nombreComercial: ['']
    });

    this.proveedorForm = this.fb.group({
      nombre: ['', [Validators.required]],
      correoContacto: ['', [Validators.required, Validators.email]],
      telefonoContacto: ['', [Validators.required, Validators.pattern('^[0-9]{9}$')]],
      nombreComercial: ['', [Validators.required]],
      RUC: ['', [Validators.required, Validators.pattern('^[0-9]{11}$')]]
    });
  }

  ngOnInit(): void {
    this.loadProveedores();
  }

  loadProveedores(): void {
    this.loading = true;
    this.error = null;
    
    this.proveedoresService.getProveedores().subscribe({
      next: (proveedores) => {
        this.proveedoresList = proveedores;
        this.proveedoresFiltrados = [...this.proveedoresList];
        this.collectionSize = this.proveedoresFiltrados.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar los proveedores:', error);
        this.error = 'Error al cargar los proveedores. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  get pagedProveedores(): ProveedorDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.proveedoresFiltrados.slice(startItem, endItem);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.proveedoresFiltrados.sort((a, b) => {
      let valueA = a[column as keyof ProveedorDTO];
      let valueB = b[column as keyof ProveedorDTO];

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

  abrirModal(modal: any, proveedor?: ProveedorDTO): void {
    if (proveedor) {
      this.modoEdicion = true;
      this.proveedorSeleccionado = proveedor;
      this.proveedorForm.patchValue(proveedor);
    } else {
      this.modoEdicion = false;
      this.proveedorSeleccionado = null;
      this.proveedorForm.reset();
    }
    this.modalService.open(modal, { size: 'lg' });
  }

  guardarProveedor(): void {
    if (this.proveedorForm.valid) {
      const proveedorData = this.proveedorForm.value;
      
      if (this.modoEdicion && this.proveedorSeleccionado) {
        const proveedorActualizado: ProveedorDTO = {
          ...proveedorData,
          idProveedores: this.proveedorSeleccionado.idProveedores
        };
        
        this.proveedoresService.actualizarProveedor(this.proveedorSeleccionado.idProveedores, proveedorActualizado).subscribe({
          next: (mensaje) => {
            console.log(mensaje);
            this.loadProveedores();
            this.modalService.dismissAll();
          },
          error: (error) => {
            console.error('Error al actualizar el proveedor:', error);
            this.error = 'Error al actualizar el proveedor. Por favor, intente nuevamente.';
          }
        });
      } else {
        this.proveedoresService.crearProveedor(proveedorData).subscribe({
          next: (mensaje) => {
            console.log(mensaje);
            this.loadProveedores();
            this.modalService.dismissAll();
          },
          error: (error) => {
            console.error('Error al crear el proveedor:', error);
            this.error = 'Error al crear el proveedor. Por favor, intente nuevamente.';
          }
        });
      }
    }
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
    
    this.proveedoresFiltrados = this.proveedoresList.filter(proveedor => {
      let cumpleFiltros = true;

      if (filtros.nombre && proveedor.nombre) {
        cumpleFiltros = cumpleFiltros && 
          proveedor.nombre.toLowerCase().includes(filtros.nombre.toLowerCase());
      }

      if (filtros.RUC && proveedor.RUC) {
        cumpleFiltros = cumpleFiltros && 
          proveedor.RUC.includes(filtros.RUC);
      }

      if (filtros.nombreComercial && proveedor.nombreComercial) {
        cumpleFiltros = cumpleFiltros && 
          proveedor.nombreComercial.toLowerCase().includes(filtros.nombreComercial.toLowerCase());
      }

      return cumpleFiltros;
    });

    this.collectionSize = this.proveedoresFiltrados.length;
    this.page = 1;
  }

  eliminarProveedor(id: number): void {
    if (confirm('¿Está seguro que desea eliminar este proveedor?')) {
      this.proveedoresService.eliminarProveedor(id).subscribe({
        next: (mensaje) => {
          console.log(mensaje);
          this.loadProveedores();
        },
        error: (error) => {
          console.error('Error al eliminar el proveedor:', error);
          this.error = 'Error al eliminar el proveedor. Por favor, intente nuevamente.';
        }
      });
    }
  }
} 