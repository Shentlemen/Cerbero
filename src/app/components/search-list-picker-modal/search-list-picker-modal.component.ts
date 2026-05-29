import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

export interface SearchListPickerItem<T = unknown> {
  id: string;
  label: string;
  sublabel?: string;
  iconClass?: string;
  data: T;
}

@Component({
  selector: 'app-search-list-picker-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-list-picker-modal.component.html',
  styleUrls: ['./search-list-picker-modal.component.css']
})
export class SearchListPickerModalComponent<T = unknown> implements OnInit {
  @Input() title = 'Seleccionar';
  @Input() searchPlaceholder = 'Buscar…';
  @Input() items: SearchListPickerItem<T>[] = [];
  @Input() allowClear = false;
  @Input() clearLabel = 'Sin selección';
  @Input() selectedId: string | null = null;
  @Input() emptyListMessage = 'No hay opciones disponibles.';
  @Input() noResultsMessage = 'No se encontraron resultados.';

  searchTerm = '';
  filteredItems: SearchListPickerItem<T>[] = [];
  highlightedId: string | null = null;

  constructor(public activeModal: NgbActiveModal) {}

  ngOnInit(): void {
    this.highlightedId = this.selectedId;
    this.applyFilter();
  }

  applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredItems = this.items.slice(0, 300);
      return;
    }
    this.filteredItems = this.items
      .filter((item) => {
        const haystack = [item.label, item.sublabel ?? '', item.id].join(' ').toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 300);
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  selectItem(item: SearchListPickerItem<T>): void {
    this.activeModal.close(item.data);
  }

  clearSelection(): void {
    this.activeModal.close(null);
  }

  isSelected(item: SearchListPickerItem<T>): boolean {
    return this.highlightedId != null && item.id === this.highlightedId;
  }
}
