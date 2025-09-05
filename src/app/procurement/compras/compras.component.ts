import { Component, OnInit, ViewEncapsulation, ChangeDetectorRef, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray, FormControl, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { ComprasService, CompraDTO } from '../../services/compras.service';
import { TiposCompraService, TipoDeCompraDTO } from '../../services/tipos-compra.service';
import { forkJoin } from 'rxjs';
import { ProveedoresService, ProveedorDTO } from '../../services/proveedores.service';
// import { ServiciosGarantiaService, ServicioGarantiaDTO } from '../../services/servicios-garantia.service';
import { LotesService, LoteDTO } from '../../services/lotes.service';
import { EntregasService, EntregaDTO } from '../../services/entregas.service';
import { PermissionsService } from '../../services/permissions.service';
import { RemitosService, RemitoDTO } from '../../services/remitos.service';
// import { PliegosService, PliegoDTO } from '../../services/pliegos.service';
import { CurrencyMaskDirective } from '../../shared/directives/currency-mask.directive';

// Importaciones para PDF
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface CompraConTipo extends CompraDTO {
  tipoCompraDescripcion?: string;
  tipoCompraAbreviado?: string;
}

@Component({
  selector: 'app-compras',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, NgbPaginationModule, NgbNavModule, CurrencyMaskDirective],
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
  // serviciosGarantiaList: ServicioGarantiaDTO[] = [];
  lotesDeLaCompra: LoteDTO[] = [];
  idItemsOriginales: number[] = [];
  idEntregasOriginales: number[] = [];
  tipoCompraFiltroActivo: number | null = null;
  compraSeleccionada: CompraConTipo | null = null;
  lotesDetalles: LoteDTO[] = [];
  entregasDetalles: EntregaDTO[] = [];
  isCompactView: boolean = true;
  proveedoresFiltrados: { [key: number]: ProveedorDTO[] } = {};
  // serviciosGarantiaFiltrados: { [key: number]: ServicioGarantiaDTO[] } = {};
  proveedorSearchValues: { [key: number]: string } = {};
  servicioGarantiaSearchValues: { [key: number]: string } = {};
  dropdownProveedoresVisible: { [key: number]: boolean } = {};
  dropdownServiciosGarantiaVisible: { [key: number]: boolean } = {};
  
  // Propiedades para documentos
  documentosCompra: RemitoDTO[] = [];
  
  // Propiedades para pliego (un pliego por compra)
  // pliegoCompra: PliegoDTO | null = null;
  // descripcionPliego: string = '';
  
  // Propiedades para dropdowns de servicio de garantía (también proveedores)
  proveedoresGarantiaFiltrados: { [key: number]: ProveedorDTO[] } = {};
  proveedorGarantiaSearchValues: { [key: number]: string } = {};
  dropdownProveedoresGarantiaVisible: { [key: number]: boolean } = {};

  // Propiedades para documentos (unificadas)
  tipoDocumentoSeleccionado: 'documento' | null = null; // Solo documento
  documentoSeleccionado: File | null = null;
  descripcionDocumento: string = '';
  subiendoDocumento: boolean = false;

  @ViewChild('detallesModal') detallesModal!: TemplateRef<any>;

  constructor(
    private comprasService: ComprasService,
    private tiposCompraService: TiposCompraService,
    private fb: FormBuilder,
    private modalService: NgbModal,
    private proveedoresService: ProveedoresService,
    // private serviciosGarantiaService: ServiciosGarantiaService,
    private lotesService: LotesService,
    private entregasService: EntregasService,
    private cdr: ChangeDetectorRef,
    private permissionsService: PermissionsService,
    private remitosService: RemitosService
    // private pliegosService: PliegosService // Eliminar
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
      moneda: ['USD'], // Valor por defecto USD
      descripcion: [''],
      fechaInicio: [''],
      fechaFinal: [''],
      monto: [''], // Solo para modo edición
      valorDolar: ['', Validators.required], // Nuevo campo requerido
      ano: [new Date().getFullYear(), Validators.required]
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
    this.loadProveedores(); // Asegurar que se ejecute primero
  }

  loadData(): Promise<void> {
    return new Promise((resolve, reject) => {
    this.loading = true;
    this.error = null;

    forkJoin({
      tiposCompra: this.tiposCompraService.getTiposCompra(),
      compras: this.comprasService.getCompras()
    }).subscribe({
      next: (data) => {
        this.tiposCompraList = data.tiposCompra;
        
        // Ahora procesar las compras con los tipos ya cargados
        this.comprasList = data.compras.map(compra => ({
          ...compra,
          tipoCompraDescripcion: this.getTipoCompraDescripcion(compra.idTipoCompra),
          tipoCompraAbreviado: this.getTipoCompraAbreviado(compra.idTipoCompra)
        }));
        
        this.comprasFiltradas = [...this.comprasList];
        this.collectionSize = this.comprasFiltradas.length;
        this.loading = false;
          resolve();
      },
      error: (error) => {
        console.error('Error al cargar los datos:', error);
        this.error = 'Error al cargar los datos. Por favor, intente nuevamente.';
        this.loading = false;
          reject(error);
      }
      });
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
          tipoCompraDescripcion: this.getTipoCompraDescripcion(compra.idTipoCompra),
          tipoCompraAbreviado: this.getTipoCompraAbreviado(compra.idTipoCompra)
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

  getTipoCompraAbreviado(idTipoCompra: number): string {
    const tipoCompra = this.tiposCompraList.find(tipo => tipo.idTipoCompra === idTipoCompra);
    return tipoCompra ? (tipoCompra.abreviado || '') : '';
  }

  getNombreCompraFormateado(compra: CompraConTipo): string {
    // Obtener el abreviado directamente del tipo de compra
    const abreviado = this.getTipoCompraAbreviado(compra.idTipoCompra);
    const numero = compra.numeroCompra || '';
    const ano = compra.ano && compra.ano > 0 ? compra.ano.toString() : '';
    
    if (!abreviado && !numero && !ano) {
      return 'Sin información';
    }
    
    // Construir el nombre formateado: [abreviado] [número] / [año]
    let nombreFormateado = '';
    
    if (abreviado) {
      nombreFormateado += abreviado;
    }
    
    if (numero) {
      if (nombreFormateado) nombreFormateado += ' ';
      nombreFormateado += numero;
    }
    
    if (ano) {
      nombreFormateado += ` / ${ano}`;
    }
    
    return nombreFormateado || 'Sin información';
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
        monto: compra.monto,
        valorDolar: compra.valorDolar, // Nuevo campo
        ano: compra.ano && compra.ano > 0 ? compra.ano : null
      });
      
      // El monto se formateará automáticamente por la directive appCurrencyMask
      // Cargar lotes asociados a la compra
      this.lotesService.getLotesByCompra(compra.idCompra).subscribe({
        next: (lotes) => {
          this.lotesDeLaCompra = lotes;
          this.idItemsOriginales = lotes.map(l => l.idItem);
          this.itemsFormArray.clear();
          lotes.forEach(lote => {
            this.itemsFormArray.push(this.fb.group({
              nombreItem: [lote.nombreItem, Validators.required],
              descripcion: [lote.descripcion],
              cantidad: [lote.cantidad, [Validators.required, Validators.min(1)]],
              mesesGarantia: [lote.mesesGarantia, [Validators.required, Validators.min(0)]],
              idProveedor: [lote.idProveedor, Validators.required],
              idServicioGarantia: [lote.idServicioGarantia, Validators.required],
              idItem: [lote.idItem],
              precioUnitario: [lote.precioUnitario, [Validators.required, Validators.min(0.01)]],
              monedaPrecio: [lote.monedaPrecio || 'USD', Validators.required],
              porcentajeIva: [lote.porcentajeIva || 22.00, [Validators.required, Validators.min(0), Validators.max(100)]]
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
                descripcion: [entrega.descripcion],
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
      
        // Cargar documentos de la compra para el modo edición
  this.cargarDocumentosCompra(compra.idCompra);
      
      // Cargar pliego de la compra para el modo edición
      // this.cargarPliegoCompra(compra.idCompra);
    } else {
      this.modoEdicion = false;
      this.compraForm.reset();
      // En modo creación, no mostrar el campo monto
      this.compraForm.patchValue({
        ano: new Date().getFullYear(),
        moneda: 'USD', // Establecer USD como valor por defecto
        valorDolar: null // Limpiar valor dólar
      });
      this.itemsFormArray.clear();
      this.entregasFormArray.clear();
      this.lotesDeLaCompra = [];
      this.documentosCompra = [];
      this.descripcionDocumento = '';
      // this.pliegoCompra = null;
      // this.descripcionPliego = '';
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
      descripcion: [''],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      mesesGarantia: [0, [Validators.min(0)]],
      idProveedor: [null],
      idServicioGarantia: [null],
      precioUnitario: [null], // Sin validación requerida
      monedaPrecio: ['USD'], // Sin validación requerida
      porcentajeIva: [22.00, [Validators.required, Validators.min(0), Validators.max(100)]]
    }));
    this.cdr.detectChanges();
  }

  eliminarItem(index: number) {
    this.itemsFormArray.removeAt(index);
    this.cdr.detectChanges();
  }

  agregarEntrega() {
    const hoy = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    
    console.log('Agregando nueva entrega con fecha:', hoy);
    
    this.entregasFormArray.push(this.fb.group({
      idItem: [null, Validators.required],
      cantidad: [1, [Validators.required, Validators.min(1)]],
      descripcion: [''],
      fechaPedido: [hoy, Validators.required],
      fechaFinGarantia: ['', Validators.required]
    }));
    
    console.log('Entrega agregada, total de entregas:', this.entregasFormArray.length);
  }

  calcularFechaFinGarantia(index: number): void {
    console.log('Calculando fecha fin garantía para entrega:', index);
    
    const entregaControl = this.entregasFormArray.at(index);
    const idItem = entregaControl.get('idItem')?.value;
    const nombreItem = entregaControl.get('nombreItem')?.value;
    const fechaPedido = entregaControl.get('fechaPedido')?.value;
    
    console.log('Valores de la entrega:', { idItem, nombreItem, fechaPedido });
    
    if ((idItem || nombreItem) && fechaPedido) {
      // Buscar el ítem seleccionado para obtener los meses de garantía
      let itemEncontrado = null;
      
      if (this.modoEdicion) {
        // En modo edición, buscar en lotesDeLaCompra
        itemEncontrado = this.lotesDeLaCompra.find(lote => lote.idItem === idItem);
      } else {
        // En modo creación, buscar en itemsControls
        itemEncontrado = this.itemsControls.find(itemControl => 
          itemControl.get('nombreItem')?.value === nombreItem
        );
      }
      
      console.log('Ítem encontrado:', itemEncontrado);
      
      if (itemEncontrado) {
        let mesesGarantia = 0;
        
        if (this.modoEdicion) {
          // En modo edición, obtener de lotesDeLaCompra
          const lote = itemEncontrado as LoteDTO;
          mesesGarantia = lote.mesesGarantia || 0;
        } else {
          // En modo creación, obtener de itemsControls
          const itemControl = itemEncontrado as FormGroup;
          mesesGarantia = itemControl.get('mesesGarantia')?.value || 0;
        }
        
        console.log('Meses de garantía:', mesesGarantia);
        
        if (mesesGarantia > 0) {
          // Calcular fecha de fin de garantía
          const fechaInicio = new Date(fechaPedido);
          const fechaFin = new Date(fechaInicio);
          fechaFin.setMonth(fechaFin.getMonth() + mesesGarantia);
          
          // Formatear a YYYY-MM-DD
          const fechaFinFormateada = fechaFin.toISOString().split('T')[0];
          
          console.log('Fecha fin garantía calculada:', fechaFinFormateada);
          
          // Actualizar el campo fechaFinGarantia
          entregaControl.get('fechaFinGarantia')?.setValue(fechaFinFormateada);
          
          // Forzar detección de cambios
          this.cdr.detectChanges();
        }
      }
    }
  }

  eliminarEntrega(index: number) {
    this.entregasFormArray.removeAt(index);
  }

  guardarCompra(): void {
    if (this.compraForm.valid) {
      // Validar que el valor del dólar esté presente
      const valorDolar = this.compraForm.get('valorDolar')?.value;
      if (!valorDolar || valorDolar <= 0) {
        this.error = 'El valor del dólar es requerido y debe ser mayor a 0';
        return;
      }
      
      // Solo validar ítems si existen
      const itemsData = this.itemsFormArray.value;
      if (itemsData.length > 0) {
        // Validar que todos los ítems tengan precio unitario
        for (let i = 0; i < itemsData.length; i++) {
          const item = itemsData[i];
          if (!item.precioUnitario || item.precioUnitario <= 0) {
            this.error = `El ítem "${item.nombreItem}" debe tener un precio unitario válido`;
            return;
          }
          if (!item.monedaPrecio) {
            this.error = `El ítem "${item.nombreItem}" debe tener una moneda de precio especificada`;
            return;
          }
        }
      }
      
      // Calcular el monto total con IVA antes de guardar (será 0 si no hay ítems)
      const montoTotalConIva = this.calcularMontoTotalConIva();
      this.compraForm.patchValue({ monto: montoTotalConIva });
      
      const compraData = this.compraForm.value;
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
    } else {
      this.error = 'Por favor, complete todos los campos requeridos';
    }
  }

  guardarItemsYEntregas(idCompra: number, itemsData: any[], entregasData: any[]) {
    console.log('🔍 DEBUG - Iniciando guardado...');
    console.log('🔍 DEBUG - ID Compra:', idCompra);
    console.log('🔍 DEBUG - Items a enviar:', JSON.stringify(itemsData, null, 2));
    console.log('🔍 DEBUG - Entregas a enviar:', JSON.stringify(entregasData, null, 2));
    
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
      const itemData = { ...item, idCompra };
      console.log('🔍 DEBUG - Enviando lote:', JSON.stringify(itemData, null, 2));
      
      if (item.idItem) {
        // Actualizar lote existente
        console.log('🔍 DEBUG - Actualizando lote existente ID:', item.idItem);
        return this.lotesService.actualizarLote(item.idItem, itemData);
      } else {
        // Crear nuevo lote
        console.log('🔍 DEBUG - Creando nuevo lote');
        return this.lotesService.crearLote(itemData);
      }
    });
    
    Promise.all(lotesObservables.map(obs => obs.toPromise()))
      .then(lotesGuardados => {
        console.log('🔍 DEBUG - Lotes guardados exitosamente:', lotesGuardados);
        
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
        // Cerrar el modal siempre que la operación sea exitosa
        this.modalService.dismissAll();
        this.error = null;
        
        // Recargar datos en segundo plano
        this.loadData().catch(error => {
          console.warn('No se pudieron recargar los datos, pero la compra se guardó correctamente:', error);
        });
      })
      .catch(error => {
        console.error('🔍 DEBUG - Error completo:', error);
        console.error('🔍 DEBUG - Error response:', error.error);
        console.error('🔍 DEBUG - Error status:', error.status);
        console.error('🔍 DEBUG - Error message:', error.message);
        console.error('🔍 DEBUG - Error URL:', error.url);
        
        // Intentar obtener más detalles del error
        if (error.error) {
          console.error('🔍 DEBUG - Error details:', error.error);
        }
        
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

  formatearMoneda(monto: number | null | undefined, moneda: string | null | undefined): string {
    if (monto === null || monto === undefined || monto === 0) {
      return 'No definido';
    }
    
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto);
  }

  // Método de formateo de monto reemplazado por la directive appCurrencyMask

  formatearMontoOnBlur(event: any): void {
    const input = event.target;
    let value = input.value;
    
    // Si el campo está vacío, limpiarlo completamente
    if (!value.trim()) {
      input.value = '';
      this.compraForm.patchValue({ monto: null });
      return;
    }
    
    // Remover todos los caracteres no numéricos
    value = value.replace(/[^\d]/g, '');
    
    // Si no hay valor, limpiar completamente
    if (!value) {
      input.value = '';
      this.compraForm.patchValue({ monto: null });
      return;
    }
    
    // Formatear el número correctamente - FORMATO ESPAÑOL
    let formateado = '';
    
    if (value.length === 1) {
      formateado = '0,0' + value;
    } else if (value.length === 2) {
      formateado = '0,' + value;
    } else {
      const parteEntera = value.slice(0, -2);
      const parteDecimal = value.slice(-2);
      
      // Formatear parte entera con separadores de miles (puntos)
      let parteEnteraFormateada = parteEntera;
      if (parteEntera.length > 3) {
        let result = '';
        for (let i = 0; i < parteEntera.length; i++) {
          if (i > 0 && (parteEntera.length - i) % 3 === 0) {
            result += '.';
          }
          result += parteEntera[i];
        }
        parteEnteraFormateada = result;
      }
      
      // Construir el formato final: parteEntera,parteDecimal
      formateado = parteEnteraFormateada + ',' + parteDecimal;
    }
    
    // Actualizar el input directamente para asegurar que se vea el formato
    input.value = formateado;
    
    // Actualizar el FormControl con el valor numérico (para el backend)
    // Convertir de formato español a número decimal
    const monto = parseFloat(value) / 100;
    this.compraForm.patchValue({ monto: monto });
  }


  // Método de verificación de borrado reemplazado por la directive appCurrencyMask

  formatearFecha(fecha: string | null | undefined): string {
    if (!fecha) {
      return 'No definida';
    }
    
    try {
    const date = new Date(fecha);
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      
    const dia = date.getDate().toString().padStart(2, '0');
    const mes = (date.getMonth() + 1).toString().padStart(2, '0');
    const año = date.getFullYear();
    return `${dia}/${mes}/${año}`;
    } catch (error) {
      return 'Fecha inválida';
    }
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

  // loadServiciosGarantia(): void {
  //   this.serviciosGarantiaService.getServiciosGarantia().subscribe({
  //     next: (servicios) => {
  //       this.serviciosGarantiaList = servicios;
  //     },
  //     error: (error) => {
  //       console.error('Error al cargar los servicios de garantía:', error);
  //       this.error = 'Error al cargar los servicios de garantía. Por favor, intente nuevamente.';
  //     }
  //   });
  // }

  get numeroCompraControl(): FormControl {
    return this.filterForm.get('numeroCompra') as FormControl;
  }

  canManagePurchases(): boolean {
    return this.permissionsService.canManagePurchases();
  }

  getMonedaCount(moneda: string): number {
    return this.comprasList.filter(compra => compra.moneda === moneda).length;
  }

  getTipoCompraCount(idTipoCompra: number): number {
    return this.comprasList.filter(compra => compra.idTipoCompra === idTipoCompra).length;
  }

  filtrarPorTipoCompra(idTipoCompra: number | null): void {
    this.tipoCompraFiltroActivo = idTipoCompra;
    
    if (idTipoCompra === null) {
      // Mostrar todas las compras
      this.comprasFiltradas = [...this.comprasList];
    } else {
      // Filtrar por tipo de compra específico
      this.comprasFiltradas = this.comprasList.filter(compra => compra.idTipoCompra === idTipoCompra);
    }
    this.collectionSize = this.comprasFiltradas.length;
    this.page = 1; // Resetear a la primera página
  }

  getTipoColor(index: number): string {
    const colors = [
      '#0369a1', // Azul
      '#92400e', // Naranja
      '#00695c', // Verde
      '#7b1fa2', // Púrpura
      '#d32f2f', // Rojo
      '#388e3c', // Verde oscuro
      '#f57c00', // Naranja oscuro
      '#6a1b9a', // Púrpura oscuro
      '#2e7d32', // Verde
      '#c62828'  // Rojo oscuro
    ];
    return colors[index % colors.length];
  }

  getTipoBgColor(index: number): string {
    const bgColors = [
      '#e0f2fe', // Azul claro
      '#fef3c7', // Naranja claro
      '#e0f7fa', // Verde claro
      '#f3e5f5', // Púrpura claro
      '#ffebee', // Rojo claro
      '#e8f5e9', // Verde oscuro claro
      '#fff3e0', // Naranja oscuro claro
      '#f3e5f5', // Púrpura oscuro claro
      '#e8f6f3', // Verde claro
      '#ffebee'  // Rojo oscuro claro
    ];
    return bgColors[index % bgColors.length];
  }

  getTipoBorderColor(index: number): string {
    const borderColors = [
      '#bae6fd', // Azul
      '#fde68a', // Naranja
      '#b2ebf2', // Verde
      '#e1bee7', // Púrpura
      '#ffcdd2', // Rojo
      '#c8e6c9', // Verde oscuro
      '#ffe0b2', // Naranja oscuro
      '#e1bee7', // Púrpura oscuro
      '#c8e6c9', // Verde
      '#ffcdd2'  // Rojo oscuro
    ];
    return borderColors[index % borderColors.length];
  }

  verDetallesCompra(compra: CompraConTipo): void {
    this.compraSeleccionada = compra;
    
    // Asegurar que los proveedores estén cargados
    if (this.proveedoresList.length === 0) {
      this.loadProveedores();
    }
    
    // Cargar lotes de la compra
    this.lotesService.getLotesByCompra(compra.idCompra).subscribe({
      next: (lotes) => {
        this.lotesDetalles = lotes;
        
        // Solo cargar entregas si hay lotes
        if (lotes.length > 0) {
        const entregasObservables = lotes.map(lote => 
          this.entregasService.getEntregasByItem(lote.idItem).toPromise()
        );
        
        Promise.all(entregasObservables).then(entregasPorLote => {
          this.entregasDetalles = entregasPorLote.flat().filter(e => !!e);
          this.cdr.detectChanges();
        });
        } else {
          this.entregasDetalles = [];
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error al cargar los detalles de la compra:', error);
        this.lotesDetalles = [];
        this.entregasDetalles = [];
        this.cdr.detectChanges();
      }
    });
    
    // Cargar documentos de la compra
    this.cargarDocumentosCompra(compra.idCompra);
    
    
    // Abrir el modal de detalles
    this.modalService.open(this.detallesModal, { 
      size: 'xl', 
      backdrop: 'static',
      keyboard: false,
      centered: true
    });
  }

  getProveedorNombre(idProveedor: number | null): string {
    // Solo verificar si es null o 0 (que es falsy)
    if (!idProveedor) {
      return 'Sin especificar';
    }
    
    // Buscar en la lista local en lugar de hacer llamada HTTP
    const proveedor = this.proveedoresList.find(p => p.idProveedores === idProveedor);
    return proveedor ? proveedor.nombreComercial : 'No disponible';
  }

  getServicioGarantiaNombre(idServicio: number | null): string {
    // Solo verificar si es null o 0 (que es falsy)
    if (!idServicio) {
      return 'Sin especificar';
    }
    
    // Buscar en la lista local en lugar de hacer llamada HTTP
    const proveedor = this.proveedoresList.find(p => p.idProveedores === idServicio);
    return proveedor ? proveedor.nombreComercial : 'No disponible';
  }

  getLoteNombre(idItem: number): string {
    const lote = this.lotesDetalles.find(l => l.idItem === idItem);
    return lote ? lote.nombreItem : 'No disponible';
  }

  toggleCompactView(): void {
    this.isCompactView = !this.isCompactView;
  }

  // Métodos para búsqueda en dropdowns
  filtrarProveedores(event: any, index: number): void {
    const searchTerm = event.target.value.toLowerCase();
    this.proveedorSearchValues[index] = searchTerm;
    
    if (!searchTerm) {
      this.proveedoresFiltrados[index] = [...this.proveedoresList];
    } else {
      this.proveedoresFiltrados[index] = this.proveedoresList.filter(proveedor =>
        proveedor.nombreComercial.toLowerCase().includes(searchTerm) ||
        proveedor.nombre.toLowerCase().includes(searchTerm)
      );
    }
  }

  // filtrarServiciosGarantia(event: any, index: number): void {
  //   const searchTerm = event.target.value.toLowerCase();
  //   this.servicioGarantiaSearchValues[index] = searchTerm;
  //   
  //   if (!searchTerm) {
  //     this.serviciosGarantiaFiltrados[index] = [...this.serviciosGarantiaList];
  //   } else {
  //     this.serviciosGarantiaFiltrados[index] = this.serviciosGarantiaList.filter(servicio =>
  //       servicio.nombreComercial.toLowerCase().includes(searchTerm) ||
  //       servicio.nombre.toLowerCase().includes(searchTerm)
  //     );
  //   }
  // }

  getProveedoresFiltrados(index: number): ProveedorDTO[] {
    if (!this.proveedoresFiltrados[index]) {
      this.proveedoresFiltrados[index] = [...this.proveedoresList];
    }
    return this.proveedoresFiltrados[index];
  }

  // getServiciosGarantiaFiltrados(index: number): ServicioGarantiaDTO[] {
  //   if (!this.serviciosGarantiaFiltrados[index]) {
  //     this.serviciosGarantiaFiltrados[index] = [...this.serviciosGarantiaList];
  //   }
  //   return this.serviciosGarantiaFiltrados[index];
  // }

  getProveedorSearchValue(index: number): string {
    return this.proveedorSearchValues[index] || '';
  }

  // getServicioGarantiaSearchValue(index: number): string {
  //   return this.servicioGarantiaSearchValues[index] || '';
  // }

  // Métodos para manejar dropdowns integrados
  mostrarDropdownProveedores(index: number): void {
    this.dropdownProveedoresVisible[index] = true;
    this.proveedoresFiltrados[index] = [...this.proveedoresList];
  }

  ocultarDropdownProveedores(index: number): void {
    setTimeout(() => {
      this.dropdownProveedoresVisible[index] = false;
    }, 200);
  }

  // mostrarDropdownServiciosGarantia(index: number): void {
  //   this.dropdownServiciosGarantiaVisible[index] = true;
  //   this.serviciosGarantiaFiltrados[index] = [...this.serviciosGarantiaList];
  // }

  ocultarDropdownServiciosGarantia(index: number): void {
    setTimeout(() => {
      this.dropdownServiciosGarantiaVisible[index] = false;
    }, 200);
  }

  isDropdownProveedoresVisible(index: number): boolean {
    return this.dropdownProveedoresVisible[index] || false;
  }

  isDropdownServiciosGarantiaVisible(index: number): boolean {
    return this.dropdownServiciosGarantiaVisible[index] || false;
  }

  seleccionarProveedor(proveedor: ProveedorDTO, index: number): void {
    const itemControl = this.itemsFormArray.at(index);
    itemControl.patchValue({
      idProveedor: proveedor.idProveedores
    });
    this.proveedorSearchValues[index] = proveedor.nombreComercial;
    this.dropdownProveedoresVisible[index] = false;
  }

  seleccionarProveedorGarantia(proveedor: ProveedorDTO, index: number): void {
    const itemControl = this.itemsFormArray.at(index);
    itemControl.patchValue({
      idServicioGarantia: proveedor.idProveedores
    });
    this.proveedorGarantiaSearchValues[index] = proveedor.nombreComercial;
    this.dropdownProveedoresGarantiaVisible[index] = false;
  }

  getProveedorDisplayValue(index: number): string {
    const itemControl = this.itemsFormArray.at(index);
    const idProveedor = itemControl.get('idProveedor')?.value;
    if (idProveedor) {
      const proveedor = this.proveedoresList.find(p => p.idProveedores === idProveedor);
      return proveedor ? proveedor.nombreComercial : '';
    }
    return this.proveedorSearchValues[index] || '';
  }

  getProveedorGarantiaDisplayValue(index: number): string {
    const itemControl = this.itemsFormArray.at(index);
    const idServicioGarantia = itemControl.get('idServicioGarantia')?.value;
    if (idServicioGarantia) {
      const proveedor = this.proveedoresList.find(p => p.idProveedores === idServicioGarantia);
      return proveedor ? proveedor.nombreComercial : '';
    }
    return this.servicioGarantiaSearchValues[index] || '';
  }

  // Métodos para documentos
  cargarDocumentosCompra(idCompra: number): void {
    this.remitosService.getRemitosByCompra(idCompra).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.documentosCompra = response.data;
        } else {
          this.documentosCompra = [];
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al cargar documentos:', error);
        this.documentosCompra = [];
      }
    });
  }

  // Método onArchivoSeleccionado reemplazado por onDocumentoSeleccionado

  subirDocumento(): void {
    // Obtener idCompra del formulario si no hay compraSeleccionada
    const idCompra = this.compraSeleccionada?.idCompra || this.compraForm.get('idCompra')?.value;
    
    console.log('Datos para subir documento:', {
      documentoSeleccionado: this.documentoSeleccionado,
      tipoDocumentoSeleccionado: this.tipoDocumentoSeleccionado,
      idCompra: idCompra,
      compraSeleccionada: this.compraSeleccionada
    });
    
    if (!this.documentoSeleccionado) {
      this.error = 'Debe seleccionar un archivo';
      return;
    }
    
    if (!idCompra) {
      this.error = 'No se puede identificar la compra';
      return;
    }

    if (!this.descripcionDocumento || this.descripcionDocumento.trim().length === 0) {
      this.error = 'Debe agregar una descripción para el documento';
      return;
    }

    this.subiendoDocumento = true;
    this.error = null;

    // Solo subir como documento
    this.remitosService.subirRemito(
      idCompra, 
      this.documentoSeleccionado, 
      this.descripcionDocumento || undefined
    ).subscribe({
      next: (response) => {
        if (response.success) {
          // Limpiar formulario
          this.documentoSeleccionado = null;
          this.descripcionDocumento = '';
          this.tipoDocumentoSeleccionado = null;
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (fileInput) fileInput.value = '';
          
          // Recargar documentos
          this.cargarDocumentosCompra(idCompra);
          
          this.subiendoDocumento = false;
        } else {
          this.error = response.message || 'Error al subir documento';
          this.subiendoDocumento = false;
        }
      },
      error: (error) => {
        console.error('Error al subir documento:', error);
        this.error = 'Error al subir documento';
        this.subiendoDocumento = false;
      }
    });
  }



  formatearTamanoArchivo(bytes: number): string {
    return this.remitosService.formatearTamaño(bytes);
  }

  getIconoArchivo(tipoArchivo: string): string {
    return this.remitosService.getIconoArchivo(tipoArchivo);
  }

  esTipoImagen(tipoArchivo: string): boolean {
    return this.remitosService.esTipoImagen(tipoArchivo);
  }



  

  // Método para exportar a PDF
  async exportarAPDF(): Promise<void> {
    try {
      // Deshabilitar el botón durante la exportación
      const exportButton = document.querySelector('.export-pdf-btn') as HTMLButtonElement;
      if (exportButton) {
        exportButton.disabled = true;
        exportButton.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i><span>Generando PDF...</span>';
      }

      // Verificar que tenemos la compra seleccionada
      if (!this.compraSeleccionada) {
        this.error = 'No hay compra seleccionada para exportar';
        return;
      }

      // Crear el contenido del PDF
      const pdfContent = this.generarContenidoPDF();
      
      // Generar y descargar el PDF
      await this.generarPDF(pdfContent);

      // Restaurar el botón
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.innerHTML = '<i class="fas fa-file-pdf me-1"></i><span>Exportar PDF</span>';
      }

    } catch (error) {
      console.error('Error al exportar PDF:', error);
      this.error = 'Error al generar el PDF. Por favor, intente nuevamente.';
      
      // Restaurar el botón en caso de error
      const exportButton = document.querySelector('.export-pdf-btn') as HTMLButtonElement;
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.innerHTML = '<i class="fas fa-file-pdf me-1"></i><span>Exportar PDF</span>';
      }
    }
  }

  private generarContenidoPDF(): string {
    if (!this.compraSeleccionada) return '';

    const compra = this.compraSeleccionada;
    const nombreCompra = this.getNombreCompraFormateado(compra);
    const montoFormateado = this.formatearMoneda(compra.monto || 0, compra.moneda || 'USD');
    const fechaInicio = this.formatearFecha(compra.fechaInicio || '');
    const fechaFinal = this.formatearFecha(compra.fechaFinal || '');
    const tipoCompra = this.getTipoCompraDescripcion(compra.idTipoCompra || 0);

    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #41A1AF; padding-bottom: 15px;">
          <h1 style="color: #2c3e50; margin: 0; font-size: 20px;">${nombreCompra}</h1>
          <p style="color: #6c757d; margin: 8px 0 0 0; font-size: 14px;">${compra.descripcion || ''}</p>
          <div style="margin-top: 12px;">
            <span style="background: #e0f2fe; color: #0369a1; padding: 6px 12px; border-radius: 15px; font-weight: bold; font-size: 12px;">
              ${compra.moneda || 'USD'}
            </span>
            <span style="margin-left: 12px; font-size: 16px; font-weight: bold; color: #2c3e50;">
              ${montoFormateado}
            </span>
          </div>
        </div>

        <div style="margin-bottom: 25px;">
          <h2 style="color: #2c3e50; font-size: 16px; border-bottom: 1px solid #e9ecef; padding-bottom: 8px; margin-bottom: 12px;">
            <i class="fas fa-info-circle"></i> Información de la Compra
          </h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #e9ecef;">
              <strong style="color: #495057; font-size: 12px;">Tipo de Compra:</strong><br>
              <span style="color: #2c3e50; font-size: 13px;">${tipoCompra}</span>
            </div>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #e9ecef;">
              <strong style="color: #495057; font-size: 12px;">Número:</strong><br>
              <span style="color: #2c3e50; font-size: 13px;">${compra.numeroCompra || 'No disponible'}</span>
            </div>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #e9ecef;">
              <strong style="color: #495057; font-size: 12px;">Año:</strong><br>
              <span style="color: #2c3e50; font-size: 13px;">${compra.ano || 'No disponible'}</span>
            </div>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #e9ecef;">
              <strong style="color: #495057; font-size: 12px;">Fecha Apertura:</strong><br>
              <span style="color: #2c3e50; font-size: 13px;">${fechaInicio}</span>
            </div>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #e9ecef;">
              <strong style="color: #495057; font-size: 12px;">Fecha Adjudicación:</strong><br>
              <span style="color: #2c3e50; font-size: 13px;">${fechaFinal}</span>
            </div>
          </div>
        </div>
    `;

    // Agregar ítems si existen
    if (this.lotesDetalles.length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2c3e50; font-size: 18px; border-bottom: 1px solid #e9ecef; padding-bottom: 10px;">
            <i class="fas fa-box"></i> Ítems de la Compra (${this.lotesDetalles.length})
          </h2>
          <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead style="background: #f8f9fa;">
                <tr>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; color: #495057;">Ítem</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #495057;">Cantidad</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #495057;">Garantía</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; color: #495057;">Proveedor</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; color: #495057;">Servicio</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; color: #495057;">Obs.</th>
                </tr>
              </thead>
              <tbody>
      `;

      this.lotesDetalles.forEach((lote, index) => {
        html += `
          <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #2c3e50;">${lote.nombreItem}</td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #2c3e50;">${lote.cantidad}</td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #2c3e50;">${lote.mesesGarantia} meses</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #2c3e50;">${this.getProveedorNombre(lote.idProveedor)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #2c3e50;">${this.getServicioGarantiaNombre(lote.idServicioGarantia)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #2c3e50;">${lote.descripcion || '-'}</td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Agregar entregas si existen
    if (this.entregasDetalles.length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2c3e50; font-size: 18px; border-bottom: 1px solid #e9ecef; padding-bottom: 10px;">
            <i class="fas fa-truck"></i> Entregas (${this.entregasDetalles.length})
          </h2>
          <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead style="background: #f8f9fa;">
                <tr>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; color: #495057;">Ítem</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #495057;">Cantidad</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #495057;">Fecha Entrega</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #495057;">Fin Garantía</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; color: #495057;">Obs.</th>
                </tr>
              </thead>
              <tbody>
      `;

      this.entregasDetalles.forEach((entrega, index) => {
        html += `
          <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #2c3e50;">${this.getLoteNombre(entrega.idItem)}</td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #2c3e50;">${entrega.cantidad}</td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #2c3e50;">${this.formatearFecha(entrega.fechaPedido)}</td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #2c3e50;">${this.formatearFecha(entrega.fechaFinGarantia)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #2c3e50;">${entrega.descripcion || '-'}</td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Agregar documentos si existen
    if (this.documentosCompra.length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2c3e50; font-size: 18px; border-bottom: 1px solid #e9ecef; padding-bottom: 10px;">
            <i class="fas fa-file-alt"></i> Documentos de Entrega (${this.documentosCompra.length})
          </h2>
          <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead style="background: #f8f9fa;">
                <tr>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; color: #495057;">Archivo</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #495057;">Tamaño</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #495057;">Fecha</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; color: #495057;">Descripción</th>
                </tr>
              </thead>
              <tbody>
      `;

      this.documentosCompra.forEach((documento, index) => {
        html += `
          <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #2c3e50;">${documento.nombreArchivoOriginal}</td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #495057;">${this.formatearTamanoArchivo(documento.tamanoArchivo)}</td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e9ecef; color: #495057;">${this.formatearFecha(documento.fechaCreacion)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e9ecef; color: #2c3e50;">${documento.descripcion || '-'}</td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }


    // Cerrar el HTML
    html += `
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 12px;">
          <p>Documento generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}</p>
          <p>Sistema Cerbero - Gestión de Compras</p>
        </div>
      </div>
    `;

    return html;
  }

  private async generarPDF(htmlContent: string): Promise<void> {
    try {
      // Crear un elemento temporal para renderizar el HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.backgroundColor = 'white';
      document.body.appendChild(tempDiv);

      // Esperar a que el contenido se renderice
      await new Promise(resolve => setTimeout(resolve, 100));

      // Convertir HTML a canvas usando html2canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2, // Mejor calidad
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: tempDiv.scrollHeight
      });

      // Crear el PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Calcular dimensiones
      const imgWidth = 210; // A4 width en mm
      const pageHeight = 295; // A4 height en mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0; // Posición inicial

      // Agregar primera página
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Agregar páginas adicionales si es necesario
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Descargar el PDF
      const fileName = `compra_${this.compraSeleccionada?.numeroCompra || 'detalles'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

      // Limpiar
      document.body.removeChild(tempDiv);
      
      // Mostrar mensaje de éxito
      this.error = null;
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      throw new Error('Error al generar el PDF. Por favor, intente nuevamente.');
    }
  }

  // Métodos separados para el dropdown del servicio de garantía
  filtrarProveedoresGarantia(event: any, index: number): void {
    const searchTerm = event.target.value.toLowerCase();
    this.proveedorGarantiaSearchValues[index] = searchTerm;
    
    if (!searchTerm) {
      this.proveedoresGarantiaFiltrados[index] = [...this.proveedoresList];
    } else {
      this.proveedoresGarantiaFiltrados[index] = this.proveedoresList.filter(proveedor =>
        proveedor.nombreComercial.toLowerCase().includes(searchTerm) ||
        proveedor.nombre.toLowerCase().includes(searchTerm)
      );
    }
  }

  getProveedoresGarantiaFiltrados(index: number): ProveedorDTO[] {
    if (!this.proveedoresGarantiaFiltrados[index]) {
      this.proveedoresGarantiaFiltrados[index] = [...this.proveedoresList];
    }
    return this.proveedoresGarantiaFiltrados[index];
  }

  mostrarDropdownProveedoresGarantia(index: number): void {
    this.dropdownProveedoresGarantiaVisible[index] = true;
    this.proveedoresGarantiaFiltrados[index] = [...this.proveedoresList];
  }

  ocultarDropdownProveedoresGarantia(index: number): void {
    setTimeout(() => {
      this.dropdownProveedoresGarantiaVisible[index] = false;
    }, 200);
  }

  isDropdownProveedoresGarantiaVisible(index: number): boolean {
    return this.dropdownProveedoresGarantiaVisible[index] || false;
  }

  // Métodos para documentos unificados
  agregarDocumento(): void {
    this.tipoDocumentoSeleccionado = 'documento';
    this.documentoSeleccionado = null;
    this.descripcionDocumento = '';
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    
    this.error = null;
  }

  onDocumentoSeleccionado(event: any): void {
    const archivo = event.target.files[0];
    
    if (archivo) {
      const validacion = this.remitosService.validarArchivo(archivo);
      
      if (validacion.valido) {
        this.documentoSeleccionado = archivo;
        this.error = null;
      } else {
        this.error = validacion.mensaje;
        this.documentoSeleccionado = null;
        event.target.value = '';
      }
    } else {
      this.documentoSeleccionado = null;
    }
  }

  

  limpiarFormularioDocumento(): void {
    this.documentoSeleccionado = null;
    this.descripcionDocumento = '';
    this.tipoDocumentoSeleccionado = null;
    this.error = null;
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  visualizarDocumento(documento: any): void {
    this.remitosService.visualizarRemito(documento.idRemito);
  }

  descargarDocumento(documento: any): void {
    this.remitosService.descargarRemito(documento.idRemito);
  }

  eliminarDocumento(documento: any): void {
    if (confirm('¿Está seguro que desea eliminar este documento?')) {
      const idCompra = this.compraSeleccionada?.idCompra || this.compraForm.get('idCompra')?.value;
      
      this.remitosService.eliminarRemito(documento.idRemito).subscribe({
        next: (response) => {
          if (response.success && idCompra) {
            this.cargarDocumentosCompra(idCompra);
          } else {
            this.error = response.message || 'Error al eliminar documento';
          }
        },
        error: (error) => {
          console.error('Error al eliminar documento:', error);
          this.error = 'Error al eliminar documento';
        }
      });
    }
  }

  // Nuevo método para calcular el monto total
  calcularMontoTotal(): number {
    let montoTotal = 0;
    const valorDolar = this.compraForm.get('valorDolar')?.value;
    
    if (!valorDolar || valorDolar <= 0) {
      return 0;
    }
    
    this.itemsFormArray.controls.forEach(control => {
      const precioUnitario = control.get('precioUnitario')?.value;
      const cantidad = control.get('cantidad')?.value;
      const monedaPrecio = control.get('monedaPrecio')?.value;
      
      // Solo calcular si tiene todos los datos necesarios
      if (precioUnitario && cantidad && monedaPrecio && precioUnitario > 0) {
        let precioEnDolares = precioUnitario;
        
        // Si el precio está en pesos, convertir a dólares
        if (monedaPrecio === 'UYU') {
          precioEnDolares = precioUnitario / valorDolar;
        }
        
        montoTotal += precioEnDolares * cantidad;
      }
    });
    
    return montoTotal;
  }

  // Método para actualizar el monto total cuando cambian los ítems
  actualizarMontoTotal(): void {
    // Forzar la detección de cambios para recalcular todos los valores
    this.cdr.detectChanges();
    
    const montoTotalConIva = this.calcularMontoTotalConIva();
    this.compraForm.patchValue({ monto: montoTotalConIva });
  }

  // Método para obtener el monto total convertido según la moneda seleccionada
  getMontoTotalConvertido(): number {
    const montoTotalConIva = this.calcularMontoTotalConIva();
    const moneda = this.compraForm.get('moneda')?.value;
    const valorDolar = this.compraForm.get('valorDolar')?.value;
    
    if (!moneda || !valorDolar) {
      return montoTotalConIva;
    }
    
    // Si la moneda es UYU, convertir de dólares a pesos
    if (moneda === 'UYU') {
      return montoTotalConIva * valorDolar;
    }
    
    // Si la moneda es USD, devolver en dólares
    return montoTotalConIva;
  }

  // Método para obtener el subtotal convertido según la moneda seleccionada
  getSubtotalConvertido(): number {
    const subtotalTotal = this.calcularSubtotalTotal();
    const moneda = this.compraForm.get('moneda')?.value;
    const valorDolar = this.compraForm.get('valorDolar')?.value;
    
    if (!moneda || !valorDolar) {
      return subtotalTotal;
    }
    
    // Si la moneda es UYU, convertir de dólares a pesos
    if (moneda === 'UYU') {
      return subtotalTotal * valorDolar;
    }
    
    // Si la moneda es USD, devolver en dólares
    return subtotalTotal;
  }

  // Método para obtener el IVA convertido según la moneda seleccionada
  getIvaConvertido(): number {
    const ivaTotal = this.calcularIvaTotal();
    const moneda = this.compraForm.get('moneda')?.value;
    const valorDolar = this.compraForm.get('valorDolar')?.value;
    
    if (!moneda || !valorDolar) {
      return ivaTotal;
    }
    
    // Si la moneda es UYU, convertir de dólares a pesos
    if (moneda === 'UYU') {
      return ivaTotal * valorDolar;
    }
    
    // Si la moneda es USD, devolver en dólares
    return ivaTotal;
  }

  // Método para calcular el subtotal de un ítem específico
  getItemSubtotal(index: number): number {
    const control = this.itemsFormArray.at(index);
    const precioUnitario = control.get('precioUnitario')?.value;
    const cantidad = control.get('cantidad')?.value;
    const monedaPrecio = control.get('monedaPrecio')?.value;
    const valorDolar = this.compraForm.get('valorDolar')?.value;
    
    if (!precioUnitario || !cantidad || !monedaPrecio || !valorDolar) {
      return 0;
    }
    
    let precioEnDolares = precioUnitario;
    
    // Si el precio está en pesos, convertir a dólares
    if (monedaPrecio === 'UYU') {
      precioEnDolares = precioUnitario / valorDolar;
    }
    
    return precioEnDolares * cantidad;
  }

  // Método para formatear moneda con símbolo
  formatearMonedaConSimbolo(monto: number, moneda: string): string {
    if (monto === null || monto === undefined || monto === 0) {
      return 'No definido';
    }
    
    const simbolo = moneda === 'USD' ? '$' : '$U';
    return `${simbolo} ${new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto)}`;
  }

  // Agregar un método para obtener el subtotal en pesos
  getItemSubtotalEnPesos(index: number): number {
    const control = this.itemsFormArray.at(index);
    const precioUnitario = control.get('precioUnitario')?.value;
    const cantidad = control.get('cantidad')?.value;
    const monedaPrecio = control.get('monedaPrecio')?.value;
    const valorDolar = this.compraForm.get('valorDolar')?.value;
    
    if (!precioUnitario || !cantidad || !monedaPrecio || !valorDolar) {
      return 0;
    }
    
    // Si el precio está en pesos, el subtotal en pesos es precio * cantidad
    if (monedaPrecio === 'UYU') {
      return precioUnitario * cantidad;
    }
    
    // Si el precio está en dólares, convertir a pesos
    return precioUnitario * cantidad * valorDolar;
  }

  // Métodos para cálculos de IVA
  getItemPorcentajeIva(index: number): number {
    const control = this.itemsFormArray.at(index);
    return control.get('porcentajeIva')?.value || 22.00;
  }

  getItemMontoIva(index: number): number {
    const subtotal = this.getItemSubtotal(index);
    const porcentajeIva = this.getItemPorcentajeIva(index);
    return subtotal * (porcentajeIva / 100);
  }

  getItemTotal(index: number): number {
    const subtotal = this.getItemSubtotal(index);
    const montoIva = this.getItemMontoIva(index);
    return subtotal + montoIva;
  }

  getItemMontoIvaEnPesos(index: number): number {
    const subtotalEnPesos = this.getItemSubtotalEnPesos(index);
    const porcentajeIva = this.getItemPorcentajeIva(index);
    return subtotalEnPesos * (porcentajeIva / 100);
  }

  getItemTotalEnPesos(index: number): number {
    const subtotalEnPesos = this.getItemSubtotalEnPesos(index);
    const montoIvaEnPesos = this.getItemMontoIvaEnPesos(index);
    return subtotalEnPesos + montoIvaEnPesos;
  }

  // Métodos para totales de la compra
  calcularSubtotalTotal(): number {
    let total = 0;
    for (let i = 0; i < this.itemsFormArray.length; i++) {
      total += this.getItemSubtotal(i);
    }
    return total;
  }

  calcularIvaTotal(): number {
    let total = 0;
    for (let i = 0; i < this.itemsFormArray.length; i++) {
      total += this.getItemMontoIva(i);
    }
    return total;
  }

  calcularMontoTotalConIva(): number {
    return this.calcularSubtotalTotal() + this.calcularIvaTotal();
  }

  // Métodos para modo edición - calcular subtotal e IVA a partir del monto total
  calcularSubtotalDesdeMontoTotal(): number {
    const montoTotal = this.compraForm.get('monto')?.value;
    if (!montoTotal || montoTotal <= 0) {
      return 0;
    }
    // Asumiendo IVA del 22%: montoTotal = subtotal * 1.22
    return montoTotal / 1.22;
  }

  calcularIvaDesdeMontoTotal(): number {
    const montoTotal = this.compraForm.get('monto')?.value;
    if (!montoTotal || montoTotal <= 0) {
      return 0;
    }
    const subtotal = this.calcularSubtotalDesdeMontoTotal();
    return montoTotal - subtotal;
  }
} 