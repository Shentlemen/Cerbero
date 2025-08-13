import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ActivoAlmacenService, ActivoAlmacen } from '../../services/activo-almacen.service';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { ActivosService, ActivoDTO } from '../../services/activos.service';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';

interface StockGroup {
  estanteria: string;
  estantes: EstanteGroup[];
}

interface EstanteGroup {
  estante: string;
  activos: ActivoAlmacen[];
}

@Component({
  selector: 'app-stock-almacen',
  standalone: true,
  imports: [
    CommonModule,
    NgbModule,
    NotificationContainerComponent
  ],
  templateUrl: './stock-almacen.component.html',
  styleUrls: ['./stock-almacen.component.css']
})
export class StockAlmacenComponent implements OnInit {
  almacen: Almacen | null = null;
  stockOrganizado: StockGroup[] = [];
  loading: boolean = false;
  error: string | null = null;
  activos: ActivoDTO[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private activoAlmacenService: ActivoAlmacenService,
    private almacenService: AlmacenService,
    private activosService: ActivosService,
    private modalService: NgbModal,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    const almacenId = this.route.snapshot.paramMap.get('id');
    if (!almacenId) {
      this.error = 'ID de almacén no válido';
      this.loading = false;
      return;
    }

    // Cargar datos en paralelo
    Promise.all([
      this.almacenService.getAlmacenById(parseInt(almacenId)).toPromise(),
      this.activoAlmacenService.getAllUbicaciones().toPromise(),
      this.activosService.getActivos().toPromise()
    ]).then(([almacen, ubicaciones, activos]) => {
      if (almacen) {
        this.almacen = almacen;
      }

      if (activos) {
        this.activos = activos;
      }

      if (ubicaciones) {
        // Filtrar solo las ubicaciones de este almacén
        const ubicacionesAlmacen = ubicaciones.filter(u => u.almacen.id === parseInt(almacenId));
        this.organizarStock(ubicacionesAlmacen);
      }

      this.loading = false;
    }).catch(error => {
      console.error('Error al cargar datos:', error);
      this.error = 'Error al cargar datos del almacén. Por favor, intente nuevamente.';
      this.loading = false;
    });
  }

  organizarStock(ubicaciones: ActivoAlmacen[]): void {
    // Agrupar por estantería
    const grupos: { [key: string]: { [key: string]: ActivoAlmacen[] } } = {};

    ubicaciones.forEach(ubicacion => {
      if (!grupos[ubicacion.estanteria]) {
        grupos[ubicacion.estanteria] = {};
      }
      if (!grupos[ubicacion.estanteria][ubicacion.estante]) {
        grupos[ubicacion.estanteria][ubicacion.estante] = [];
      }
      grupos[ubicacion.estanteria][ubicacion.estante].push(ubicacion);
    });

    // Convertir a estructura de arrays
    this.stockOrganizado = Object.keys(grupos).map(estanteria => {
      const estantes = Object.keys(grupos[estanteria]).map(estante => ({
        estante,
        activos: grupos[estanteria][estante]
      }));

      return {
        estanteria,
        estantes
      };
    });

    // Ordenar por estantería y estante
    this.stockOrganizado.sort((a, b) => a.estanteria.localeCompare(b.estanteria));
    this.stockOrganizado.forEach(grupo => {
      grupo.estantes.sort((a, b) => a.estante.localeCompare(b.estante));
    });
  }

  getActivoName(activoId: number): string {
    const activo = this.activos.find(a => a.idActivo === activoId);
    return activo?.name || 'Activo no encontrado';
  }

  volverAAlmacenes(): void {
    this.router.navigate(['/menu/almacen/almacenes']);
  }

  canManageStock(): boolean {
    return this.permissionsService.canManageAssets();
  }
} 