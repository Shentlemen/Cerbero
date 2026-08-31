import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { AlmacenConfigService } from '../../services/almacen-config.service';
import { AlmacenPlantaService } from '../../services/almacen-planta.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';
import { TourRegistryService, TourDefinition } from '../../services/tour-registry.service';
import { AlmacenEstanteriaDef, estanteriasOrdenadas } from '../../interfaces/almacen-config.interface';
import {
  AlmacenPlanta,
  AlmacenPlantaObjeto,
  AlmacenPlantaTipo,
  PLANTA_COLORES_ESTANTERIA,
  PLANTA_TIPOS_ZONA,
  PlantaPendingPlacement,
  colorEstanteriaPorCodigo,
  colorFillDeObjeto,
} from '../../interfaces/almacen-planta.interface';
import { AlmacenPlantaCanvasComponent } from './almacen-planta-canvas.component';

@Component({
  selector: 'app-planta-almacen-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, NotificationContainerComponent, AlmacenPlantaCanvasComponent],
  templateUrl: './planta-almacen-editor.component.html',
  styleUrls: ['./planta-almacen-editor.component.css'],
})
export class PlantaAlmacenEditorComponent implements OnInit, OnDestroy {
  @ViewChild('canvas') canvas?: AlmacenPlantaCanvasComponent;

  almacenId: number | null = null;
  almacen: Almacen | null = null;
  planta: AlmacenPlanta = { almacenId: 0, gridCols: 40, gridRows: 30, objetos: [] };
  estanteriasConfig: AlmacenEstanteriaDef[] = [];
  pending: PlantaPendingPlacement | null = null;
  seleccionado: AlmacenPlantaObjeto | null = null;
  loading = true;
  saving = false;
  error: string | null = null;
  readonly zonas = PLANTA_TIPOS_ZONA;
  readonly coloresEstanteria = PLANTA_COLORES_ESTANTERIA;
  readonly colorEstanteriaPorCodigo = colorEstanteriaPorCodigo;

  private tourCleanup?: () => void;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private almacenService: AlmacenService,
    private configService: AlmacenConfigService,
    private plantaService: AlmacenPlantaService,
    private notificationService: NotificationService,
    private tourRegistry: TourRegistryService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('almacenId'));
    if (!id) {
      this.error = 'Almacén inválido';
      this.loading = false;
      return;
    }
    this.almacenId = id;
    this.cargar();
    const tours: TourDefinition[] = [{
      id: 'planta-editor-overview',
      title: 'Tour del editor de planta',
      icon: 'fa-th',
      steps: [
        { selector: '#tour-planta-editor-title', title: 'Planta 2D', description: 'Acá dibujás el layout del almacén: habitaciones, estanterías y zonas (pasillo, muelle, oficina, staging).', side: 'bottom' },
        { selector: '#tour-planta-editor-palette', title: 'Paleta', description: 'Las estanterías que aún no están en el mapa aparecen acá. Clic o arrastre a la grilla. Una estantería no se puede pintar dos veces.', side: 'right' },
        { selector: '#tour-planta-editor-canvas', title: 'Lienzo', description: 'Clic en un objeto para seleccionarlo. Arrastrá los cuadrados del borde para el tamaño y el círculo de arriba para rotar. Zoom con la rueda; Ver todo muestra la planta completa.', side: 'left' },
        { selector: '#tour-planta-editor-save', title: 'Guardar', description: 'El layout se persiste en la base. Stock usa esta misma planta en solo lectura.', side: 'bottom' },
      ],
    }];
    this.tourCleanup = this.tourRegistry.register('planta', tours);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
  }

  get estanteriasSinColocar(): AlmacenEstanteriaDef[] {
    const colocadas = new Set(
      this.planta.objetos
        .filter(o => o.tipo === 'ESTANTERIA' && o.estanteriaCodigo)
        .map(o => (o.estanteriaCodigo || '').trim().toUpperCase())
    );
    return this.estanteriasConfig.filter(d => !colocadas.has((d.codigo || '').trim().toUpperCase()));
  }

  isPendingEstanteria(codigo: string): boolean {
    return !!this.pending && this.pending.tipo === 'ESTANTERIA'
      && (this.pending.estanteriaCodigo || '').toUpperCase() === codigo.toUpperCase();
  }

  setPending(tipo: AlmacenPlantaTipo, estanteriaCodigo: string | null, etiqueta: string): void {
    this.pending = { tipo, estanteriaCodigo, etiqueta };
  }

  onPaletteDragStart(ev: DragEvent, tipo: AlmacenPlantaTipo, estanteriaCodigo: string | null, etiqueta: string): void {
    this.setPending(tipo, estanteriaCodigo, etiqueta);
    ev.dataTransfer?.setData('application/x-cerbero-planta', JSON.stringify(this.pending));
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'copy';
    }
  }

  siguienteEtiquetaZona(tipo: AlmacenPlantaTipo, base: string): string {
    const n = this.planta.objetos.filter(o => o.tipo === tipo).length + 1;
    return n <= 1 ? base : `${base} ${n}`;
  }

  onObjetosChange(objetos: AlmacenPlantaObjeto[]): void {
    this.planta = { ...this.planta, objetos };
    if (this.seleccionado) {
      const key = this.seleccionado.clientKey || this.seleccionado.id;
      this.seleccionado = objetos.find(o => (o.clientKey || o.id) === key) ?? null;
    }
  }

  onSelection(obj: AlmacenPlantaObjeto | null): void {
    this.seleccionado = obj;
  }

  girarSeleccionado(): void {
    this.canvas?.rotateSelected90();
  }

  colorActual(obj: AlmacenPlantaObjeto): string {
    return colorFillDeObjeto(obj) || '#cbd5e1';
  }

  pintarSeleccionado(color: string): void {
    if (!this.seleccionado || !color) {
      return;
    }
    const key = this.seleccionado.clientKey || this.seleccionado.id;
    this.planta = {
      ...this.planta,
      objetos: this.planta.objetos.map(o =>
        (o.clientKey || o.id) === key ? { ...o, color } : o
      ),
    };
    this.seleccionado = { ...this.seleccionado, color };
  }

  renombrarSeleccionado(etiqueta: string): void {
    if (!this.seleccionado) {
      return;
    }
    const key = this.seleccionado.clientKey || this.seleccionado.id;
    this.planta = {
      ...this.planta,
      objetos: this.planta.objetos.map(o =>
        (o.clientKey || o.id) === key ? { ...o, etiqueta } : o
      ),
    };
    this.seleccionado = { ...this.seleccionado, etiqueta };
  }

  quitarSeleccionado(): void {
    if (!this.seleccionado) {
      return;
    }
    const key = this.seleccionado.clientKey || this.seleccionado.id;
    this.planta = {
      ...this.planta,
      objetos: this.planta.objetos.filter(o => (o.clientKey || o.id) !== key),
    };
    this.seleccionado = null;
  }

  guardar(): void {
    if (this.almacenId == null) {
      return;
    }
    this.saving = true;
    this.plantaService.saveByAlmacenId(this.almacenId, this.planta).subscribe({
      next: saved => {
        this.planta = saved;
        this.saving = false;
        this.seleccionado = null;
      },
      error: err => {
        this.saving = false;
        const msg = err?.error?.message || err?.message || 'No se pudo guardar la planta';
        this.notificationService.showError('Planta', msg);
      },
    });
  }

  volver(): void {
    this.router.navigate(['/menu/almacen/configuracion']);
  }

  private cargar(): void {
    if (this.almacenId == null) {
      return;
    }
    const id = this.almacenId;
    this.loading = true;
    forkJoin({
      almacen: this.almacenService.getAlmacenById(id).pipe(catchError(() => of(null))),
      config: this.configService.getConfigByAlmacenId(id).pipe(catchError(() => of(null))),
      planta: this.plantaService.getByAlmacenId(id),
    }).subscribe({
      next: ({ almacen, config, planta }) => {
        this.almacen = almacen;
        this.estanteriasConfig = config ? estanteriasOrdenadas(config) : [];
        this.planta = planta;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.error = err?.error?.message || err?.message || 'No se pudo cargar la planta';
      },
    });
  }
}
