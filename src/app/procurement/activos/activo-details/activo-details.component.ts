import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ActivosService, ActivoDTO } from '../../../services/activos.service';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-activo-details',
  standalone: true,
  imports: [CommonModule, NgbModule],
  templateUrl: './activo-details.component.html',
  styleUrls: ['./activo-details.component.css']
})
export class ActivoDetailsComponent implements OnInit {
  activo: ActivoDTO | null = null;
  loading: boolean = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private activosService: ActivosService,
    private modalService: NgbModal
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cargarActivo(parseInt(id));
    }
  }

  cargarActivo(id: number) {
    this.loading = true;
    this.error = null;
    this.activosService.getActivo(id).subscribe({
      next: (activo) => {
        this.activo = activo;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Error al cargar los detalles del activo';
        this.loading = false;
      }
    });
  }

  volver() {
    this.router.navigate(['/menu/procurement/activos']);
  }
} 