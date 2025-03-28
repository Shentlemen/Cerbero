import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { EntregasService, EntregaDTO } from '../../services/entregas.service';

@Component({
  selector: 'app-entregas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './entregas.component.html',
  styleUrls: ['./entregas.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class EntregasComponent implements OnInit {
  entregasList: EntregaDTO[] = [];
  entregasFiltradas: EntregaDTO[] = [];
  filterForm: FormGroup;
  entregaForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 11;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;

  constructor(
    private entregasService: EntregasService,
    private fb: FormBuilder,
    private modalService: NgbModal
  ) {
    this.filterForm = this.fb.group({
      descripcion: [''],
      fechaPedido: [''],
      fechaFinGarantia: ['']
    });

    this.entregaForm = this.fb.group({
      idItem: ['', Validators.required],
      cantidad: ['', [Validators.required, Validators.min(1)]],
      descripcion: ['', Validators.required],
      fechaPedido: ['', Validators.required],
      fechaFinGarantia: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadEntregas();
  }

  loadEntregas(): void {
    this.loading = true;
    this.error = null;
    
    this.entregasService.getEntregas().subscribe({
      next: (entregas) => {
        this.entregasList = entregas;
        this.entregasFiltradas = [...this.entregasList];
        this.collectionSize = this.entregasFiltradas.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar las entregas:', error);
        this.error = 'Error al cargar las entregas. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  get pagedEntregas(): EntregaDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.entregasFiltradas.slice(startItem, endItem);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.entregasFiltradas.sort((a, b) => {
      let valueA = a[column as keyof EntregaDTO];
      let valueB = b[column as keyof EntregaDTO];

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

  abrirModal(modal: any, entrega?: EntregaDTO): void {
    if (entrega) {
      this.modoEdicion = true;
      this.entregaForm.patchValue(entrega);
    } else {
      this.modoEdicion = false;
      this.entregaForm.reset();
    }
    this.modalService.open(modal, { size: 'lg' });
  }

  guardarEntrega(): void {
    if (this.entregaForm.valid) {
      const entregaData = this.entregaForm.value;
      
      if (this.modoEdicion) {
        this.entregasService.actualizarEntrega(entregaData.idEntrega, entregaData).subscribe({
          next: () => {
            this.loadEntregas();
            this.modalService.dismissAll();
          },
          error: (error) => {
            console.error('Error al actualizar la entrega:', error);
            this.error = 'Error al actualizar la entrega. Por favor, intente nuevamente.';
          }
        });
      } else {
        this.entregasService.crearEntrega(entregaData).subscribe({
          next: () => {
            this.loadEntregas();
            this.modalService.dismissAll();
          },
          error: (error) => {
            console.error('Error al crear la entrega:', error);
            this.error = 'Error al crear la entrega. Por favor, intente nuevamente.';
          }
        });
      }
    }
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
    
    this.entregasFiltradas = this.entregasList.filter(entrega => {
      let cumpleFiltros = true;

      if (filtros.descripcion && entrega.descripcion) {
        cumpleFiltros = cumpleFiltros && 
          entrega.descripcion.toLowerCase().includes(filtros.descripcion.toLowerCase());
      }

      if (filtros.fechaPedido && entrega.fechaPedido) {
        cumpleFiltros = cumpleFiltros && 
          entrega.fechaPedido >= filtros.fechaPedido;
      }

      if (filtros.fechaFinGarantia && entrega.fechaFinGarantia) {
        cumpleFiltros = cumpleFiltros && 
          entrega.fechaFinGarantia <= filtros.fechaFinGarantia;
      }

      return cumpleFiltros;
    });

    this.collectionSize = this.entregasFiltradas.length;
    this.page = 1;
  }

  eliminarEntrega(id: number): void {
    if (confirm('¿Está seguro que desea eliminar esta entrega?')) {
      this.entregasService.eliminarEntrega(id).subscribe({
        next: () => {
          this.loadEntregas();
        },
        error: (error) => {
          console.error('Error al eliminar la entrega:', error);
          this.error = 'Error al eliminar la entrega. Por favor, intente nuevamente.';
        }
      });
    }
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-ES');
  }
} 