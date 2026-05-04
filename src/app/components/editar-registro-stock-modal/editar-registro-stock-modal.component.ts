import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { StockAlmacenService, StockAlmacenCreate } from '../../services/stock-almacen.service';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { AlmacenConfigService } from '../../services/almacen-config.service';
import { AlmacenConfig, defEstanteria, estanteriasOrdenadas } from '../../interfaces/almacen-config.interface';

/** Stock tal como viene en la lista / API */
export interface StockItemEdicion {
  id: number;
  item?: { idItem?: number | null; nombreItem?: string; descripcion?: string } | null;
  compra?: { idCompra?: number; numeroCompra?: string } | null;
  almacen: { id: number; numero?: string; nombre?: string };
  estanteria?: string;
  estante?: string;
  seccion?: string | null;
  cantidad?: number;
  numero?: string | null;
  descripcion?: string | null;
}

@Component({
  selector: 'app-editar-registro-stock-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './editar-registro-stock-modal.component.html',
  styleUrls: ['./editar-registro-stock-modal.component.css'],
})
export class EditarRegistroStockModalComponent implements OnInit {
  private _item: StockItemEdicion | null = null;
  stockForm: FormGroup;
  almacenes: Almacen[] = [];
  configAlmacenActual: AlmacenConfig | null = null;
  estanteriasDisponibles: string[] = [];
  estantesDisponibles: string[] = [];
  divisionesDisponibles: string[] = [];
  guardando = false;

  /** Información de compra/ítem (solo lectura) */
  textoCompraItem = '';

  @Input()
  set item(val: StockItemEdicion | null) {
    this._item = val;
    if (val && this.stockForm) {
      this.patchFromItem(val);
    }
  }
  get item(): StockItemEdicion | null {
    return this._item;
  }

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private stockAlmacenService: StockAlmacenService,
    private almacenService: AlmacenService,
    private almacenConfigService: AlmacenConfigService
  ) {
    this.stockForm = this.fb.group({
      almacenId: ['', Validators.required],
      estanteria: ['', [Validators.required, Validators.maxLength(50)]],
      estante: ['', [Validators.required, Validators.maxLength(50)]],
      division: ['', Validators.maxLength(10)],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      numero: ['', Validators.maxLength(50)],
      descripcion: ['', Validators.maxLength(255)],
    });
  }

  ngOnInit(): void {
    this.almacenService.getAllAlmacenes().subscribe({
      next: (a) => (this.almacenes = a || []),
      error: () => (this.almacenes = []),
    });
    this.stockForm.get('almacenId')?.valueChanges.subscribe((almacenId) => {
      if (almacenId) {
        this.cargarConfiguracionAlmacen(Number(almacenId));
        this.stockForm.patchValue({ estanteria: '', estante: '', division: '' }, { emitEvent: false });
      } else {
        this.limpiarConfiguracionAlmacen();
      }
    });
    this.stockForm.get('estanteria')?.valueChanges.subscribe(() => {
      this.actualizarOpcionesPorEstanteriaSeleccionada();
    });
  }

  private patchFromItem(val: StockItemEdicion): void {
    const idCompra = val.compra?.idCompra;
    const nCompra = val.compra?.numeroCompra;
    const idItem = val.item?.idItem;
    const nomItem = val.item?.nombreItem;
    const partes: string[] = [];
    if (idItem != null && nomItem) {
      partes.push(`Ítem: ${nomItem}`);
    }
    if (idCompra != null) {
      partes.push(`Compra: ${nCompra || '#' + idCompra}`);
    }
    this.textoCompraItem = partes.length ? partes.join(' · ') : 'Sin vínculo a compra / ítem de catálogo';

    this.stockForm.patchValue(
      {
        almacenId: val.almacen?.id,
        estanteria: val.estanteria || '',
        estante: val.estante != null ? String(val.estante) : '',
        division: val.seccion != null ? String(val.seccion) : '',
        cantidad: val.cantidad ?? 1,
        numero: val.numero || '',
        descripcion: val.descripcion || '',
      },
      { emitEvent: false }
    );
    if (val.almacen?.id) {
      this.cargarConfiguracionAlmacen(val.almacen.id, true);
    }
  }

  cargarConfiguracionAlmacen(almacenId: number, preservarUbicacion = false): void {
    this.almacenConfigService.getConfigByAlmacenId(almacenId).subscribe({
      next: (config) => {
        if (config) {
          this.configAlmacenActual = config;
          this.estanteriasDisponibles = estanteriasOrdenadas(config).map((d) => d.codigo);
          if (preservarUbicacion && this._item) {
            this.stockForm.patchValue(
              {
                estanteria: this._item.estanteria || '',
                estante: this._item.estante != null ? String(this._item.estante) : '',
                division: this._item.seccion != null ? String(this._item.seccion) : '',
              },
              { emitEvent: false }
            );
          }
          this.actualizarOpcionesPorEstanteriaSeleccionada();
        } else {
          this.limpiarConfiguracionAlmacen();
          if (preservarUbicacion && this._item) {
            this.stockForm.patchValue(
              {
                estanteria: this._item.estanteria || '',
                estante: this._item.estante != null ? String(this._item.estante) : '',
                division: this._item.seccion != null ? String(this._item.seccion) : '',
              },
              { emitEvent: false }
            );
          }
        }
      },
      error: () => {
        this.limpiarConfiguracionAlmacen();
      },
    });
  }

  limpiarConfiguracionAlmacen(): void {
    this.configAlmacenActual = null;
    this.estanteriasDisponibles = [];
    this.estantesDisponibles = [];
    this.divisionesDisponibles = [];
  }

  private actualizarOpcionesPorEstanteriaSeleccionada(): void {
    this.estantesDisponibles = [];
    this.divisionesDisponibles = [];
    if (!this.configAlmacenActual) return;
    const cod = String(this.stockForm.get('estanteria')?.value ?? '').trim();
    if (!cod) return;
    const def = defEstanteria(this.configAlmacenActual, cod);
    if (!def) return;
    this.estantesDisponibles = Array.from({ length: def.cantidadEstantes }, (_, i) => `${i + 1}`);
    this.divisionesDisponibles = this.almacenConfigService.getDivisionesArray(def.divisionesEstante);
  }

  guardar(): void {
    if (!this._item?.id || this.stockForm.invalid || this.guardando) return;
    this.guardando = true;
    const fd = this.stockForm.value;
    const div = fd.division != null && String(fd.division).trim() !== '' ? String(fd.division).trim() : undefined;

    const payload: StockAlmacenCreate = {
      idCompra: this._item.compra?.idCompra,
      itemId: this._item.item?.idItem != null ? Number(this._item.item.idItem) : undefined,
      almacenId: Number(fd.almacenId),
      estanteria: fd.estanteria ? String(fd.estanteria) : '',
      estante: fd.estante ? String(fd.estante) : '',
      seccion: div,
      cantidad: Number(fd.cantidad),
      numero: fd.numero != null ? String(fd.numero) : '',
      descripcion: fd.descripcion != null ? String(fd.descripcion) : '',
    };

    this.stockAlmacenService.updateStock(Number(this._item.id), payload).subscribe({
      next: () => {
        this.activeModal.close({ success: true });
      },
      error: () => {
        this.guardando = false;
      },
    });
  }
}
