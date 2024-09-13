import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HwService } from '../hw.service';  
import { Router, ActivatedRoute } from '@angular/router';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './assets.component.html',
  styleUrls: ['./assets.component.css']
})
export class AssetsComponent implements OnInit {

  assetsList: any[] = [];
  assetsFiltrados: any[] = [];
  filterForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private hwService: HwService, private fb: FormBuilder, private router: Router, private route: ActivatedRoute) {
    this.filterForm = this.fb.group({
      NAME: [''],
      OSNAME: [''],
      IPADDR: [''],
      TYPE: [''],
      marca: ['']  // Añadimos el campo de marca
    });
  }

  ngOnInit(): void {
    this.assetsList = this.hwService.getHardware();
    this.assetsFiltrados = [...this.assetsList];

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
    this.router.navigate(['/menu/asset-details', asset.NAME]);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      // Si ya estamos ordenando por esta columna, cambiamos la dirección
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Si es una nueva columna, establecemos la dirección a ascendente
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.assetsFiltrados.sort((a, b) => {
      const valueA = a[column].toLowerCase();
      const valueB = b[column].toLowerCase();
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
