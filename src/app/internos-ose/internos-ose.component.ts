import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { InternosOseService, InternoOseDTO, InternoOsePayload } from '../services/internos-ose.service';
import { PermissionsService } from '../services/permissions.service';

type InternoSortColumn = 'box' | 'area' | 'persona' | 'interno' | 'app';

@Component({
  selector: 'app-internos-ose',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './internos-ose.component.html',
  styleUrls: ['./internos-ose.component.css']
})
export class InternosOseComponent implements OnInit {
  internosList: InternoOseDTO[] = [];
  internosFiltrados: InternoOseDTO[] = [];
  internoForm: FormGroup;
  searchTerm = '';
  soloActivos = false;
  sortColumn: InternoSortColumn = 'area';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 25;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  internoSeleccionado: InternoOseDTO | null = null;
  showConfirmDialog = false;
  internoToDelete: InternoOseDTO | null = null;

  constructor(
    private internosOseService: InternosOseService,
    private permissionsService: PermissionsService,
    private fb: FormBuilder,
    private modalService: NgbModal
  ) {
    this.internoForm = this.fb.group({
      box: [''],
      area: ['', Validators.required],
      persona: [''],
      interno: [''],
      app: [''],
      esColectivo: [false],
      activo: [true]
    });
  }

  ngOnInit(): void {
    this.loadInternos();
  }

  canManageInternos(): boolean {
    return this.permissionsService.canManageInternosOse();
  }

  loadInternos(): void {
    this.loading = true;
    this.error = null;

    this.internosOseService.getInternos().subscribe({
      next: (internos: InternoOseDTO[]) => {
        this.internosList = internos;
        this.aplicarFiltrosYOrden();
        this.loading = false;
      },
      error: (err: Error) => {
        console.error('Error al cargar internos OSE:', err);
        this.error = err.message || 'Error al cargar los internos. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  get pagedInternos(): InternoOseDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    return this.internosFiltrados.slice(startItem, startItem + this.pageSize);
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

  onSoloActivosChange(): void {
    this.page = 1;
    this.aplicarFiltrosYOrden();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchTermChange();
  }

  sortData(column: InternoSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.page = 1;
    this.ordenarLista(this.internosFiltrados);
  }

  getSortIcon(column: InternoSortColumn): string {
    if (this.sortColumn !== column) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  isSortActive(column: InternoSortColumn): boolean {
    return this.sortColumn === column;
  }

  private aplicarFiltrosYOrden(): void {
    const term = this.normalizeForSearch(this.searchTerm);
    this.internosFiltrados = this.internosList.filter((item) => {
      if (this.soloActivos && !item.activo) {
        return false;
      }
      if (!term) {
        return true;
      }
      return this.matchesSearch(item, term);
    });
    this.ordenarLista(this.internosFiltrados);
    this.collectionSize = this.internosFiltrados.length;
    const maxPage = Math.max(1, Math.ceil(this.collectionSize / this.pageSize) || 1);
    if (this.page > maxPage) {
      this.page = maxPage;
    }
  }

  private normalizeForSearch(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private matchesSearch(item: InternoOseDTO, term: string): boolean {
    const haystack = [
      item.box,
      item.area,
      item.persona,
      item.interno,
      item.app
    ]
      .map((v) => this.normalizeForSearch(v))
      .join(' ');
    return haystack.includes(term);
  }

  private ordenarLista(lista: InternoOseDTO[]): void {
    const col = this.sortColumn;
    const mult = this.sortDirection === 'asc' ? 1 : -1;
    lista.sort((a, b) => {
      const valA = this.getSortValue(a, col);
      const valB = this.getSortValue(b, col);
      return valA.localeCompare(valB, 'es', { sensitivity: 'base' }) * mult;
    });
  }

  private getSortValue(item: InternoOseDTO, col: InternoSortColumn): string {
    switch (col) {
      case 'box':
        return this.normalizeForSearch(item.box);
      case 'persona':
        return this.normalizeForSearch(item.persona);
      case 'interno':
        return this.normalizeForSearch(item.interno);
      case 'app':
        return this.normalizeForSearch(item.app);
      default:
        return this.normalizeForSearch(item.area);
    }
  }

  abrirModal(modal: unknown, interno?: InternoOseDTO): void {
    if (!this.canManageInternos()) {
      return;
    }
    if (interno) {
      this.modoEdicion = true;
      this.internoSeleccionado = interno;
      this.internoForm.patchValue({
        box: interno.box ?? '',
        area: interno.area ?? '',
        persona: interno.persona ?? '',
        interno: interno.interno ?? '',
        app: interno.app ?? '',
        esColectivo: !!interno.esColectivo,
        activo: interno.activo !== false
      });
    } else {
      this.modoEdicion = false;
      this.internoSeleccionado = null;
      this.internoForm.reset({
        box: '',
        area: '',
        persona: '',
        interno: '',
        app: '',
        esColectivo: false,
        activo: true
      });
    }
    this.modalService.open(modal, { size: 'lg', backdrop: true });
  }

  guardarInterno(): void {
    if (!this.internoForm.valid) {
      Object.keys(this.internoForm.controls).forEach(key => this.internoForm.get(key)?.markAsTouched());
      return;
    }

    const payload = this.buildPayload();
    if (!payload.area) {
      this.error = 'El área es obligatoria';
      return;
    }

    if (this.modoEdicion && this.internoSeleccionado) {
      this.internosOseService.actualizarInterno(this.internoSeleccionado.id, payload).subscribe({
        next: () => {
          this.loadInternos();
          this.modalService.dismissAll();
          this.error = null;
        },
        error: (err: Error) => {
          console.error('Error al actualizar interno:', err);
          this.error = err.message || 'Error al actualizar el interno.';
        }
      });
    } else {
      this.internosOseService.crearInterno(payload).subscribe({
        next: () => {
          this.loadInternos();
          this.modalService.dismissAll();
          this.error = null;
        },
        error: (err: Error) => {
          console.error('Error al crear interno:', err);
          this.error = err.message || 'Error al crear el interno.';
        }
      });
    }
  }

  private buildPayload(): InternoOsePayload {
    const raw = this.internoForm.value;
    const trim = (v: unknown) => {
      const s = String(v ?? '').trim();
      return s.length ? s : null;
    };
    return {
      box: trim(raw.box),
      area: String(raw.area ?? '').trim(),
      persona: trim(raw.persona),
      interno: trim(raw.interno),
      app: trim(raw.app),
      esColectivo: !!raw.esColectivo,
      activo: raw.activo !== false
    };
  }

  eliminarInterno(interno: InternoOseDTO): void {
    if (!this.canManageInternos()) {
      return;
    }
    this.internoToDelete = interno;
    this.showConfirmDialog = true;
  }

  confirmarEliminacion(): void {
    if (!this.internoToDelete) {
      return;
    }
    this.internosOseService.eliminarInterno(this.internoToDelete.id).subscribe({
      next: () => {
        this.loadInternos();
        this.showConfirmDialog = false;
        this.internoToDelete = null;
        this.error = null;
      },
      error: (err: Error) => {
        console.error('Error al eliminar interno:', err);
        this.error = err.message || 'Error al eliminar el interno.';
        this.showConfirmDialog = false;
        this.internoToDelete = null;
      }
    });
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.internoToDelete = null;
  }

  displayValue(value?: string | null): string {
    return value && value.trim() ? value : '-';
  }
}
