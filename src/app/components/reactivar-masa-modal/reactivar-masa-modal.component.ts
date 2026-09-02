import { AfterViewInit, ChangeDetectorRef, Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

export interface ReactivarMasaItem {
  key: string;
  tipo: 'EQUIPO' | 'DISPOSITIVO';
  id?: number | null;
  mac?: string | null;
  name?: string;
  ipAddr?: string;
}

@Component({
  selector: 'app-reactivar-masa-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reactivar-masa-modal.component.html',
  styleUrls: ['../transferir-masa-modal/transferir-masa-modal.component.css'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'reactivar-masa-modal-host',
    style: 'display:block;width:100%;'
  }
})
export class ReactivarMasaModalComponent implements AfterViewInit {
  private _items: ReactivarMasaItem[] = [];
  busqueda = '';
  selectedKeys: string[] = [];
  titulo = 'Reactivar en masa';
  tituloLista = 'Items en almacén';

  constructor(
    public activeModal: NgbActiveModal,
    private cdr: ChangeDetectorRef
  ) {}

  get items(): ReactivarMasaItem[] {
    return this._items;
  }

  set items(value: ReactivarMasaItem[]) {
    this._items = Array.isArray(value) ? value.map((item, index) => ({
      ...item,
      key: item.key || this.itemKey(item, index)
    })) : [];
    this.cdr.markForCheck();
    queueMicrotask(() => this.cdr.detectChanges());
  }

  ngAfterViewInit(): void {
    this.cdr.detectChanges();
  }

  itemKey(item: ReactivarMasaItem, index?: number): string {
    if (item?.key) {
      return item.key;
    }
    if (item?.tipo === 'EQUIPO' && item.id != null) {
      return `e:${item.id}`;
    }
    if (item?.mac) {
      return `d:${item.mac}`;
    }
    return `idx:${index ?? 0}:${item?.name || ''}`;
  }

  trackByKey(index: number, item: ReactivarMasaItem): string {
    return this.itemKey(item, index);
  }

  get itemsFiltrados(): ReactivarMasaItem[] {
    const t = (this.busqueda || '').trim().toLowerCase();
    const list = this.items || [];
    if (!t) {
      return list;
    }
    return list.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const ip = (item.ipAddr || '').toLowerCase();
      const mac = (item.mac || '').toLowerCase();
      return name.includes(t) || ip.includes(t) || mac.includes(t);
    });
  }

  get seleccionados(): ReactivarMasaItem[] {
    const keys = new Set(this.selectedKeys);
    return (this.items || []).filter((item) => keys.has(this.itemKey(item)));
  }

  isSelected(item: ReactivarMasaItem): boolean {
    return this.selectedKeys.includes(this.itemKey(item));
  }

  toggleItem(item: ReactivarMasaItem, checked: boolean): void {
    const key = this.itemKey(item);
    if (!key) {
      return;
    }
    if (checked) {
      if (!this.selectedKeys.includes(key)) {
        this.selectedKeys = [...this.selectedKeys, key];
      }
    } else {
      this.selectedKeys = this.selectedKeys.filter((k) => k !== key);
    }
    this.cdr.detectChanges();
  }

  onCheckboxChange(item: ReactivarMasaItem, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.toggleItem(item, !!input?.checked);
  }

  quitarSeleccionado(item: ReactivarMasaItem): void {
    this.selectedKeys = this.selectedKeys.filter((k) => k !== this.itemKey(item));
    this.cdr.detectChanges();
  }

  get todosFiltradosSeleccionados(): boolean {
    const visibles = this.itemsFiltrados;
    return visibles.length > 0 && visibles.every((item) => this.isSelected(item));
  }

  seleccionarTodoFiltrado(): void {
    const keys = this.itemsFiltrados.map((item, index) => this.itemKey(item, index));
    if (!keys.length) {
      return;
    }
    if (this.todosFiltradosSeleccionados) {
      const quitar = new Set(keys);
      this.selectedKeys = this.selectedKeys.filter((key) => !quitar.has(key));
    } else {
      this.selectedKeys = Array.from(new Set([...this.selectedKeys, ...keys]));
    }
    this.cdr.detectChanges();
  }

  puedeEnviar(): boolean {
    return this.selectedKeys.length > 0 && this.seleccionados.length > 0;
  }

  etiquetaItem(item: ReactivarMasaItem): string {
    return item.name || item.mac || (item.id != null ? `ID ${item.id}` : 'Sin nombre');
  }

  metaItem(item: ReactivarMasaItem): string {
    if (item.tipo === 'DISPOSITIVO') {
      return item.mac || item.ipAddr || 'Dispositivo';
    }
    return item.ipAddr || 'Sin IP';
  }

  confirmar(): void {
    if (!this.puedeEnviar()) {
      return;
    }
    const hardwareIds: number[] = [];
    const macs: string[] = [];
    for (const item of this.seleccionados) {
      if (item.tipo === 'EQUIPO' && item.id != null) {
        hardwareIds.push(Number(item.id));
      } else if (item.tipo === 'DISPOSITIVO' && item.mac) {
        macs.push(item.mac);
      }
    }
    this.activeModal.close({ hardwareIds, macs });
  }
}
