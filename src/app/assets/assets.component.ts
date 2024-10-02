import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { RouterModule } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule],
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.css']
})
export class AssetsComponent implements OnInit {

  assetsList: any[] = [];
  assetsFiltrados: any[] = [];
  filterForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

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
      deviceId: ['']
    });
  }

  ngOnInit(): void {
    this.hardwareService.getHardware().subscribe(
      (data: any[]) => {
        console.log('Datos recibidos:', data); // Añadir este log
        this.assetsList = data;
        this.assetsFiltrados = [...this.assetsList];
        console.log('Assets filtrados:', this.assetsFiltrados); // Añadir este log
      },
      (error) => {
        console.error('Error al cargar la lista de assets', error);
      }
    );

    this.route.queryParams.subscribe(params => {
      if (params['filterType'] && params['filterValue']) {
        this.filterForm.patchValue({
          [params['filterType']]: params['filterValue']
        });
        this.aplicarFiltros();
      }
    });
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;

    this.assetsFiltrados = this.assetsList.filter(asset => {
      return Object.keys(filtros).every(key => {
        const filtroValor = filtros[key];
        const assetValor = asset[key];

        if (filtroValor === '') return true; // Si el filtro está vacío, no se aplica

        if (typeof assetValor === 'number' && filtroValor !== '') {
          return assetValor === +filtroValor;
        } else {
          return assetValor.toString().toLowerCase().includes(filtroValor.toString().toLowerCase().trim());
        }
      });
    });
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
      let valueA = a[column];
      let valueB = b[column];

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
}
