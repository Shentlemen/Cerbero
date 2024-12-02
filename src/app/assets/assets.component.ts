import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { RouterModule } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.css'],
  encapsulation: ViewEncapsulation.None,
  styles: [`
    .pagination {
      margin-top: 15px !important;
      margin-bottom: 15px !important;
      background-color: transparent !important;
    }

    .pagination .page-item .page-link {
      color: #4a8bc5;
      background-color: transparent;
      border: none;
      padding: 0.5rem 0.75rem;
      margin: 0 2px;
      border-radius: 50%;
      transition: all 0.3s ease;
      font-weight: 500;
      font-size: 16px; /* Aumentado el tamaño de la fuente */
      min-width: 2.2rem; /* Asegura un ancho mínimo */
      min-height: 2.2rem; /* Asegura una altura mínima */
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pagination .page-item.active .page-link {
      color: #ffffff;
      background-color: #4a8bc5;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }

    .pagination .page-item .page-link:hover,
    .pagination .page-item .page-link:focus {
      color: #ffffff;
      background-color: #5a9bd5;
      transform: scale(1.1);
    }

    .pagination .page-item:first-child .page-link,
    .pagination .page-item:last-child .page-link {
      background-color: #f0f7fa;
      color: #4a8bc5;
      border-radius: 20px;
      padding: 0.5rem 0.75rem;
      font-size: 18px; /* Ligeramente más grande para los símbolos de extremos */
    }

    .pagination .page-item:first-child .page-link:hover,
    .pagination .page-item:last-child .page-link:hover {
      background-color: #4a8bc5;
      color: #ffffff;
    }
  `]
})
export class AssetsComponent implements OnInit {

  assetsList: any[] = [];
  assetsFiltrados: any[] = [];
  filterForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 11;
  collectionSize = 0;

  totalAssets: number = 0; // Declaración de la propiedad
  pcCount: number = 0;     // Declaración de la propiedad
  laptopCount: number = 0; // Declaración de la propiedad
  otherCount: number = 0;  // Declaración de la propiedad
  miniPcCount: number = 0; // Añadir esta nueva propiedad

  constructor(
    private hardwareService: HardwareService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.filterForm = this.fb.group({
      name: [''],
      osName: [''],
      ipAddr: [''],
      type: [''],
      smanufacturer: [''] // Cambiado a 'smanufacturer'
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const filterType = params['filterType'];
      const filterValue = params['filterValue'];

      console.log('Filter Type:', filterType);
      console.log('Filter Value:', filterValue);

      if (filterType && filterValue) {
        const mappedValue = filterType === 'type' ? this.getTypeNumber(filterValue) : filterValue;
        const formControlName = filterType === 'marca' ? 'smanufacturer' : filterType; // Cambiado a 'smanufacturer'
        this.filterForm.patchValue({ [formControlName]: mappedValue });
        console.log('Updated filter form:', this.filterForm.value); // Verifica que el formulario se actualiza correctamente
        this.aplicarFiltros();
      } else {
        this.loadAssets();
      }
    });
  }

  loadAssets(): void {
    this.hardwareService.getHardware().subscribe(
      (data: any[]) => {
        this.assetsList = data;
        this.assetsFiltrados = [...this.assetsList];
        this.collectionSize = this.assetsFiltrados.length;
        this.updateSummary(); // Asegúrate de actualizar el resumen aquí
      },
      (error) => {
        console.error('Error al cargar la lista de assets', error);
      }
    );
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
    console.log('Applying filters:', filtros);

    // Traduce el tipo de asset a su valor numérico antes de enviar la consulta
    if (filtros.type) {
      filtros.type = this.getTypeNumber(filtros.type);
    }

    this.hardwareService.filterHardware(filtros).subscribe(
      (data: any[]) => {
        this.assetsFiltrados = data;
        this.collectionSize = this.assetsFiltrados.length;
        this.page = 1; // Reseteamos a la primera página cuando se aplican los filtros
        this.updateSummary(); // Asegúrate de actualizar el resumen aquí
      },
      (error) => {
        console.error('Error al aplicar filtros', error);
      }
    );
  }

  updateSummary(): void {
    const typeMap: Record<string, string> = { 
      '0': 'PC', 
      '2': 'MINI PC', 
      '3': 'LAPTOP', 
      '4': 'Tablet' 
    };

    // Inicializa los contadores
    let totalAssets = 0;
    let pcCount = 0;
    let miniPcCount = 0; // Nuevo contador
    let laptopCount = 0;
    let otherCount = 0;

    // Recorre la lista de assets filtrados y cuenta los tipos
    this.assetsFiltrados.forEach(asset => {
      totalAssets++;
      const type = typeMap[asset.type] || 'Otros';

      switch (type) {
        case 'PC':
          pcCount++;
          break;
        case 'MINI PC':
          miniPcCount++;
          break;
        case 'LAPTOP':
          laptopCount++;
          break;
        default:
          otherCount++;
          break;
      }
    });

    // Actualiza las variables del resumen
    this.totalAssets = totalAssets;
    this.pcCount = pcCount;
    this.miniPcCount = miniPcCount; // Actualiza el nuevo contador
    this.laptopCount = laptopCount;
    this.otherCount = otherCount;

    console.log('Resumen actualizado:', {
      totalAssets: this.totalAssets,
      pcCount: this.pcCount,
      miniPcCount: this.miniPcCount,
      laptopCount: this.laptopCount,
      otherCount: this.otherCount
    });
  }

  get pagedAssets(): any[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.assetsFiltrados.slice(startItem, endItem);
  }

  verDetallesAsset(asset: any): void {
    if (asset && asset.id) {
      this.router.navigate(['/menu/asset-details', asset.id]);
    } else {
      console.error('Asset ID is undefined or null', asset);
      // Optionally, you can show an error message to the user
    }
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.assetsFiltrados.sort((a, b) => {
      let valueA = column === 'type' ? this.getHardwareType(a[column]) : a[column];
      let valueB = column === 'type' ? this.getHardwareType(b[column]) : b[column];

      if (column === 'name') {
        // Extract numeric part for 'name' column
        const numA = parseInt(valueA.replace(/\D/g, ''));
        const numB = parseInt(valueB.replace(/\D/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) {
          return this.sortDirection === 'asc' ? numA - numB : numB - numA;
        }
      }

      // For other columns, use the existing logic
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

  getPCCount(): number {
    return this.assetsList.filter(asset => asset.type === '0' || asset.type === '2').length;
  }

  getLaptopCount(): number {
    return this.assetsList.filter(asset => asset.type === '3').length;
  }

  getOtherCount(): number {
    return this.assetsList.filter(asset => asset.type !== '0' && asset.type !== '2' && asset.type !== '3').length;
  }

  private typeMap: Record<string, string> = { 
    '0': 'PC', 
    '2': 'MINI PC', 
    '3': 'LAPTOP', 
    '4': 'Tablet' 
  };

  private getTypeNumber(typeString: string): string {
    const typeMap: Record<string, string> = { 
      'PC': '0', 
      'MINI PC': '2', 
      'LAPTOP': '3', 
      'TABLET': '4'
    };
    return typeMap[typeString.toUpperCase()] || typeString;
  }

  getHardwareType(type: string): string {
    const typeMap: Record<string, string> = {
      '0': 'PC',
      '2': 'MINI PC',
      '3': 'LAPTOP',
      '4': 'TABLET'
    };
    return typeMap[type] || 'Desconocido';
  }
}
