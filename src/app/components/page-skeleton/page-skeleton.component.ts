import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type PageSkeletonVariant = 'table' | 'cards' | 'detail' | 'list' | 'compact' | 'canvas';

@Component({
  selector: 'app-page-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-skeleton.component.html',
  styleUrls: ['./page-skeleton.component.css']
})
export class PageSkeletonComponent {
  @Input() variant: PageSkeletonVariant = 'table';
  @Input() rows = 8;
  @Input() columns = 5;
  @Input() cards = 6;

  get rowSlots(): number[] {
    return Array.from({ length: this.rows }, (_, i) => i);
  }

  get colSlots(): number[] {
    return Array.from({ length: this.columns }, (_, i) => i);
  }

  get cardSlots(): number[] {
    return Array.from({ length: this.cards }, (_, i) => i);
  }
}
