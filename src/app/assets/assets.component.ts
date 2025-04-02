import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { RouterModule } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { BiosService } from '../services/bios.service';
import { forkJoin } from 'rxjs';
import { SoftwareService } from '../services/software.service';
import { ActivosService } from '../services/activos.service';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule],
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class AssetsComponent implements OnInit {

  assetsList: any[] = [];
  assetsFiltrados: any[] = [];
  activosMap: Map<number, any> = new Map(); // Para almacenar los activos por hardwareId
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
  currentFilter: string = '';
  originalAssetsList: any[] = []; // Para guardar la lista original
  activeFilter: string | null = null;
  filterValues: { [key: string]: string } = {
    'name': '',
    'ipAddr': ''
  };

  constructor(
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private softwareService: SoftwareService,
    private activosService: ActivosService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.filterForm = this.fb.group({
      name: [''],
      osName: [''],
      ipAddr: [''],
      biosType: [''],
      smanufacturer: ['']
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const filterType = params['filterType'];
      const filterValue = params['filterValue'];

      console.log('Filter Type:', filterType);
      console.log('Filter Value:', filterValue);

      if (filterType === 'software') {
        try {
          const softwareInfo = JSON.parse(filterValue);
          this.loadAssetsForSoftware(softwareInfo);
        } catch (error) {
          console.error('Error parsing software filter:', error);
          this.loadAssets();
        }
      } else if (filterType && filterValue) {
        const formControlName = filterType === 'marca' ? 'smanufacturer' : 
                              filterType === 'type' ? 'biosType' : filterType;
        
        this.filterForm.patchValue({ [formControlName]: filterValue });
        this.aplicarFiltros();
      } else {
        this.loadAssets();
      }
    });
  }

  loadAssets(): void {
    forkJoin([
      this.hardwareService.getHardware(),
      this.biosService.getAllBios()
    ]).subscribe({
      next: ([hardwareList, biosList]) => {
        const biosMap = new Map(biosList.map(b => [b.hardwareId, b]));
        
        this.assetsList = hardwareList.map(h => ({
          ...h,
          biosType: (biosMap.get(h.id)?.type || 'DESCONOCIDO').trim().toUpperCase()
        }));
        
        this.originalAssetsList = this.assetsList;
        this.assetsFiltrados = [...this.originalAssetsList];
        this.collectionSize = this.assetsFiltrados.length;
        this.updateSummary();
        this.cargarActivosInfo();
      },
      error: (error) => {
        console.error('Error al cargar los assets:', error);
      }
    });
  }

  cargarActivosInfo(): void {
    // Cargar la información de activos para cada hardware
    this.assetsList.forEach(asset => {
      this.activosService.getActivoByHardwareId(asset.id).subscribe({
        next: (activo) => {
          this.activosMap.set(asset.id, activo);
        },
        error: (error) => {
          console.error(`Error al cargar activo para hardware ${asset.id}:`, error);
        }
      });
    });
  }

  loadAssetsForSoftware(softwareInfo: any): void {
    // Primero obtenemos los IDs de hardware que tienen este software
    this.softwareService.getHardwaresBySoftware(softwareInfo).subscribe({
      next: (hardwareIds) => {
        forkJoin([
          this.hardwareService.getHardware(),
          this.biosService.getAllBios()
        ]).subscribe({
          next: ([hardwareList, biosList]) => {
            const biosMap = new Map(biosList.map(b => [b.hardwareId, b]));
            
            // Filtrar la lista de hardware por los IDs obtenidos
            this.assetsList = hardwareList
              .filter(h => hardwareIds.includes(h.id))
              .map(h => ({
                ...h,
                biosType: (biosMap.get(h.id)?.type || 'DESCONOCIDO').trim().toUpperCase()
              }));
            
            this.originalAssetsList = this.assetsList;
            this.assetsFiltrados = [...this.originalAssetsList];
            this.collectionSize = this.assetsFiltrados.length;
            this.updateSummary();
          },
          error: (error) => {
            console.error('Error al cargar los assets:', error);
          }
        });
      },
      error: (error) => {
        console.error('Error al obtener hardware IDs:', error);
        this.loadAssets(); // Cargar todos los assets si hay error
      }
    });
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
    console.log('Aplicando filtros:', filtros);

    forkJoin({
      hardware: this.hardwareService.getHardware(),
      bios: this.biosService.getAllBios()
    }).subscribe(
      ({ hardware, bios }) => {
        // Crear un mapa de BIOS por hardwareId
        const biosMap = new Map(bios.map(b => [b.hardwareId, b]));
        
        // Combinar datos de hardware con BIOS
        let filteredAssets = hardware.map(h => {
          const biosData = biosMap.get(h.id);
          return {
            ...h,
            biosType: biosData?.type || 'DESCONOCIDO',
            smanufacturer: biosData?.smanufacturer || 'DESCONOCIDO'
          };
        });

        // Aplicar filtros
        filteredAssets = filteredAssets.filter(asset => {
          let cumpleFiltros = true;

          if (filtros.name && asset.name) {
            cumpleFiltros = cumpleFiltros && 
              asset.name.toLowerCase().includes(filtros.name.toLowerCase());
          }

          if (filtros.osName && asset.osName) {
            cumpleFiltros = cumpleFiltros && 
              asset.osName.toLowerCase().includes(filtros.osName.toLowerCase());
          }

          if (filtros.ipAddr && asset.ipAddr) {
            cumpleFiltros = cumpleFiltros && 
              asset.ipAddr.toLowerCase().includes(filtros.ipAddr.toLowerCase());
          }

          if (filtros.biosType && asset.biosType) {
            cumpleFiltros = cumpleFiltros && 
              asset.biosType.toLowerCase().includes(filtros.biosType.toLowerCase());
          }

          if (filtros.smanufacturer && asset.smanufacturer) {
            cumpleFiltros = cumpleFiltros && 
              asset.smanufacturer.toLowerCase().includes(filtros.smanufacturer.toLowerCase());
          }

          return cumpleFiltros;
        });

        this.assetsFiltrados = filteredAssets;
        this.collectionSize = this.assetsFiltrados.length;
        this.page = 1;
        this.updateSummary();
        
        console.log('Assets filtrados:', this.assetsFiltrados);
      },
      (error) => {
        console.error('Error al aplicar filtros', error);
      }
    );
  }

  updateSummary(): void {
    // Inicializa los contadores
    let totalAssets = 0;
    let pcCount = 0;
    let miniPcCount = 0;
    let laptopCount = 0;
    let otherCount = 0;

    // Recorre la lista de assets filtrados y cuenta los tipos
    this.assetsFiltrados.forEach(asset => {
      totalAssets++;
      const type = (asset.biosType || '').toUpperCase();

      switch (type) {
        case 'DESKTOP':
          pcCount++;
          break;
        case 'MINI PC':
          miniPcCount++;
          break;
        case 'LAPTOP':
        case 'NOTEBOOK':
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
    this.miniPcCount = miniPcCount;
    this.laptopCount = laptopCount;
    this.otherCount = otherCount;

    console.log('Resumen actualizado:', {
      totalAssets,
      pcCount,
      miniPcCount,
      laptopCount,
      otherCount
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

  verDetallesActivo(hardwareId: number): void {
    const activo = this.activosMap.get(hardwareId);
    if (activo) {
      this.router.navigate(['/menu/procurement/activos', activo.idActivo]);
    }
  }

  getNumeroCompra(hardwareId: number): string {
    const activo = this.activosMap.get(hardwareId);
    return activo ? activo.idNumeroCompra.toString() : 'No asignado';
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.assetsFiltrados.sort((a, b) => {
      let valueA = a[column];
      let valueB = b[column];

      // Manejar valores nulos o undefined
      if (valueA === null || valueA === undefined) valueA = '';
      if (valueB === null || valueB === undefined) valueB = '';

      // Manejo especial para IPs
      if (column === 'ipAddr') {
        // Convertir IPs a números para comparación
        const ipToNum = (ip: string) => {
          if (!ip) return 0;
          const parts = ip.split('.');
          return parts.reduce((sum, part) => sum * 256 + parseInt(part, 10), 0);
        };
        valueA = ipToNum(valueA);
        valueB = ipToNum(valueB);
      } else {
        // Para otros campos, convertir a minúsculas si son strings
        if (typeof valueA === 'string') valueA = valueA.toLowerCase();
        if (typeof valueB === 'string') valueB = valueB.toLowerCase();
      }

      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  filterByType(type: string): void {
    this.currentFilter = type;
    if (this.currentFilter === '') {
      this.assetsFiltrados = [...this.originalAssetsList];
    } else {
      this.assetsFiltrados = this.originalAssetsList.filter(asset => 
        (asset.biosType || '').trim().toUpperCase() === this.currentFilter.trim().toUpperCase()
      );
    }
    
    this.collectionSize = this.assetsFiltrados.length;
    this.page = 1;
    this.updateSummary();

    // Para debug
    console.log('Filtro aplicado:', this.currentFilter);
    console.log('Assets filtrados:', this.assetsFiltrados);
    console.log('Tipos disponibles:', [...new Set(this.originalAssetsList.map(a => a.biosType))]);
  }

  toggleFilter(column: string): void {
    if (this.activeFilter === column) {
      this.activeFilter = null;
    } else {
      this.activeFilter = column;
    }
    this.updateSummary();
  }

  applyColumnFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value.toLowerCase();
    if (this.activeFilter) {
      this.filterValues[this.activeFilter] = value;
    }
    
    if (!this.activeFilter || !value) {
      this.assetsFiltrados = [...this.originalAssetsList];
    } else {
      this.assetsFiltrados = this.originalAssetsList.filter(asset => {
        if (this.activeFilter === 'ipAddr') {
          const ipValue = asset[this.activeFilter]?.toLowerCase() || '';
          const searchOctets = value.split('.');
          const ipOctets = ipValue.split('.');
          
          for (let i = 0; i < searchOctets.length; i++) {
            if (searchOctets[i] && !ipOctets[i].startsWith(searchOctets[i])) {
              return false;
            }
          }
          return true;
        } else {
          const fieldValue = asset[this.activeFilter as string]?.toLowerCase() || '';
          return fieldValue.includes(value);
        }
      });
    }
    this.updateSummary();
  }

  handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.activeFilter = null;
    }
  }
}
