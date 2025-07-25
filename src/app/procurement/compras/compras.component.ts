import { Component, OnInit, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { ComprasService, CompraDTO } from '../../services/compras.service';
import { TiposCompraService, TipoDeCompraDTO } from '../../services/tipos-compra.service';
import { forkJoin } from 'rxjs';
import { ProveedoresService, ProveedorDTO } from '../../services/proveedores.service';
import { ServiciosGarantiaService, ServicioGarantiaDTO } from '../../services/servicios-garantia.service';
import { LotesService, LoteDTO } from '../../services/lotes.service';
import { EntregasService } from '../../services/entregas.service';
import { PermissionsService } from '../../services/permissions.service';

interface CompraConTipo extends CompraDTO {
  tipoCompraDescripcion?: string;
}

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule, NgbNavModule],
  templateUrl: './compras.component.html',
  styleUrls: ['./compras.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ComprasComponent implements OnInit {
  comprasList: CompraConTipo[] = [];
  comprasFiltradas: CompraConTipo[] = [];
  tiposCompraList: TipoDeCompraDTO[] = [];
  filterForm: FormGroup;
  compraForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 11;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  showConfirmDialog = false;
  compraToDelete: number | null = null;
  itemsFormArray: FormArray;
  entregasFormArray: FormArray;
  activeTab: string = '1';
  proveedoresList: ProveedorDTO[] = [];
  serviciosGarantiaList: ServicioGarantiaDTO[] = [];
  lotesDeLaCompra: LoteDTO[] = [];
  idItemsOriginales: number[] = [];
  idEntregasOriginales: number[] = [];

  constructor(
    private comprasService: ComprasService,
    private tiposCompraService: TiposCompraService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private proveedoresService: ProveedoresService,
    private serviciosGarantiaService: ServiciosGarantiaService,
    private lotesService: LotesService,
    private entregasService: EntregasService,
    private cdr: ChangeDetectorRef,
    private permissionsService: PermissionsService
  ) {
    this.filterForm = this.fb.group({
      descripcion: [''],
      moneda: [''],
      fechaInicio: [''],
      fechaFinal: [''],
      numeroCompra: ['']
    });

    this.compraForm = this.fb.group({
      idCompra: [null],
      numeroCompra: ['', Validators.required],
      idTipoCompra: ['', Validators.required],
      moneda: ['', Validators.required],
      descripcion: ['', Validators.required],
      fechaInicio: ['', Validators.required],
      fechaFinal: ['', Validators.required],
      monto: ['', [Validators.required, Validators.min(0)]]
    });

    this.itemsFormArray = this.fb.array([]);
    this.entregasFormArray = this.fb.array([]);

    // Suscribirse a cambios en el formulario de filtro
    this.filterForm.valueChanges.subscribe(() => {
      this.aplicarFiltros();
    });
  }

  ngOnInit(): void {
    this.loadData();
    this.loadProveedores();
    this.loadServiciosGarantia();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    // Cargar tipos de compra y compras en paralelo
    forkJoin({
      tiposCompra: this.tiposCompraService.getTiposCompra(),
      compras: this.comprasService.getCompras()
    }).subscribe({
      next: (data) => {
        this.tiposCompraList = data.tiposCompra;
        
        // Ahora procesar las compras con los tipos ya cargados
        this.comprasList = data.compras.map(compra => ({
          ...compra,
          tipoCompraDescripcion: this.getTipoCompraDescripcion(compra.idTipoCompra)
        }));
        
        this.comprasFiltradas = [...this.comprasList];
        this.collectionSize = this.comprasFiltradas.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar los datos:', error);
        this.error = 'Error al cargar los datos. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  loadTiposCompra(): void {
    this.tiposCompraService.getTiposCompra().subscribe({
      next: (tiposCompra) => {
        this.tiposCompraList = tiposCompra;
      },
      error: (error) => {
        console.error('Error al cargar los tipos de compra:', error);
        this.error = 'Error al cargar los tipos de compra. Por favor, intente nuevamente.';
      }
    });
  }

  loadCompras(): void {
    this.loading = true;
    this.error = null;
    
    this.comprasService.getCompras().subscribe({
      next: (compras) => {
        this.comprasList = compras.map(compra => ({
          ...compra,
          tipoCompraDescripcion: this.getTipoCompraDescripcion(compra.idTipoCompra)
        }));
        this.comprasFiltradas = [...this.comprasList];
        this.collectionSize = this.comprasFiltradas.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar las compras:', error);
        this.error = 'Error al cargar las compras. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  getTipoCompraDescripcion(idTipoCompra: number): string {
    const tipoCompra = this.tiposCompraList.find(tipo => tipo.idTipoCompra === idTipoCompra);
    return tipoCompra ? tipoCompra.descripcion : 'Tipo no encontrado';
  }

  get pagedCompras(): CompraConTipo[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.comprasFiltradas.slice(startItem, endItem);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.comprasFiltradas.sort((a, b) => {
      let valueA = a[column as keyof CompraConTipo];
      let valueB = b[column as keyof CompraConTipo];

      if (valueA === null || valueA === undefined) valueA = '';
      if (valueB === null || valueB === undefined) valueB = '';

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

  abrirModal(modal: any, compra?: CompraConTipo): void {
    this.activeTab = '1';
    if (compra) {
      this.modoEdicion = true;
      this.compraForm.patchValue({
        idCompra: compra.idCompra,
        numeroCompra: compra.numeroCompra,
        idTipoCompra: compra.idTipoCompra,
        moneda: compra.moneda,
        descripcion: compra.descripcion,
        fechaInicio: compra.fechaInicio,
        fechaFinal: compra.fechaFinal,
        monto: compra.monto
      });
      // Cargar lotes asociados a la compra
      this.lotesService.getLotesByCompra(compra.idCompra).subscribe({
        next: (lotes) => {
          this.lotesDeLaCompra = lotes;
          this.idItemsOriginales = lotes.map(l => l.idItem);
          this.itemsFormArray.clear();
          lotes.forEach(lote => {
            this.itemsFormArray.push(this.fb.group({
              nombreItem: [lote.nombreItem, Validators.required],
              descripcion: [lote.descripcion, Validators.required],
              cantidad: [lote.cantidad, [Validators.required, Validators.min(1)]],
              mesesGarantia: [lote.mesesGarantia, [Validators.required, Validators.min(0)]],
              idProveedor: [lote.idProveedor, Validators.required],
              idServicioGarantia: [lote.idServicioGarantia, Validators.required],
              idItem: [lote.idItem]
            }));
          });
          // Cargar entregas asociadas a los lotes de la compra
          this.entregasFormArray.clear();
          this.idEntregasOriginales = [];
          const entregasObservables = lotes.map(lote => this.entregasService.getEntregasByItem(lote.idItem).toPromise());
          Promise.all(entregasObservables).then(entregasPorLote => {
            const entregas = entregasPorLote.flat().filter(e => !!e);
            this.idEntregasOriginales = entregas.map(e => e.idEntrega!);
            entregas.forEach(entrega => {
              this.entregasFormArray.push(this.fb.group({
                idEntrega: [entrega.idEntrega],
                idItem: [entrega.idItem, Validators.required],
                cantidad: [entrega.cantidad, [Validators.required, Validators.min(1)]],
                descripcion: [entrega.descripcion, Validators.required],
                fechaPedido: [entrega.fechaPedido, Validators.required],
                fechaFinGarantia: [entrega.fechaFinGarantia, Validators.required]
              }));
            });
            this.cdr.detectChanges();
          });
          this.cdr.detectChanges();
        },
        error: () => {
          this.lotesDeLaCompra = [];
          this.idItemsOriginales = [];
          this.idEntregasOriginales = [];
          this.itemsFormArray.clear();
          this.entregasFormArray.clear();
        }
      });
    } else {
      this.modoEdicion = false;
      this.compraForm.reset();
      this.itemsFormArray.clear();
      this.entregasFormArray.clear();
      this.lotesDeLaCompra = [];
    }
    this.cdr.detectChanges();
    this.modalService.open(modal, { size: 'xl' });
  }

  get itemsControls() {
    return (this.itemsFormArray.controls as FormGroup[] || []);
  }

  get entregasControls() {
    return (this.entregasFormArray.controls as FormGroup[] || []);
  }

  agregarItem() {
    this.itemsFormArray.push(this.fb.group({
      nombreItem: ['', Validators.required],
      descripcion: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      mesesGarantia: [0, [Validators.required, Validators.min(0)]],
      idProveedor: [null, Validators.required],
      idServicioGarantia: [null, Validators.required]
    }));
    this.cdr.detectChanges();
  }

  eliminarItem(index: number) {
    this.itemsFormArray.removeAt(index);
    this.cdr.detectChanges();
  }

  agregarEntrega() {
    this.entregasFormArray.push(this.fb.group({
      idItem: [null, Validators.required],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      descripcion: ['', Validators.required],
      fechaPedido: ['', Validators.required],
      fechaFinGarantia: ['', Validators.required]
    }));
  }

  eliminarEntrega(index: number) {
    this.entregasFormArray.removeAt(index);
  }

  guardarCompra(): void {
    if (this.compraForm.valid) {
      const compraData = this.compraForm.value;
      const itemsData = this.itemsFormArray.value;
      const entregasData = this.entregasFormArray.value;
      this.error = null;

      if (this.modoEdicion) {
        if (!compraData.idCompra) {
          this.error = 'Error: ID de compra no válido';
          return;
        }
        // Actualizar compra
        this.comprasService.actualizarCompra(compraData.idCompra, compraData).subscribe({
          next: () => {
            this.guardarItemsYEntregas(compraData.idCompra, itemsData, entregasData);
          },
          error: (error) => {
            this.error = 'Error al actualizar la compra: ' + error.message;
          }
        });
      } else {
        // Crear compra
        const { idCompra, ...nuevaCompra } = compraData;
        this.comprasService.crearCompra(nuevaCompra).subscribe({
          next: (compraCreada) => {
            // compraCreada debe tener idCompra
            this.guardarItemsYEntregas(compraCreada.idCompra, itemsData, entregasData);
          },
          error: (error) => {
            this.error = 'Error al crear la compra: ' + error.message;
          }
        });
      }
    }
  }

  guardarItemsYEntregas(idCompra: number, itemsData: any[], entregasData: any[]) {
    // Si estamos editando, eliminar los ítems que fueron quitados
    if (this.modoEdicion && this.idItemsOriginales.length > 0) {
      const idItemsActuales = itemsData.filter(i => i.idItem).map(i => i.idItem);
      const idItemsAEliminar = this.idItemsOriginales.filter(id => !idItemsActuales.includes(id));
      const deleteObservables = idItemsAEliminar.map(id => this.lotesService.eliminarLote(id).toPromise());
      Promise.all(deleteObservables).catch(() => {}); // No detener el flujo si falla un delete
    }
    // Si estamos editando, eliminar las entregas que fueron quitadas
    if (this.modoEdicion && this.idEntregasOriginales.length > 0) {
      const idEntregasActuales = entregasData.filter(e => e.idEntrega).map(e => e.idEntrega);
      const idEntregasAEliminar = this.idEntregasOriginales.filter(id => !idEntregasActuales.includes(id));
      const deleteEntregasObs = idEntregasAEliminar.map(id => this.entregasService.eliminarEntrega(id).toPromise());
      Promise.all(deleteEntregasObs).catch(() => {});
    }
    // Guardar ítems (lotes)
    const lotesObservables = itemsData.map(item => {
      if (item.idItem) {
        // Actualizar lote existente
        return this.lotesService.actualizarLote(item.idItem, { ...item, idCompra });
      } else {
        // Crear nuevo lote
        return this.lotesService.crearLote({ ...item, idCompra });
      }
    });
    Promise.all(lotesObservables.map(obs => obs.toPromise()))
      .then(lotesGuardados => {
        // Guardar entregas
        const entregasObservables = entregasData.map(entrega => {
          // Buscar el idItem correspondiente
          let idItem = entrega.idItem;
          if (!idItem && entrega.nombreItem) {
            // Buscar por nombre si es necesario
            const lote = lotesGuardados.find(l => l?.nombreItem === entrega.nombreItem);
            idItem = lote?.idItem;
          }
          if (!idItem) return null;
          if (entrega.idEntrega) {
            // Actualizar entrega existente
            return this.entregasService.actualizarEntrega(entrega.idEntrega, { ...entrega, idItem });
          } else {
            // Crear nueva entrega
            return this.entregasService.crearEntrega({ ...entrega, idItem });
          }
        }).filter(Boolean);
        return Promise.all(entregasObservables.filter(obs => !!obs).map(obs => obs!.toPromise()));
      })
      .then(() => {
        this.loadData();
        this.modalService.dismissAll();
        this.error = null;
      })
      .catch(error => {
        this.error = 'Error al guardar ítems o entregas: ' + (error.message || error);
      });
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
    
    this.comprasFiltradas = this.comprasList.filter(compra => {
      let cumpleFiltros = true;

      if (filtros.numeroCompra && compra.numeroCompra) {
        cumpleFiltros = cumpleFiltros && compra.numeroCompra.toLowerCase().includes(filtros.numeroCompra.toLowerCase());
      }
      if (filtros.descripcion && compra.descripcion) {
        cumpleFiltros = cumpleFiltros && 
          compra.descripcion.toLowerCase().includes(filtros.descripcion.toLowerCase());
      }

      if (filtros.moneda && compra.moneda) {
        cumpleFiltros = cumpleFiltros && 
          compra.moneda.toLowerCase().includes(filtros.moneda.toLowerCase());
      }

      if (filtros.fechaInicio && compra.fechaInicio) {
        cumpleFiltros = cumpleFiltros && 
          compra.fechaInicio >= filtros.fechaInicio;
      }

      if (filtros.fechaFinal && compra.fechaFinal) {
        cumpleFiltros = cumpleFiltros && 
          compra.fechaFinal <= filtros.fechaFinal;
      }

      return cumpleFiltros;
    });

    this.collectionSize = this.comprasFiltradas.length;
    this.page = 1;
  }

  eliminarCompra(id: number): void {
    this.compraToDelete = id;
    this.showConfirmDialog = true;
  }

  confirmarEliminacion(): void {
    if (this.compraToDelete) {
      this.comprasService.eliminarCompra(this.compraToDelete).subscribe({
        next: () => {
          this.loadData();
          this.showConfirmDialog = false;
          this.compraToDelete = null;
        },
        error: (error) => {
          console.error('Error al eliminar la compra:', error);
          this.error = 'Error al eliminar la compra. Por favor, intente nuevamente.';
          this.showConfirmDialog = false;
          this.compraToDelete = null;
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.compraToDelete = null;
  }

  formatearMoneda(monto: number, moneda: string): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: moneda
    }).format(monto);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-ES');
  }

  loadProveedores(): void {
    this.proveedoresService.getProveedores().subscribe({
      next: (proveedores) => {
        this.proveedoresList = proveedores;
      },
      error: (error) => {
        console.error('Error al cargar los proveedores:', error);
        this.error = 'Error al cargar los proveedores. Por favor, intente nuevamente.';
      }
    });
  }

  loadServiciosGarantia(): void {
    this.serviciosGarantiaService.getServiciosGarantia().subscribe({
      next: (servicios) => {
        this.serviciosGarantiaList = servicios;
      },
      error: (error) => {
        console.error('Error al cargar los servicios de garantía:', error);
        this.error = 'Error al cargar los servicios de garantía. Por favor, intente nuevamente.';
      }
    });
  }

  get numeroCompraControl(): FormControl {
    return this.filterForm.get('numeroCompra') as FormControl;
  }

  canManagePurchases(): boolean {
    return this.permissionsService.canManagePurchases();
  }
} 