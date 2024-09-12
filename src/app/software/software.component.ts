import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SwService } from '../sw.service'; // Update this import
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-software',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './software.component.html',
  styleUrls: ['./software.component.css']
})
export class SoftwareComponent implements OnInit {

  softwareList: any[] = [];
  softwareFiltrado: any[] = [];
  filterForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private softwareService: SwService, private fb: FormBuilder, private router: Router) { // Update the type here
    this.filterForm = this.fb.group({
      nombre: [''],
      version: [''],
      licencia: [''],
      fechaInstalacion: ['']
    });
  }

  ngOnInit(): void {
    this.softwareList = this.softwareService.getSoftwares();
    this.softwareFiltrado = [...this.softwareList];
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;

    this.softwareFiltrado = this.softwareList.filter(software => {
      return Object.keys(filtros).every(key => {
        const filtroValor = filtros[key];
        const softwareValor = software[key];

        if (filtroValor === '') return true;

        return softwareValor.toString().toLowerCase().includes(filtroValor.toString().toLowerCase().trim());
      });
    });
  }

  verDetallesSoftware(software: any): void {
    this.router.navigate(['/menu/software-details', software.nroSoftware]);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.softwareFiltrado.sort((a, b) => {
      const valueA = a[column].toString().toLowerCase();
      const valueB = b[column].toString().toLowerCase();
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
