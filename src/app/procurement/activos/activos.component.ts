import { Component, OnInit, ViewEncapsulation, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { ActivosService, ActivoDTO } from '../../services/activos.service';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { UbicacionesService } from '../../services/ubicaciones.service';
import { UbicacionDTO } from '../../interfaces/ubicacion.interface';
import { UsuariosService, UsuarioDTO } from '../../services/usuarios.service';
import { ComprasService, CompraDTO } from '../../services/compras.service';
import { HardwareService } from '../../services/hardware.service';
import { LotesService, LoteDTO } from '../../services/lotes.service';
import { EntregasService, EntregaDTO } from '../../services/entregas.service';
import { ServiciosGarantiaService, ServicioGarantiaDTO } from '../../services/servicios-garantia.service';
import { TiposActivoService, TipoDeActivoDTO } from '../../services/tipos-activo.service';
import { firstValueFrom } from 'rxjs';
import { importProvidersFrom } from '@angular/core';
import { PermissionsService } from '../../services/permissions.service';

@Component({
  selector: 'app-activos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule
  ],
  templateUrl: './activos.component.html',
  styleUrls: ['./activos.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ActivosComponent implements OnInit {
  @ViewChild('modalActivo') modalActivo: any;
  @ViewChild('modalConfirmacion') modalConfirmacion: any;
  activos: ActivoDTO[] = [];
  activosFiltrados: ActivoDTO[] = [];
  loading: boolean = false;
  error: string | null = null;
  activoForm: FormGroup;
  modoEdicion: boolean = false;
  activoSeleccionado: ActivoDTO | null = null;
  usuarioSeleccionado: UsuarioDTO | null = null;
  compraSeleccionada: CompraDTO | null = null;
  ubicaciones = new Map<number, UbicacionDTO>();
  usuarios: Map<number, UsuarioDTO> = new Map();
  compras: Map<number, CompraDTO> = new Map();
  hardwareMap: Map<number, any> = new Map();
  
  // Paginación
  page = 1;
  pageSize = 10;
  collectionSize = 0;
  
  // Ordenamiento
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Filtrado
  currentFilter: string = '';
  altaCount: number = 0;
  mediaCount: number = 0;
  bajaCount: number = 0;
  totalActivos: number = 0;

  // Control de búsqueda
  numeroCompraControl: FormControl = new FormControl('');

  // Listas para los dropdowns
  hardwareList: any[] = [];
  comprasList: CompraDTO[] = [];
  lotesList: LoteDTO[] = [];
  entregasList: EntregaDTO[] = [];
  ubicacionesList: UbicacionDTO[] = [];
  serviciosGarantiaList: ServicioGarantiaDTO[] = [];
  tiposActivoList: TipoDeActivoDTO[] = [];

  selectedAssetId: number | null = null;
  selectedRelatedAssets: number[] = [];

  successMessage: string | null = null;
  errorMessage: string | null = null;

  activosRelacionados: ActivoDTO[] = [];

  activoAEliminar: any = null;

  constructor(
    private activosService: ActivosService,
    private ubicacionesService: UbicacionesService,
    private usuariosService: UsuariosService,
    private comprasService: ComprasService,
    private hardwareService: HardwareService,
    private lotesService: LotesService,
    private entregasService: EntregasService,
    private serviciosGarantiaService: ServiciosGarantiaService,
    private tiposActivoService: TiposActivoService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef,
    public permissionsService: PermissionsService
  ) {
    this.activoForm = this.fb.group({
      name: ['', Validators.required],
      criticidad: ['', Validators.required],
      clasificacionDeINFO: ['', Validators.required],
      estado: ['', Validators.required],
      idTipoActivo: ['', Validators.required],
      idNumeroCompra: ['', Validators.required],
      idItem: ['', Validators.required],
      idEntrega: ['', Validators.required],
      idUbicacion: ['', Validators.required],
      idUsuario: ['', Validators.required],
      idSecundario: ['', Validators.required],
      idServicioGarantia: ['', Validators.required],
      fechaFinGarantia: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.cargarUbicaciones();
    this.cargarUsuarios();
    this.cargarCompras();
    this.cargarActivos();
    this.cargarHardware();
    this.cargarLotes();
    this.cargarEntregas();
    this.cargarServiciosGarantia();
    this.cargarTiposActivo();
    
    // Suscribirse a cambios en el control de búsqueda
    this.numeroCompraControl.valueChanges.subscribe(() => {
      this.aplicarFiltroBusqueda();
    });
  }

  cargarUsuarios() {
    this.usuariosService.getUsuarios().subscribe({
      next: (usuarios) => {
        usuarios.forEach(usuario => {
          if (usuario.idUsuario) {
            this.usuarios.set(usuario.idUsuario, usuario);
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar usuarios:', error);
      }
    });
  }

  getUsuarioInfo(idUsuario: number): string {
    const usuario = this.usuarios.get(idUsuario);
    return usuario ? `${usuario.nombre} ${usuario.apellido}` : 'No asignado';
  }

  cargarUbicaciones() {
    this.ubicacionesService.getUbicaciones().subscribe({
      next: (ubicaciones: UbicacionDTO[]) => {
        this.ubicaciones.clear();
        this.ubicacionesList = ubicaciones;
        ubicaciones.forEach(ubicacion => {
          if (ubicacion.id) {
            this.ubicaciones.set(ubicacion.id, ubicacion);
          }
        });
      },
      error: (error: any) => {
        console.error('Error al cargar ubicaciones:', error);
        this.errorMessage = 'Error al cargar las ubicaciones. Por favor, intente nuevamente.';
      }
    });
  }

  getUbicacionInfo(idUbicacion: number): string {
    const ubicacion = this.ubicaciones.get(idUbicacion);
    return ubicacion ? `${ubicacion.nombreGerencia} - ${ubicacion.nombreOficina}` : 'No asignada';
  }

  verDetallesUbicacion(idUbicacion: number, ubicacionModal: any) {
    const ubicacion = this.ubicaciones.get(idUbicacion);
    if (ubicacion) {
      this.activoSeleccionado = this.activos.find(a => a.idUbicacion === idUbicacion) || null;
      this.modalService.open(ubicacionModal, { size: 'lg' });
    }
  }

  verDetallesUsuario(idUsuario: number, usuarioModal: any) {
    const usuario = this.usuarios.get(idUsuario);
    if (usuario) {
      this.usuarioSeleccionado = usuario;
      this.modalService.open(usuarioModal, { size: 'lg' });
    }
  }

  cargarCompras() {
    this.comprasService.getCompras().subscribe({
      next: (compras) => {
        this.comprasList = compras;
        compras.forEach(compra => {
          if (compra.idCompra) {
            this.compras.set(compra.idCompra, compra);
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar compras:', error);
      }
    });
  }

  verDetallesCompra(idCompra: number, compraModal: any) {
    const compra = this.compras.get(idCompra);
    if (compra) {
      this.compraSeleccionada = compra;
      this.modalService.open(compraModal, { size: 'lg' });
    }
  }

  cargarActivos() {
    this.loading = true;
    this.error = null;
    this.activosService.getActivos().subscribe({
      next: (activos) => {
        console.log('Activos cargados:', activos);
        this.activos = activos;
        this.activosFiltrados = [...this.activos];
        this.collectionSize = this.activosFiltrados.length;
        this.updateSummary();
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Error al cargar los activos';
        this.loading = false;
        console.error('Error al cargar activos:', error);
      }
    });
  }

  verDetalles(activo: ActivoDTO): void {
    this.router.navigate(['/menu/procurement/activos', activo.idActivo]);
  }

  private async actualizarRelaciones(idActivo: number) {
    try {
      // Obtener relaciones actuales
      const relacionesActuales = await firstValueFrom(
        this.activosService.getActivosRelacionados(idActivo)
      );

      // Eliminar relaciones que ya no existen
      for (const idRelacionado of relacionesActuales) {
        if (!this.selectedRelatedAssets.includes(idRelacionado)) {
          await firstValueFrom(
            this.activosService.eliminarRelacion(idActivo, idRelacionado)
          );
        }
      }

      // Agregar nuevas relaciones
      for (const idRelacionado of this.selectedRelatedAssets) {
        if (!relacionesActuales.includes(idRelacionado)) {
          await firstValueFrom(
            this.activosService.agregarRelacion(idActivo, idRelacionado)
          );
        }
      }
    } catch (error) {
      console.error('Error al actualizar relaciones:', error);
      throw error;
    }
  }

  async abrirModal(modal: any, activo?: any) {
    try {
      // Asegurarse de que las ubicaciones estén cargadas
      if (this.ubicacionesList.length === 0) {
        await firstValueFrom(this.ubicacionesService.getUbicaciones());
      }

      this.modoEdicion = !!activo;
      this.activoSeleccionado = activo || null;
      this.errorMessage = null;
      this.successMessage = null;

      if (this.modoEdicion && activo) {
        console.log('Datos del activo a editar:', activo);
        console.log('clasificacionDeINFO:', activo.clasificacionDeINFO);
        console.log('estado:', activo.estado);
        
        // Normalizar valores para asegurar que coincidan con las opciones del select
        const clasificacionNormalizada = this.normalizarClasificacion(activo.clasificacionDeINFO);
        const estadoNormalizado = this.normalizarEstado(activo.estado);
        const criticidadNormalizada = this.normalizarCriticidad(activo.criticidad);
        
        console.log('Valores normalizados:', {
          clasificacion: clasificacionNormalizada,
          estado: estadoNormalizado,
          criticidad: criticidadNormalizada
        });
        
        // Cargar datos del activo en el formulario
        this.activoForm.patchValue({
          name: activo.name,
          criticidad: criticidadNormalizada,
          clasificacionDeINFO: clasificacionNormalizada,
          estado: estadoNormalizado,
          idTipoActivo: activo.idTipoActivo,
          idNumeroCompra: activo.idNumeroCompra,
          idItem: activo.idItem,
          idEntrega: activo.idEntrega,
          idUbicacion: activo.idUbicacion,
          idUsuario: activo.idUsuario,
          idSecundario: activo.idSecundario,
          idServicioGarantia: activo.idServicioGarantia,
          fechaFinGarantia: activo.fechaFinGarantia
        });

        console.log('Valores del formulario después de patchValue:', this.activoForm.value);

        // Forzar la detección de cambios
        this.changeDetectorRef.detectChanges();

        // Cargar activos relacionados
        try {
          const activosRelacionados = await firstValueFrom(
            this.activosService.getActivosRelacionados(activo.idActivo)
          );
          this.selectedRelatedAssets = activosRelacionados || [];
          console.log('Activos relacionados cargados:', this.selectedRelatedAssets);
        } catch (error) {
          console.error('Error al cargar activos relacionados:', error);
          this.selectedRelatedAssets = [];
        }
      } else {
        this.activoForm.reset();
        this.selectedRelatedAssets = [];
      }

      this.modalService.open(modal, { size: 'lg' });
    } catch (error) {
      console.error('Error al abrir el modal:', error);
      this.errorMessage = 'Error al cargar los datos necesarios. Por favor, intente nuevamente.';
    }
  }

  private normalizarClasificacion(clasificacion: string): string {
    if (!clasificacion) return '';
    
    const clasificacionUpper = clasificacion.toUpperCase().trim();
    if (clasificacionUpper.includes('CONFIDENCIAL')) return 'CONFIDENCIAL';
    if (clasificacionUpper.includes('NO CONFIDENCIAL') || clasificacionUpper.includes('NO CONFIDENCIAL')) return 'NO CONFIDENCIAL';
    if (clasificacionUpper.includes('PUBLICA') || clasificacionUpper.includes('PÚBLICA')) return 'PUBLICA';
    
    return clasificacionUpper;
  }

  private normalizarEstado(estado: string): string {
    if (!estado) return '';
    
    const estadoUpper = estado.toUpperCase().trim();
    if (estadoUpper.includes('ACTIVO')) return 'ACTIVO';
    if (estadoUpper.includes('INACTIVO')) return 'INACTIVO';
    if (estadoUpper.includes('MANTENIMIENTO')) return 'MANTENIMIENTO';
    
    return estadoUpper;
  }

  private normalizarCriticidad(criticidad: string): string {
    if (!criticidad) return '';
    
    const criticidadUpper = criticidad.toUpperCase().trim();
    if (criticidadUpper.includes('ALTA')) return 'ALTA';
    if (criticidadUpper.includes('MEDIA')) return 'MEDIA';
    if (criticidadUpper.includes('BAJA')) return 'BAJA';
    
    return criticidadUpper;
  }

  addRelatedAsset(idActivo: number | null) {
    if (!idActivo) return;

    if (!this.selectedRelatedAssets.includes(idActivo)) {
      this.selectedRelatedAssets.push(idActivo);
      this.selectedAssetId = null;
    }
  }

  removeRelatedAsset(idActivo: number) {
    this.selectedRelatedAssets = this.selectedRelatedAssets.filter(id => id !== idActivo);
  }

  isAssetRelated(idActivo: number): boolean {
    return this.selectedRelatedAssets.includes(idActivo);
  }

  getAssetDescription(idActivo: number): string {
    const activo = this.activos.find(a => a.idActivo === idActivo);
    if (!activo) return `Activo #${idActivo}`;
    return `#${idActivo} - ${activo.name}`;
  }

  async guardarActivo() {
    console.log('Método guardarActivo llamado');
    console.log('Formulario válido:', this.activoForm.valid);
    console.log('Valores del formulario:', this.activoForm.value);
    
    if (this.activoForm.valid) {
      const formData = this.activoForm.value;
      const activo: ActivoDTO = {
        idActivo: this.modoEdicion && this.activoSeleccionado ? this.activoSeleccionado.idActivo : 0,
        name: formData.name,
        criticidad: formData.criticidad,
        clasificacionDeINFO: formData.clasificacionDeINFO,
        estado: formData.estado,
        idTipoActivo: parseInt(formData.idTipoActivo),
        idNumeroCompra: parseInt(formData.idNumeroCompra),
        idItem: parseInt(formData.idItem),
        idEntrega: parseInt(formData.idEntrega),
        idUbicacion: parseInt(formData.idUbicacion),
        idUsuario: parseInt(formData.idUsuario),
        idSecundario: formData.idSecundario,
        idServicioGarantia: parseInt(formData.idServicioGarantia),
        fechaFinGarantia: formData.fechaFinGarantia
      };

      console.log('Datos a enviar:', activo);

      try {
        let response: ActivoDTO;
        if (this.modoEdicion && this.activoSeleccionado) {
          console.log('Actualizando activo existente');
          response = await firstValueFrom(this.activosService.actualizarActivo(this.activoSeleccionado.idActivo, activo));
          await this.actualizarRelaciones(this.activoSeleccionado.idActivo);
          
          this.modalService.dismissAll();
          this.cargarActivos();
          this.successMessage = 'Activo actualizado con éxito';
          setTimeout(() => this.successMessage = null, 3000);
        } else {
          console.log('Creando nuevo activo');
          response = await firstValueFrom(this.activosService.crearActivo(activo));
          console.log('Respuesta del servidor:', response);
          
          if (response.idActivo) {
            await this.actualizarRelaciones(response.idActivo);
            
            this.modalService.dismissAll();
            this.cargarActivos();
            this.successMessage = 'Activo creado con éxito';
            setTimeout(() => this.successMessage = null, 3000);
          }
        }
      } catch (error) {
        console.error('Error al guardar activo:', error);
        this.errorMessage = 'Error al guardar el activo';
        setTimeout(() => this.errorMessage = null, 3000);
      }
    } else {
      console.log('Formulario inválido. Errores:', this.activoForm.errors);
      Object.keys(this.activoForm.controls).forEach(key => {
        const control = this.activoForm.get(key);
        if (control?.errors) {
          console.log(`Errores en ${key}:`, control.errors);
        }
      });
    }
  }

  eliminarActivo(activo: any) {
    this.activoAEliminar = activo;
    this.modalConfirmacion.nativeElement.modal('show');
  }

  cancelarEliminacion() {
    this.activoAEliminar = null;
    this.modalConfirmacion.nativeElement.modal('hide');
  }

  confirmarEliminacion() {
    if (this.activoAEliminar) {
      this.activosService.eliminarActivo(this.activoAEliminar.idActivo).subscribe(
        () => {
          this.cargarActivos();
          this.modalConfirmacion.nativeElement.modal('hide');
          this.activoAEliminar = null;
        },
        error => {
          console.error('Error al eliminar el activo:', error);
        }
      );
    }
  }



  // Método para cargar hardware
  cargarHardware() {
    this.hardwareService.getHardware().subscribe({
      next: (hardware) => {
        this.hardwareList = hardware;
      },
      error: (error) => {
        console.error('Error al cargar hardware:', error);
      }
    });
  }

  // Método para cargar lotes
  cargarLotes() {
    this.lotesService.getLotes().subscribe({
      next: (lotes) => {
        this.lotesList = lotes;
      },
      error: (error) => {
        console.error('Error al cargar lotes:', error);
      }
    });
  }

  // Método para cargar entregas
  cargarEntregas() {
    this.entregasService.getEntregas().subscribe({
      next: (entregas) => {
        this.entregasList = entregas;
      },
      error: (error) => {
        console.error('Error al cargar entregas:', error);
      }
    });
  }

  // Método para cargar servicios de garantía
  cargarServiciosGarantia() {
    this.serviciosGarantiaService.getServiciosGarantia().subscribe({
      next: (servicios) => {
        this.serviciosGarantiaList = servicios;
      },
      error: (error) => {
        console.error('Error al cargar servicios de garantía:', error);
      }
    });
  }

  cargarTiposActivo() {
    console.log('Cargando tipos de activo...');
    this.tiposActivoService.getTiposActivo().subscribe({
      next: (tipos) => {
        console.log('Tipos de activo cargados:', tipos);
        this.tiposActivoList = tipos;
      },
      error: (error) => {
        console.error('Error al cargar tipos de activo:', error);
      }
    });
  }

  updateSummary(): void {
    this.totalActivos = this.activos.length;
    this.altaCount = this.activos.filter(a => a.criticidad?.trim().toUpperCase() === 'ALTA').length;
    this.mediaCount = this.activos.filter(a => a.criticidad?.trim().toUpperCase() === 'MEDIA').length;
    this.bajaCount = this.activos.filter(a => a.criticidad?.trim().toUpperCase() === 'BAJA').length;
  }

  filterByCriticidad(criticidad: string): void {
    this.currentFilter = criticidad;
    if (criticidad === '') {
      this.activosFiltrados = [...this.activos];
    } else {
      this.activosFiltrados = this.activos.filter(activo =>
        activo.criticidad?.trim().toUpperCase() === criticidad.trim().toUpperCase()
      );
    }
    this.collectionSize = this.activosFiltrados.length;
    this.page = 1;
    this.updateSummary();
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.activosFiltrados.sort((a, b) => {
      let valueA: any;
      let valueB: any;
      if (column === 'numeroCompra') {
        const compraA = this.compras.get(a.idNumeroCompra);
        const compraB = this.compras.get(b.idNumeroCompra);
        valueA = compraA && compraA.numeroCompra ? compraA.numeroCompra.toLowerCase() : '';
        valueB = compraB && compraB.numeroCompra ? compraB.numeroCompra.toLowerCase() : '';
      } else {
        valueA = a[column as keyof typeof a];
        valueB = b[column as keyof typeof b];
        if (valueA === null || valueA === undefined) valueA = '';
        if (valueB === null || valueB === undefined) valueB = '';
        if (typeof valueA === 'string') valueA = valueA.toLowerCase();
        if (typeof valueB === 'string') valueB = valueB.toLowerCase();
      }
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  get pagedActivos(): ActivoDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.activosFiltrados.slice(startItem, endItem);
  }

  verDetallesHardware(name: string): void {
    this.hardwareService.getHardware().subscribe({
      next: (hardwareList) => {
        const hardware = hardwareList.find((h: any) => h.name === name);
        if (hardware) {
          this.router.navigate(['/menu/asset-details', hardware.id]);
        } else {
          alert('No se encontró el hardware correspondiente.');
        }
      },
      error: () => {
        alert('Error al buscar el hardware.');
      }
    });
  }

  getNumeroCompraString(idCompra: number): string {
    const compra = this.compras.get(idCompra);
    return compra && compra.numeroCompra ? compra.numeroCompra : 'No asignado';
  }

  aplicarFiltroBusqueda(): void {
    const valorBusqueda = this.numeroCompraControl.value?.toLowerCase() || '';
    
    if (!valorBusqueda) {
      this.activosFiltrados = [...this.activos];
    } else {
      this.activosFiltrados = this.activos.filter(activo => {
        const compra = this.compras.get(activo.idNumeroCompra);
        const numeroCompra = compra && compra.numeroCompra ? compra.numeroCompra.toLowerCase() : '';
        return numeroCompra.includes(valorBusqueda);
      });
    }
    
    this.collectionSize = this.activosFiltrados.length;
    this.page = 1;
  }
} 