import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { map } from 'rxjs/operators';
import { EquipoHistorialService } from '../services/equipo-historial.service';
import { EquipoHistorialDTO } from '../interfaces/equipo-historial.interface';

@Component({
  selector: 'app-historial-equipos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgbPaginationModule],
  templateUrl: './historial-equipos.component.html',
  styleUrls: ['./historial-equipos.component.css']
})
export class HistorialEquiposComponent implements OnInit {
  items: EquipoHistorialDTO[] = [];
  loading = false;
  error: string | null = null;
  categoria = '';
  pcName = '';
  tipo = '';
  usuarioWin = '';
  desde = '';
  hasta = '';
  page = 1;
  pageSize = 50;
  collectionSize = 0;

  seleccionado: EquipoHistorialDTO | null = null;
  detalle: EquipoHistorialDTO[] = [];
  loadingDetalle = false;
  errorDetalle: string | null = null;

  readonly tipos = [
    { value: '', label: 'Todos los tipos' },
    { value: 'ip', label: 'IP' },
    { value: 'memory', label: 'Memoria' },
    { value: 'video', label: 'Video' },
    { value: 'monitor', label: 'Monitor' },
    { value: 'storage_hw', label: 'Disco físico' },
    { value: 'new_hardware', label: 'Equipo nuevo' },
    { value: 'cementerio', label: 'Cementerio' },
    { value: 'laboratorio', label: 'Laboratorio' },
    { value: 'oficina_laboratorio', label: 'Oficina laboratorio' },
    { value: 'regular', label: 'Almacén' },
    { value: 'reactivar', label: 'Reactivación' },
    { value: 'baja', label: 'Baja' },
    { value: 'alta_pendiente', label: 'Alta pendiente OCS' },
    { value: 'alta_cementerio', label: 'Alta en cementerio' }
  ];

  constructor(
    private historialService: EquipoHistorialService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.error = null;
    this.historialService.buscar({
      pcName: this.pcName.trim() || undefined,
      categoria: this.categoria || undefined,
      tipo: this.tipo || undefined,
      usuarioWin: this.usuarioWin.trim() || undefined,
      desde: this.desde || undefined,
      hasta: this.hasta || undefined,
      page: this.page - 1,
      size: this.pageSize
    }).subscribe({
      next: (data) => {
        this.items = data.items ?? [];
        this.collectionSize = data.total ?? 0;
        this.loading = false;
        if (this.seleccionado && !this.items.some(i => this.esMismoEquipo(i, this.seleccionado))) {
          this.cerrarDetalle();
        }
      },
      error: (err: unknown) => {
        console.error('Error al cargar historial de equipos:', err);
        this.items = [];
        this.collectionSize = 0;
        this.error = 'No se pudo cargar el historial.';
        this.loading = false;
      }
    });
  }

  filtrarCategoria(categoria: string): void {
    this.categoria = categoria;
    this.page = 1;
    this.cargar();
  }

  aplicarFiltros(): void {
    this.page = 1;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.pcName = '';
    this.tipo = '';
    this.usuarioWin = '';
    this.desde = '';
    this.hasta = '';
    this.page = 1;
    this.cargar();
  }

  onPageChange(page: number): void {
    this.page = page;
    this.cargar();
  }

  seleccionar(item: EquipoHistorialDTO): void {
    this.seleccionado = item;
    this.loadingDetalle = true;
    this.errorDetalle = null;
    const request$ = item.hardwareId != null
      ? this.historialService.porEquipo(item.hardwareId)
      : this.historialService.buscar({ pcName: item.pcName, size: 200 }).pipe(
          map(page => (page.items ?? []).filter(ev =>
            ev.pcName.trim().toUpperCase() === item.pcName.trim().toUpperCase()
          ))
        );

    request$.subscribe({
      next: (historial) => {
        this.detalle = historial ?? [];
        this.loadingDetalle = false;
      },
      error: (err: unknown) => {
        console.error('Error al cargar historial del equipo:', err);
        this.detalle = [];
        this.errorDetalle = 'No se pudo cargar el historial de este equipo.';
        this.loadingDetalle = false;
      }
    });
  }

  cerrarDetalle(): void {
    this.seleccionado = null;
    this.detalle = [];
    this.errorDetalle = null;
  }

  esMismoEquipo(item: EquipoHistorialDTO, seleccionado: EquipoHistorialDTO | null): boolean {
    if (!seleccionado) {
      return false;
    }
    if (item.hardwareId != null && seleccionado.hardwareId != null) {
      return item.hardwareId === seleccionado.hardwareId;
    }
    return item.pcName.trim().toUpperCase() === seleccionado.pcName.trim().toUpperCase();
  }

  irAFicha(): void {
    if (this.seleccionado?.hardwareId == null) {
      return;
    }
    void this.router.navigate(['/menu/asset-details', this.seleccionado.hardwareId], {
      queryParams: { tab: 'historial' }
    });
  }

  formatFecha(value: string | null): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  etiquetaTipo(tipo: string | null | undefined): string {
    return this.tipos.find(t => t.value === tipo)?.label || tipo || '—';
  }
}
