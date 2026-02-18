import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { StockAlmacenService } from '../../services/stock-almacen.service';
import { StockAlmacenCreateWithItem } from '../../interfaces/stock-almacen.interface';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { LotesService, LoteDTO } from '../../services/lotes.service';
import { ComprasService } from '../../services/compras.service';
import { NotificationService } from '../../services/notification.service';
import { AlmacenConfigService } from '../../services/almacen-config.service';
import { AlmacenConfig } from '../../interfaces/almacen-config.interface';

@Component({
  selector: 'app-registrar-stock-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './registrar-stock-modal.component.html',
  styleUrls: ['./registrar-stock-modal.component.css']
})
export class RegistrarStockModalComponent implements OnInit {
  @Input() almacenIdPreseleccionado?: number;
  @Input() ubicacionPreseleccionada?: { estanteria: string; estante: string; division: string };

  stockForm: FormGroup;
  almacenes: Almacen[] = [];
  compras: any[] = [];
  comprasFiltradas: any[] = [];
  mostrarDropdownCompras = false;
  compraSearchTerm = '';
  itemsDeCompra: LoteDTO[] = [];
  itemsFiltrados: LoteDTO[] = [];
  mostrarDropdownItems = false;
  itemSearchTerm = '';

  configAlmacenActual: AlmacenConfig | null = null;
  estanteriasDisponibles: string[] = [];
  estantesDisponibles: string[] = [];
  divisionesDisponibles: string[] = [];

  guardando = false;

  constructor(
    public activeModal: NgbActiveModal,
    private stockAlmacenService: StockAlmacenService,
    private almacenService: AlmacenService,
    private lotesService: LotesService,
    private comprasService: ComprasService,
    private notificationService: NotificationService,
    private almacenConfigService: AlmacenConfigService,
    private fb: FormBuilder
  ) {
    this.stockForm = this.fb.group({
      compraId: ['', Validators.required],
      itemId: ['', Validators.required],
      almacenId: ['', Validators.required],
      estanteria: ['', [Validators.required, Validators.maxLength(50)]],
      estante: ['', [Validators.required, Validators.maxLength(50)]],
      division: ['', Validators.maxLength(10)],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      numero: ['', Validators.maxLength(50)],
      descripcion: ['', Validators.maxLength(255)]
    });
  }

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  private async cargarDatosIniciales(): Promise<void> {
    try {
      const [almacenes, compras] = await Promise.all([
        this.almacenService.getAllAlmacenes().toPromise(),
        this.getComprasDisponibles()
      ]);
      if (almacenes) this.almacenes = almacenes;
      if (compras) {
        this.compras = compras;
        this.comprasFiltradas = [...compras];
      }

      const almacenInicial = this.almacenIdPreseleccionado ?? '';
      this.stockForm.patchValue({ almacenId: almacenInicial });
      if (this.almacenIdPreseleccionado) {
        this.cargarConfiguracionAlmacen(this.almacenIdPreseleccionado);
      }
      this.stockForm.get('almacenId')?.valueChanges.subscribe(almacenId => {
        if (almacenId) {
          this.cargarConfiguracionAlmacen(Number(almacenId));
          if (!this.ubicacionPreseleccionada) {
            this.stockForm.patchValue({ estanteria: '', estante: '', division: '' }, { emitEvent: false });
          }
        } else {
          this.limpiarConfiguracionAlmacen();
        }
      });
      this.updateFormValidation();
    } catch (e) {
      console.error('Error cargando datos:', e);
    }
  }

  private async getComprasDisponibles(): Promise<any[]> {
    try {
      const compras = await this.comprasService.getCompras().toPromise();
      if (!compras?.length) return [];
      let lotes: any[] = [];
      try {
        lotes = (await this.lotesService.getLotes().toPromise()) || [];
      } catch { return compras.map(c => ({ ...c, items: [] })); }
      const comprasConLotes = new Map();
      lotes.forEach(lote => {
        const compra = compras.find((c: any) => Number(c.idCompra) === Number(lote.idCompra));
        if (compra && !comprasConLotes.has(Number(compra.idCompra))) {
          comprasConLotes.set(Number(compra.idCompra), { idCompra: compra.idCompra, numeroCompra: compra.numeroCompra, descripcion: compra.descripcion, items: [] });
        }
        if (compra && comprasConLotes.has(Number(compra.idCompra))) {
          comprasConLotes.get(Number(compra.idCompra))!.items.push(lote);
        }
      });
      return Array.from(comprasConLotes.values());
    } catch {
      return [];
    }
  }

  cargarConfiguracionAlmacen(almacenId: number): void {
    this.almacenConfigService.getConfigByAlmacenId(almacenId).subscribe({
      next: (config) => {
        if (config) {
          this.configAlmacenActual = config;
          this.estanteriasDisponibles = Array.from({ length: config.cantidadEstanterias }, (_, i) => `E${i + 1}`);
          this.estantesDisponibles = Array.from({ length: config.cantidadEstantesPorEstanteria }, (_, i) => `${i + 1}`);
          this.divisionesDisponibles = this.almacenConfigService.getDivisionesArray(config.divisionesEstante);
          if (this.ubicacionPreseleccionada) {
            this.stockForm.patchValue({
              estanteria: this.ubicacionPreseleccionada.estanteria,
              estante: this.ubicacionPreseleccionada.estante,
              division: this.ubicacionPreseleccionada.division
            }, { emitEvent: false });
          }
        } else {
          this.configAlmacenActual = null;
          this.estanteriasDisponibles = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
          this.estantesDisponibles = ['1', '2', '3'];
          this.divisionesDisponibles = ['A', 'B', 'C'];
        }
        this.updateFormValidation();
      },
      error: () => {
        this.estanteriasDisponibles = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
        this.estantesDisponibles = ['1', '2', '3'];
        this.divisionesDisponibles = ['A', 'B', 'C'];
        this.configAlmacenActual = null;
        if (this.ubicacionPreseleccionada) {
          this.stockForm.patchValue({
            estanteria: this.ubicacionPreseleccionada.estanteria,
            estante: this.ubicacionPreseleccionada.estante,
            division: this.ubicacionPreseleccionada.division
          }, { emitEvent: false });
        }
        this.updateFormValidation();
      }
    });
  }

  limpiarConfiguracionAlmacen(): void {
    this.configAlmacenActual = null;
    this.estanteriasDisponibles = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
    this.estantesDisponibles = ['1', '2', '3'];
    this.divisionesDisponibles = ['A', 'B', 'C'];
    this.updateFormValidation();
  }

  updateFormValidation(): void {
    const estanteriaControl = this.stockForm.get('estanteria');
    const estanteControl = this.stockForm.get('estante');
    if (this.configAlmacenActual && estanteriaControl) {
      estanteriaControl.setValidators([
        Validators.required,
        (ctrl) => (!ctrl.value || !this.estanteriasDisponibles.length) ? null : (this.estanteriasDisponibles.includes(String(ctrl.value)) ? null : { invalidEstanteria: true })
      ]);
      estanteriaControl.updateValueAndValidity();
    }
    if (this.configAlmacenActual && estanteControl) {
      estanteControl.setValidators([
        Validators.required,
        (ctrl) => (!ctrl.value || !this.estantesDisponibles.length) ? null : (this.estantesDisponibles.includes(String(ctrl.value)) ? null : { invalidEstante: true })
      ]);
      estanteControl.updateValueAndValidity();
    }
  }

  filtrarCompras(): void {
    if (!this.compraSearchTerm.trim()) {
      this.comprasFiltradas = [...this.compras];
      return;
    }
    const t = this.compraSearchTerm.toLowerCase().trim();
    this.comprasFiltradas = this.compras.filter(c =>
      String(c.numeroCompra || '').toLowerCase().includes(t) || String(c.idCompra || '').toLowerCase().includes(t)
    );
  }

  seleccionarCompra(compra: any): void {
    this.stockForm.patchValue({ compraId: compra.idCompra, itemId: '' });
    this.compraSearchTerm = compra.numeroCompra?.toString() || '';
    this.mostrarDropdownCompras = false;
    this.cargarItemsDeCompra(compra.idCompra);
  }

  onCompraBlur(): void {
    setTimeout(() => { this.mostrarDropdownCompras = false; }, 200);
  }

  async cargarItemsDeCompra(compraId: number): Promise<void> {
    try {
      const lotes = await this.lotesService.getLotesByCompra(compraId).toPromise();
      this.itemsDeCompra = lotes || [];
      this.itemsFiltrados = [...this.itemsDeCompra];
    } catch {
      this.itemsDeCompra = [];
      this.itemsFiltrados = [];
    }
  }

  getItemInputDisplayValue(): string {
    const itemId = this.stockForm.get('itemId')?.value;
    if (itemId && this.itemsDeCompra?.length) {
      const item = this.itemsDeCompra.find(i => Number(i.idItem) === Number(itemId));
      if (item) return item.nombreItem || '';
    }
    return this.itemSearchTerm || '';
  }

  onItemInputChange(value: string): void {
    this.itemSearchTerm = value || '';
    this.filtrarItems();
    const itemId = this.stockForm.get('itemId')?.value;
    if (itemId) {
      const item = this.itemsDeCompra.find(i => Number(i.idItem) === Number(itemId));
      if (item && item.nombreItem !== value) {
        this.stockForm.patchValue({ itemId: '' }, { emitEvent: false });
      }
    }
  }

  filtrarItems(): void {
    if (!this.itemSearchTerm.trim()) {
      this.itemsFiltrados = [...this.itemsDeCompra];
      return;
    }
    const t = this.itemSearchTerm.toLowerCase().trim();
    this.itemsFiltrados = this.itemsDeCompra.filter(i => i.nombreItem?.toLowerCase().includes(t));
  }

  seleccionarItem(item: LoteDTO): void {
    this.stockForm.patchValue({ itemId: item.idItem });
    this.itemSearchTerm = item.nombreItem || '';
    this.mostrarDropdownItems = false;
    this.itemsFiltrados = [];
  }

  onItemBlur(): void {
    setTimeout(() => { this.mostrarDropdownItems = false; }, 200);
  }

  isFormValid(): boolean {
    return this.stockForm.valid;
  }

  guardar(): void {
    if (!this.isFormValid() || this.guardando) return;
    this.guardando = true;
    const fd = this.stockForm.value;
    const estanteFinal = fd.estante ? String(fd.estante) : '';
    const seccionFinal = fd.division && String(fd.division).trim() ? String(fd.division).trim() : undefined;

    const nuevoStock: StockAlmacenCreateWithItem = {
      compraId: fd.compraId,
      itemId: fd.itemId,
      almacenId: fd.almacenId,
      estanteria: fd.estanteria ? String(fd.estanteria) : '',
      estante: estanteFinal,
      seccion: seccionFinal,
      cantidad: fd.cantidad,
      numero: fd.numero,
      descripcion: fd.descripcion
    };

    this.stockAlmacenService.createStockWithItem(nuevoStock).subscribe({
      next: () => {
        this.notificationService.showSuccess('Stock registrado', 'El stock se ha registrado correctamente.');
        this.activeModal.close({ success: true });
      },
      error: (err) => {
        this.guardando = false;
        this.notificationService.showError('Error', err?.error?.message || 'No se pudo registrar el stock.');
      }
    });
  }
}
