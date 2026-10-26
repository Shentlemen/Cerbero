import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';
import { MonitorInventario, MonitorService } from '../services/monitor.service';
import { TourRegistryService } from '../services/tour-registry.service';
import { GuidedTourHostService } from '../services/guided-tour-host.service';
import { ListSearchStateService } from '../services/list-search-state.service';
import type { DriveStep } from 'driver.js';

type MonitorSortColumn = 'serial' | 'caption' | 'manufacturer' | 'pcName' | 'ipAddr' | 'userid';
type SerialFilter = '' | 'con-serie' | 'sin-serie';

@Component({
  selector: 'app-monitors',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbPaginationModule],
  templateUrl: './monitors.component.html',
  styleUrls: ['./monitors.component.css']
})
export class MonitorsComponent implements OnInit, OnDestroy {
  monitors: MonitorInventario[] = [];
  filtered: MonitorInventario[] = [];
  paged: MonitorInventario[] = [];
  loading = true;
  errorMessage: string | null = null;

  searchControl = new FormControl('');
  serialFilter: SerialFilter = '';
  sortColumn: MonitorSortColumn = 'serial';
  sortDirection: 'asc' | 'desc' = 'asc';

  page = 1;
  pageSize = 20;
  collectionSize = 0;

  private searchSub?: Subscription;
  private tourCleanup?: () => void;

  constructor(
    private monitorService: MonitorService,
    private router: Router,
    private tourRegistry: TourRegistryService,
    private guidedTourHost: GuidedTourHostService,
    private listSearchState: ListSearchStateService
  ) {}

  ngOnInit(): void {
    this.restorePersistedSearch();
    this.searchSub = this.searchControl.valueChanges.subscribe(value => {
      this.listSearchState.set('monitors', value || '');
      this.page = 1;
      this.applyFilters();
    });
    this.loadMonitors();
    this.tourCleanup = this.tourRegistry.register('monitors', [
      {
        id: 'monitores-overview',
        title: 'Tour de monitores',
        icon: 'fa-desktop',
        description: 'Listado de pantallas físicas y el PC al que están conectadas.',
        buildSteps: () => this.buildTour()
      }
    ]);
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.tourCleanup?.();
  }

  loadMonitors(): void {
    this.loading = true;
    this.errorMessage = null;
    this.monitorService.getInventario().subscribe({
      next: (list) => {
        this.monitors = Array.isArray(list) ? list : [];
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar monitores', error);
        this.monitors = [];
        this.filtered = [];
        this.paged = [];
        this.collectionSize = 0;
        this.errorMessage = 'No se pudieron cargar los monitores.';
        this.loading = false;
      }
    });
  }

  setSerialFilter(filter: SerialFilter): void {
    this.serialFilter = filter;
    this.page = 1;
    this.applyFilters();
  }

  limpiarBusqueda(): void {
    this.searchControl.setValue('');
  }

  private restorePersistedSearch(): void {
    const saved = this.listSearchState.get('monitors');
    if (saved) {
      this.searchControl.setValue(saved, { emitEvent: false });
    }
  }

  sortData(column: MonitorSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  onPageChange(page: number): void {
    this.page = page;
    this.updatePaged();
  }

  verDetalle(monitor: MonitorInventario): void {
    if (!monitor?.hardwareId) {
      return;
    }
    this.router.navigate(['/menu/asset-details', monitor.hardwareId], {
      queryParams: { tab: 'monitor' }
    });
  }

  trackByMonitorId(_index: number, monitor: MonitorInventario): number {
    return monitor.id;
  }

  get rangoDesde(): number {
    if (this.collectionSize === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get rangoHasta(): number {
    return Math.min(this.page * this.pageSize, this.collectionSize);
  }

  private applyFilters(): void {
    const term = (this.searchControl.value || '').trim().toLowerCase();
    let list = [...this.monitors];

    if (this.serialFilter === 'con-serie') {
      list = list.filter((m) => !!this.serialValue(m));
    } else if (this.serialFilter === 'sin-serie') {
      list = list.filter((m) => !this.serialValue(m));
    }

    if (term) {
      list = list.filter((m) => {
        const serial = (m.serial || '').toLowerCase();
        const caption = (m.caption || '').toLowerCase();
        const manufacturer = (m.manufacturer || '').toLowerCase();
        const pc = (m.pcName || '').toLowerCase();
        const ip = (m.ipAddr || '').toLowerCase();
        const user = (m.userid || '').toLowerCase();
        return serial.includes(term)
          || caption.includes(term)
          || manufacturer.includes(term)
          || pc.includes(term)
          || ip.includes(term)
          || user.includes(term);
      });
    }

    list.sort((a, b) => this.compareMonitors(a, b));
    this.filtered = list;
    this.collectionSize = list.length;
    const maxPage = Math.max(1, Math.ceil(this.collectionSize / this.pageSize) || 1);
    if (this.page > maxPage) {
      this.page = maxPage;
    }
    this.updatePaged();
  }

  private updatePaged(): void {
    const start = (this.page - 1) * this.pageSize;
    this.paged = this.filtered.slice(start, start + this.pageSize);
  }

  private compareMonitors(a: MonitorInventario, b: MonitorInventario): number {
    const dir = this.sortDirection === 'asc' ? 1 : -1;
    const av = (a[this.sortColumn] || '').toString().toLowerCase();
    const bv = (b[this.sortColumn] || '').toString().toLowerCase();
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  }

  private serialValue(monitor: MonitorInventario): string {
    return (monitor.serial || '').trim();
  }

  private buildTour(): DriveStep[] {
    return this.guidedTourHost.buildSteps([
      {
        selector: '#tour-monitors-title',
        title: 'Inventario de monitores',
        description: 'Cada fila es una pantalla física reportada por el agente, no el PC. El serial es el de la pantalla.',
        side: 'bottom'
      },
      {
        selector: '#tour-monitors-filters',
        title: 'Serie presente',
        description: 'Podés acotar a monitores con o sin número de serie (OCS a veces no lo informa).',
        side: 'bottom'
      },
      {
        selector: '#tour-monitors-search',
        title: 'Búsqueda',
        description: 'Buscá por serial, modelo, fabricante, nombre de PC, IP o último usuario.',
        side: 'bottom'
      },
      {
        selector: '#tour-monitors-table',
        title: 'Equipo conectado',
        description: 'Hacé clic en una fila para abrir el detalle de esa terminal, ya en la pestaña Monitor.',
        side: 'top'
      }
    ]);
  }
}
