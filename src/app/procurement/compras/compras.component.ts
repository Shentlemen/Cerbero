import { Component, OnInit, ViewEncapsulation, ChangeDetectorRef, ViewChild, TemplateRef } from '@angular/core';
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
import { EntregasService, EntregaDTO } from '../../services/entregas.service';
import { PermissionsService } from '../../services/permissions.service';

interface CompraConTipo extends CompraDTO {
  tipoCompraDescripcion?: string;
  tipoCompraAbreviado?: string;
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
  tipoCompraFiltroActivo: number | null = null;
  compraSeleccionada: CompraConTipo | null = null;
  lotesDetalles: LoteDTO[] = [];
  entregasDetalles: EntregaDTO[] = [];
  isCompactView: boolean = false;
  proveedoresFiltrados: { [key: number]: ProveedorDTO[] } = {};
  serviciosGarantiaFiltrados: { [key: number]: ServicioGarantiaDTO[] } = {};
  proveedorSearchValues: { [key: number]: string } = {};
  servicioGarantiaSearchValues: { [key: number]: string } = {};
  dropdownProveedoresVisible: { [key: number]: boolean } = {};
  dropdownServiciosGarantiaVisible: { [key: number]: boolean } = {};

  @ViewChild('detallesModal') detallesModal!: TemplateRef<any>;

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
      monto: ['', [Validators.required, Validators.min(0)]],
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
          tipoCompraDescripcion: this.getTipoCompraDescripcion(compra.idTipoCompra),
          tipoCompraAbreviado: this.getTipoCompraAbreviado(compra.idTipoCompra)
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
        ano: compra.ano && compra.ano > 0 ? compra.ano : null
      });
      
      // Formatear el monto en el input después de un pequeño delay para que el DOM se actualice
      setTimeout(() => {
        const montoInput = document.querySelector('input[formControlName="monto"]') as HTMLInputElement;
        if (montoInput && compra.monto) {
          // Formatear con separadores de miles y coma decimal
          const formateado = new Intl.NumberFormat('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(compra.monto);
          montoInput.value = formateado;
        }
      }, 100);
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
      descripcion: [''],
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto);
  }

  formatearMontoInput(event: any): void {
    const input = event.target;
    let value = input.value;
    
    // Obtener la posición del cursor antes del formateo
    const cursorPosition = input.selectionStart;
    
    // Remover todos los caracteres no numéricos
    value = value.replace(/[^\d]/g, '');
    
    // Si no hay valor, mostrar 0,00
    if (!value) {
      input.value = '0,00';
      this.compraForm.patchValue({ monto: 0 });
      return;
    }
    
    // Convertir a centavos (dividir por 100)
    const centavos = parseInt(value);
    const monto = centavos / 100;
    
    // Formatear manualmente para asegurar que use coma como separador decimal
    let formateado = '';
    
    if (monto < 1) {
      // Para valores menores a 1, mostrar como 0,XX
      formateado = '0,' + centavos.toString().padStart(2, '0');
    } else {
      // Para valores mayores o iguales a 1
      const parteEntera = Math.floor(monto);
      const parteDecimal = centavos % 100;
      
      // Formatear parte entera con separadores de miles (puntos) manualmente
      let parteEnteraFormateada = parteEntera.toString();
      
      // Agregar puntos para separadores de miles de forma más simple
      if (parteEntera >= 1000) {
        const numStr = parteEntera.toString();
        let result = '';
        for (let i = 0; i < numStr.length; i++) {
          if (i > 0 && (numStr.length - i) % 3 === 0) {
            result += '.';
          }
          result += numStr[i];
        }
        parteEnteraFormateada = result;
      }
      
      // Construir el resultado final
      formateado = parteEnteraFormateada + ',' + parteDecimal.toString().padStart(2, '0');
    }
    
    // Actualizar el input con el valor formateado
    input.value = formateado;
    
    // Actualizar el FormControl con el valor numérico
    this.compraForm.patchValue({ monto: monto });
    
    // Forzar la actualización del input después de un pequeño delay
    setTimeout(() => {
      input.value = formateado;
    }, 10);
    
    // Calcular nueva posición del cursor después del formateo
    let newCursorPosition = cursorPosition;
    
    // Ajustar posición del cursor considerando los separadores agregados
    if (formateado.length > value.length) {
      const addedSeparators = formateado.length - value.length;
      newCursorPosition += addedSeparators;
    }
    
    // Posicionar cursor en la posición correcta
    setTimeout(() => {
      const finalPosition = Math.min(newCursorPosition, formateado.length);
      input.setSelectionRange(finalPosition, finalPosition);
    }, 0);
  }

  formatearMontoOnBlur(event: any): void {
    const input = event.target;
    let value = input.value;
    
    // Si el campo está vacío, mostrar 0,00
    if (!value.trim()) {
      input.value = '0,00';
      this.compraForm.patchValue({ monto: 0 });
      return;
    }
    
    // Remover todos los caracteres no numéricos
    value = value.replace(/[^\d]/g, '');
    
    // Si no hay valor, mostrar 0,00
    if (!value) {
      input.value = '0,00';
      this.compraForm.patchValue({ monto: 0 });
      return;
    }
    
    // Convertir a centavos (dividir por 100)
    const centavos = parseInt(value);
    const monto = centavos / 100;
    
    // Formatear manualmente para asegurar que use coma como separador decimal
    let formateado = '';
    
    if (monto < 1) {
      // Para valores menores a 1, mostrar como 0,XX
      formateado = '0,' + centavos.toString().padStart(2, '0');
    } else {
      // Para valores mayores o iguales a 1
      const parteEntera = Math.floor(monto);
      const parteDecimal = centavos % 100;
      
      // Formatear parte entera con separadores de miles (puntos) manualmente
      let parteEnteraFormateada = parteEntera.toString();
      
      // Agregar puntos para separadores de miles de forma más simple
      if (parteEntera >= 1000) {
        const numStr = parteEntera.toString();
        let result = '';
        for (let i = 0; i < numStr.length; i++) {
          if (i > 0 && (numStr.length - i) % 3 === 0) {
            result += '.';
          }
          result += numStr[i];
        }
        parteEnteraFormateada = result;
      }
      
      // Construir el resultado final
      formateado = parteEnteraFormateada + ',' + parteDecimal.toString().padStart(2, '0');
    }
    
    // Actualizar el input y el FormControl
    input.value = formateado;
    this.compraForm.patchValue({ monto: monto });
  }

  verificarBorradoCompleto(event: any): void {
    const input = event.target;
    
    // Si se presiona Backspace o Delete y el campo está casi vacío
    if ((event.key === 'Backspace' || event.key === 'Delete') && 
        (input.value.length <= 3 || input.value === '0,00')) {
      
      // Si se presiona Backspace en 0,00 o similar, volver a 0,00
      if (input.value === '0,00' || input.value === '0,0' || input.value === '0,') {
        event.preventDefault();
        input.value = '0,00';
        this.compraForm.patchValue({ monto: 0 });
        input.setSelectionRange(0, 0);
        return;
      }
    }
  }

  formatearFecha(fecha: string): string {
    const date = new Date(fecha);
    const dia = date.getDate().toString().padStart(2, '0');
    const mes = (date.getMonth() + 1).toString().padStart(2, '0');
    const año = date.getFullYear();
    return `${dia}/${mes}/${año}`;
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
    
    // Cargar lotes de la compra
    this.lotesService.getLotesByCompra(compra.idCompra).subscribe({
      next: (lotes) => {
        this.lotesDetalles = lotes;
        
        // Cargar entregas de todos los lotes
        const entregasObservables = lotes.map(lote => 
          this.entregasService.getEntregasByItem(lote.idItem).toPromise()
        );
        
        Promise.all(entregasObservables).then(entregasPorLote => {
          this.entregasDetalles = entregasPorLote.flat().filter(e => !!e);
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Error al cargar los detalles de la compra:', error);
        this.lotesDetalles = [];
        this.entregasDetalles = [];
      }
    });
    
    // Abrir el modal de detalles
    this.modalService.open(this.detallesModal, { 
      size: 'xl', 
      backdrop: 'static',
      keyboard: false,
      centered: true
    });
  }

  getProveedorNombre(idProveedor: number): string {
    const proveedor = this.proveedoresList.find(p => p.idProveedores === idProveedor);
    return proveedor ? proveedor.nombreComercial : 'No disponible';
  }

  getServicioGarantiaNombre(idServicio: number): string {
    const servicio = this.serviciosGarantiaList.find(s => s.idServicioGarantia === idServicio);
    return servicio ? servicio.nombreComercial : 'No disponible';
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

  filtrarServiciosGarantia(event: any, index: number): void {
    const searchTerm = event.target.value.toLowerCase();
    this.servicioGarantiaSearchValues[index] = searchTerm;
    
    if (!searchTerm) {
      this.serviciosGarantiaFiltrados[index] = [...this.serviciosGarantiaList];
    } else {
      this.serviciosGarantiaFiltrados[index] = this.serviciosGarantiaList.filter(servicio =>
        servicio.nombreComercial.toLowerCase().includes(searchTerm) ||
        servicio.nombre.toLowerCase().includes(searchTerm)
      );
    }
  }

  getProveedoresFiltrados(index: number): ProveedorDTO[] {
    if (!this.proveedoresFiltrados[index]) {
      this.proveedoresFiltrados[index] = [...this.proveedoresList];
    }
    return this.proveedoresFiltrados[index];
  }

  getServiciosGarantiaFiltrados(index: number): ServicioGarantiaDTO[] {
    if (!this.serviciosGarantiaFiltrados[index]) {
      this.serviciosGarantiaFiltrados[index] = [...this.serviciosGarantiaList];
    }
    return this.serviciosGarantiaFiltrados[index];
  }

  getProveedorSearchValue(index: number): string {
    return this.proveedorSearchValues[index] || '';
  }

  getServicioGarantiaSearchValue(index: number): string {
    return this.servicioGarantiaSearchValues[index] || '';
  }

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

  mostrarDropdownServiciosGarantia(index: number): void {
    this.dropdownServiciosGarantiaVisible[index] = true;
    this.serviciosGarantiaFiltrados[index] = [...this.serviciosGarantiaList];
  }

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

  seleccionarServicioGarantia(servicio: ServicioGarantiaDTO, index: number): void {
    const itemControl = this.itemsFormArray.at(index);
    itemControl.patchValue({
      idServicioGarantia: servicio.idServicioGarantia
    });
    this.servicioGarantiaSearchValues[index] = servicio.nombreComercial;
    this.dropdownServiciosGarantiaVisible[index] = false;
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

  getServicioGarantiaDisplayValue(index: number): string {
    const itemControl = this.itemsFormArray.at(index);
    const idServicio = itemControl.get('idServicioGarantia')?.value;
    if (idServicio) {
      const servicio = this.serviciosGarantiaList.find(s => s.idServicioGarantia === idServicio);
      return servicio ? servicio.nombreComercial : '';
    }
    return this.servicioGarantiaSearchValues[index] || '';
  }
} 