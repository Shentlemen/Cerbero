import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-bios-details',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="biosData">
      <h4 class="text-secondary">Información de BIOS</h4>
      <ul class="list-group list-group-flush">
        <li class="list-group-item"><i class="fas fa-fingerprint me-2"></i><strong>ID de Hardware:</strong> {{ biosData.hardwareId }}</li>
        <li class="list-group-item"><i class="fas fa-industry me-2"></i><strong>Fabricante del Sistema:</strong> {{ biosData.smanufacturer }}</li>
        <li class="list-group-item"><i class="fas fa-laptop me-2"></i><strong>Modelo del Sistema:</strong> {{ biosData.smodel }}</li>
        <li class="list-group-item"><i class="fas fa-barcode me-2"></i><strong>Número de Serie del Sistema:</strong> {{ biosData.ssn }}</li>
        <li class="list-group-item"><i class="fas fa-microchip me-2"></i><strong>Tipo de BIOS:</strong> {{ biosData.type }}</li>
        <li class="list-group-item"><i class="fas fa-industry me-2"></i><strong>Fabricante del BIOS:</strong> {{ biosData.bmanufacturer }}</li>
        <li class="list-group-item"><i class="fas fa-code me-2"></i><strong>Versión del BIOS:</strong> {{ biosData.bversion }}</li>
        <li class="list-group-item"><i class="fas fa-calendar-alt me-2"></i><strong>Fecha del BIOS:</strong> {{ biosData.bdate }}</li>
        <li class="list-group-item"><i class="fas fa-tag me-2"></i><strong>Etiqueta de Activo:</strong> {{ biosData.assetTag }}</li>
        <li class="list-group-item"><i class="fas fa-industry me-2"></i><strong>Fabricante de la Placa Base:</strong> {{ biosData.mmanufacturer }}</li>
        <li class="list-group-item"><i class="fas fa-microchip me-2"></i><strong>Modelo de la Placa Base:</strong> {{ biosData.mmodel }}</li>
        <li class="list-group-item"><i class="fas fa-barcode me-2"></i><strong>Número de Serie de la Placa Base:</strong> {{ biosData.msn }}</li>
      </ul>
    </div>
  `,
  styles: [
    `
      .text-secondary {
        color: #5a9bd5 !important;
        font-size: 1rem;
        margin-top: 0;
        margin-bottom: 1rem;
        border-bottom: 2px solid #85c1e9;
        padding-bottom: 0.5rem;
      }
      .list-group-item {
        background-color: #f9f9f9;
        border: 1px solid #dddddd;
        margin-bottom: 5px;
        border-radius: 5px;
        padding: 0.5rem;
        word-break: break-word;
        font-size: 0.9rem;
      }
      .list-group-item strong {
        color: #5a9bd5;
      }
    `
  ]
})
export class BiosDetailsComponent implements OnChanges {
  @Input() biosData: any;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['biosData'] && this.biosData) {
      console.log('Datos de BIOS recibidos:', this.biosData);
    }
  }
}
