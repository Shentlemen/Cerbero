import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TiposActivoService, TipoDeActivoDTO } from '../../services/tipos-activo.service';

@Component({
  selector: 'app-tipos-activo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './tipos-activo.component.html',
  styleUrls: ['./tipos-activo.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class TiposActivoComponent implements OnInit {
  tiposActivoList: TipoDeActivoDTO[] = [];
  tiposActivoFiltrados: TipoDeActivoDTO[] = [];
  tipoActivoForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 11;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  tipoActivoSeleccionado: TipoDeActivoDTO | null = null;

  constructor(
    private tiposActivoService: TiposActivoService,
    private fb: FormBuilder,
    private modalService: NgbModal
  ) {
    this.tipoActivoForm = this.fb.group({
      descripcion: ['', Validators.required],
      idUsuario: ['', [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.loadTiposActivo();
  }

  loadTiposActivo(): void {
    this.loading = true;
    this.error = null;
    
    this.tiposActivoService.getTiposActivo().subscribe({
      next: (tiposActivo) => {
        this.tiposActivoList = tiposActivo;
        this.tiposActivoFiltrados = [...this.tiposActivoList];
        this.collectionSize = this.tiposActivoFiltrados.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar los tipos de activo:', error);
        this.error = 'Error al cargar los tipos de activo. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  get pagedTiposActivo(): TipoDeActivoDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.tiposActivoFiltrados.slice(startItem, endItem);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.tiposActivoFiltrados.sort((a, b) => {
      let valueA = a[column as keyof TipoDeActivoDTO];
      let valueB = b[column as keyof TipoDeActivoDTO];

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

  abrirModal(modal: any, tipoActivo?: TipoDeActivoDTO): void {
    if (tipoActivo) {
      this.modoEdicion = true;
      this.tipoActivoSeleccionado = tipoActivo;
      this.tipoActivoForm.patchValue(tipoActivo);
    } else {
      this.modoEdicion = false;
      this.tipoActivoSeleccionado = null;
      this.tipoActivoForm.reset();
    }
    this.modalService.open(modal, { size: 'lg' });
  }

  guardarTipoActivo(): void {
    if (this.tipoActivoForm.valid) {
      const tipoActivoData = this.tipoActivoForm.value;
      
      if (this.modoEdicion && this.tipoActivoSeleccionado) {
        const tipoActivoActualizado: TipoDeActivoDTO = {
          ...tipoActivoData,
          idActivo: this.tipoActivoSeleccionado.idActivo
        };
        
        this.tiposActivoService.actualizarTipoActivo(this.tipoActivoSeleccionado.idActivo, tipoActivoActualizado).subscribe({
          next: () => {
            this.loadTiposActivo();
            this.modalService.dismissAll();
          },
          error: (error) => {
            console.error('Error al actualizar el tipo de activo:', error);
            this.error = 'Error al actualizar el tipo de activo. Por favor, intente nuevamente.';
          }
        });
      } else {
        this.tiposActivoService.crearTipoActivo(tipoActivoData).subscribe({
          next: () => {
            this.loadTiposActivo();
            this.modalService.dismissAll();
          },
          error: (error) => {
            console.error('Error al crear el tipo de activo:', error);
            this.error = 'Error al crear el tipo de activo. Por favor, intente nuevamente.';
          }
        });
      }
    }
  }

  eliminarTipoActivo(id: number): void {
    if (confirm('¿Está seguro que desea eliminar este tipo de activo?')) {
      this.tiposActivoService.eliminarTipoActivo(id).subscribe({
        next: () => {
          this.loadTiposActivo();
        },
        error: (error) => {
          console.error('Error al eliminar el tipo de activo:', error);
          this.error = 'Error al eliminar el tipo de activo. Por favor, intente nuevamente.';
        }
      });
    }
  }
} 