import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaintenanceService, MaintenanceLog } from '../../services/maintenance.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-maintenance-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './maintenance-overlay.component.html',
  styleUrls: ['./maintenance-overlay.component.css']
})
export class MaintenanceOverlayComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('logsContainer') logsContainer!: ElementRef;
  
  isMaintenanceMode = false;
  maintenanceReason = '';
  remainingMinutes = 0;
  logs: MaintenanceLog[] = [];
  
  private subscriptions: Subscription[] = [];
  private shouldScrollToBottom = false;

  constructor(private maintenanceService: MaintenanceService) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.maintenanceService.maintenanceMode$.subscribe(isActive => {
        this.isMaintenanceMode = isActive;
      }),
      this.maintenanceService.maintenanceReason$.subscribe(reason => {
        this.maintenanceReason = reason;
      }),
      this.maintenanceService.remainingMinutes$.subscribe(minutes => {
        this.remainingMinutes = minutes;
      }),
      this.maintenanceService.logs$.subscribe(logs => {
        // Solo actualizar si hay nuevos logs (evita re-renders innecesarios)
        if (logs.length !== this.logs.length) {
          this.logs = logs;
          this.shouldScrollToBottom = true;
        }
      })
    );
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom && this.logsContainer) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private scrollToBottom(): void {
    try {
      const container = this.logsContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    } catch (err) {}
  }

  getLogClass(type: string): string {
    return `log-${type}`;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
