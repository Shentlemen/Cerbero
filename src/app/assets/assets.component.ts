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
      type: ['']
    });
  }

  ngOnInit(): void {
    this.hardwareService.getHardware().subscribe(
      (data: any[]) => {
        console.log('Datos recibidos:', data);
        this.assetsList = data;
        this.assetsFiltrados = [...this.assetsList];
        console.log('Assets filtrados:', this.assetsFiltrados);
        
        // Apply filters from query params
        this.route.queryParams.subscribe(params => {
          if (params['filterType'] && params['filterValue']) {
            this.filterForm.patchValue({
              [params['filterType']]: params['filterValue']
            });
            this.aplicarFiltros();
          }
        });
        
        this.collectionSize = this.assetsFiltrados.length;
        this.aplicarFiltros(); // Añade esta línea para asegurar que la paginación se actualice
      },
      (error) => {
        console.error('Error al cargar la lista de assets', error);
      }
    );
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;

    this.assetsFiltrados = this.assetsList.filter(asset => {
      return Object.keys(filtros).every(key => {
        const filtroValor = filtros[key];
        let assetValor = asset[key];

        if (!filtroValor) return true; // Si el filtro está vacío, no lo aplicamos

        if (key === 'type') {
          // Convertimos el valor del filtro a su equivalente numérico
          const typeNumber = this.getTypeNumber(filtroValor);
          return assetValor === typeNumber;
        }

        if (typeof assetValor === 'string' && typeof filtroValor === 'string') {
          return assetValor.toLowerCase().includes(filtroValor.toLowerCase().trim());
        } else {
          return assetValor == filtroValor; // Usamos igualdad no estricta para otros tipos
        }
      });
    });

    console.log('Filtros aplicados:', filtros);
    console.log('Assets filtrados:', this.assetsFiltrados);
    
    this.collectionSize = this.assetsFiltrados.length;
    this.page = 1; // Reseteamos a la primera página cuando se aplican los filtros
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
    return this.assetsList.filter(asset => asset.type === '1' || asset.type === '2').length;
  }

  getLaptopCount(): number {
    return this.assetsList.filter(asset => asset.type === '3').length;
  }

  getOtherCount(): number {
    return this.assetsList.filter(asset => asset.type !== '1' && asset.type !== '2' && asset.type !== '3').length;
  }

  private typeMap: Record<string, string> = { '1': 'PC', '2': 'MINI PC', '3': 'LAPTOP', '4': 'Tablet' };

  private getTypeNumber(typeString: string): string {
    const lowercaseType = typeString.toLowerCase();
    for (const [key, value] of Object.entries(this.typeMap)) {
      if (value.toLowerCase() === lowercaseType) {
        return key;
      }
    }
    return typeString; // Si no se encuentra una coincidencia, devuelve el string original
  }

  getHardwareType(type: string): string {
    return this.typeMap[type] || 'Desconocido';
  }
}
