import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { TourDefinition, TourRegistryService } from '../../services/tour-registry.service';

@Component({
  selector: 'app-tour-help-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tour-help-button.component.html',
  styleUrls: ['./tour-help-button.component.css']
})
export class TourHelpButtonComponent implements OnInit, OnDestroy {
  tours: TourDefinition[] = [];
  abierto = false;
  private sub?: Subscription;

  constructor(
    private tourRegistry: TourRegistryService,
    private hostRef: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.sub = this.tourRegistry.getCurrentTours().subscribe((tours) => {
      this.tours = tours;
      if (tours.length === 0) {
        this.abierto = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.abierto = !this.abierto;
  }

  elegir(tour: TourDefinition, event: MouseEvent): void {
    event.stopPropagation();
    this.abierto = false;
    this.tourRegistry.runTour(tour.id);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (this.abierto && target && !this.hostRef.nativeElement.contains(target)) {
      this.abierto = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.abierto = false;
  }
}
