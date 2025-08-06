import { Component, OnInit, ViewEncapsulation, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { ActivosService, ActivoDTO } from '../../services/activos.service';
import { NgbModal, NgbModule, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
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
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';

@Component({
  selector: 'app-activos',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    NgbNavModule,
    NotificationContainerComponent
  ],
  templateUrl: './activos.component.html',
  styleUrls: ['./activos.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ActivosComponent implements OnInit {
  @ViewChild('modalActivo') modalActivo: any;
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
  lotesFiltrados: LoteDTO[] = []; // Nueva propiedad para lotes filtrados por compra
  entregasList: EntregaDTO[] = [];
  entregasFiltradas: EntregaDTO[] = []; // Nueva propiedad para entregas filtradas por item
  ubicacionesList: UbicacionDTO[] = [];
  serviciosGarantiaList: ServicioGarantiaDTO[] = [];
  tiposActivoList: TipoDeActivoDTO[] = [];

  selectedAssetId: number | null = null;
  selectedRelatedAssets: number[] = [];

  successMessage: string | null = null;
  errorMessage: string | null = null;

  // Propiedades para creación por rango
  private _creationMode: 'single' | 'range' = 'single';
  
  get creationMode(): 'single' | 'range' {
    return this._creationMode;
  }
  
  set creationMode(value: 'single' | 'range') {
    this._creationMode = value;
    this.updateValidationRules();
  }
  rangeStart: string = '';
  rangeEnd: string = '';

  // Propiedad para las pestañas del modal
  activeTab: string = '1';

  activosRelacionados: ActivoDTO[] = [];

  activoAEliminar: any = null;
  showConfirmDialog: boolean = false;

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
    public permissionsService: PermissionsService,
    private notificationService: NotificationService
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
      idUbicacion: [''], // Quitado Validators.required
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

    // Suscribirse a cambios en la compra seleccionada
    this.activoForm.get('idNumeroCompra')?.valueChanges.subscribe((idCompra) => {
      this.onCompraChange(idCompra);
    });

    // Suscribirse a cambios en el item seleccionado
    this.activoForm.get('idItem')?.valueChanges.subscribe((idItem) => {
      this.onItemChange(idItem);
    });

    // Suscribirse a cambios en el tipo de activo seleccionado
    this.activoForm.get('idTipoActivo')?.valueChanges.subscribe((idTipoActivo) => {
      this.onTipoActivoChange(idTipoActivo);
    });

    // Actualizar validaciones iniciales
    this.updateValidationRules();
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

  getUbicacionInfo(idUbicacion: number | null): string {
    if (!idUbicacion) return 'No asignada';
    const ubicacion = this.ubicaciones.get(idUbicacion);
    return ubicacion ? `${ubicacion.nombreGerencia} - ${ubicacion.nombreOficina}` : 'No asignada';
  }

  verDetallesUbicacion(idUbicacion: number | null, ubicacionModal: any) {
    if (!idUbicacion) return;
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
      
      // Inicializar modo de creación
      this.creationMode = 'single';
      this.rangeStart = '';
      this.rangeEnd = '';

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

        // Cargar lotes filtrados para la compra del activo
        if (activo.idNumeroCompra) {
          this.onCompraChange(activo.idNumeroCompra);
        }

        // Cargar entregas filtradas para el item del activo
        if (activo.idItem) {
          this.onItemChange(activo.idItem);
        }

        // Cargar usuario automáticamente basado en el tipo de activo
        if (activo.idTipoActivo) {
          this.onTipoActivoChange(activo.idTipoActivo);
        }

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
        // Habilitar el campo de usuario al crear un nuevo activo
        this.activoForm.get('idUsuario')?.enable();
        // Deshabilitar campos dependientes al inicio
        this.activoForm.get('idItem')?.disable();
        this.activoForm.get('idEntrega')?.disable();
      }

      this.modalService.open(modal, { size: 'xl' });
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
    console.log('Modo de creación:', this.creationMode);
    
    // Marcar todos los campos como touched para mostrar errores de validación
    this.markAllFieldsAsTouched();
    
    // Si el formulario no es válido, mostrar errores y no continuar
    if (!this.activoForm.valid) {
      console.log('Formulario no válido, mostrando errores...');
      this.showValidationErrors();
      return;
    }

    // Validaciones adicionales para modo rango
    if (this.creationMode === 'range') {
      if (!this.rangeStart || !this.rangeEnd) {
        this.errorMessage = 'Debe especificar el rango de nombres (inicio y fin)';
        setTimeout(() => this.errorMessage = null, 5000);
        return;
      }
      
      // Validar formato de los rangos
      const formatValidation = this.validateRangeFormat();
      if (!formatValidation.isValid) {
        this.errorMessage = formatValidation.errorMessage;
        setTimeout(() => this.errorMessage = null, 5000);
        return;
      }
      
      const rangeInfo = this.getRangeInfo();
      if (!rangeInfo.isValid || rangeInfo.count <= 0) {
        this.errorMessage = 'El nombre inicial debe ser menor al nombre final';
        setTimeout(() => this.errorMessage = null, 5000);
        return;
      }
    }
    
    if (this.creationMode === 'range') {
      await this.guardarActivosPorRango();
    } else {
      await this.guardarActivoIndividual();
    }
  }

  markAllFieldsAsTouched() {
    Object.keys(this.activoForm.controls).forEach(key => {
      const control = this.activoForm.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }

  showValidationErrors() {
    // Mostrar mensaje de error con detalles
    const erroresDetallados: string[] = [];
    Object.keys(this.activoForm.controls).forEach(key => {
      const control = this.activoForm.get(key);
      if (control?.errors) {
        console.log(`Errores en ${key}:`, control.errors);
        if (control.errors['required']) {
          // No mostrar error del campo 'name' si está en modo rango
          if (key === 'name' && this.creationMode === 'range') {
            return;
          }
          erroresDetallados.push(`El campo "${this.getFieldDisplayName(key)}" es requerido`);
        }
      }
    });
    
    if (erroresDetallados.length > 0) {
      this.errorMessage = `Por favor complete los siguientes campos requeridos:\n${erroresDetallados.join('\n')}`;
      setTimeout(() => this.errorMessage = null, 5000);
    }
  }

    async guardarActivoIndividual() {
    console.log('Formulario válido:', this.activoForm.valid);
    console.log('Valores del formulario:', this.activoForm.value);
    
    // El formulario ya fue validado en guardarActivo()
    const formData = this.activoForm.value;
    
    // Obtener el idUsuario correcto
    const idUsuario = this.getUserIdFromForm(formData);
    console.log('ID Usuario a usar:', idUsuario);
    
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
      idUbicacion: formData.idUbicacion ? parseInt(formData.idUbicacion) : null,
      idUsuario: idUsuario,
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
  }

  async guardarActivosPorRango() {
    console.log('Iniciando guardarActivosPorRango...');
    
    // Mostrar indicador de progreso
    this.loading = true;
    this.errorMessage = null;
    
    const rangeInfo = this.getRangeInfo();
    console.log('Información del rango:', rangeInfo);
    
    if (!rangeInfo.isValid) {
      console.log('Rango inválido');
      this.errorMessage = 'Rango inválido. Verifique que los nombres tengan el formato PCXXXXX y que el inicio sea menor al final.';
      setTimeout(() => this.errorMessage = null, 5000);
      this.loading = false;
      return;
    }

    if (rangeInfo.count > 1000) {
      console.log('Rango demasiado grande:', rangeInfo.count);
      this.errorMessage = 'El rango es demasiado grande. Máximo 1000 activos por operación.';
      setTimeout(() => this.errorMessage = null, 5000);
      this.loading = false;
      return;
    }

    if (!this.activoForm.valid) {
      console.log('Formulario inválido');
      this.errorMessage = 'Por favor complete todos los campos requeridos.';
      setTimeout(() => this.errorMessage = null, 3000);
      this.loading = false;
      return;
    }

    const formData = this.activoForm.value;
    console.log('Datos del formulario:', formData);
    
    const assetNumbers = this.generateAssetNumbers();
    console.log('Números generados:', assetNumbers);
    
    // Verificar si hay números duplicados
    const existingNumbers = assetNumbers.filter(number => this.isAssetNumberExists(number));
    if (existingNumbers.length > 0) {
      console.log('Números duplicados encontrados:', existingNumbers);
      this.errorMessage = `Los siguientes números ya existen: ${existingNumbers.slice(0, 5).join(', ')}${existingNumbers.length > 5 ? '...' : ''}`;
      setTimeout(() => this.errorMessage = null, 5000);
      this.loading = false;
      return;
    }

    try {
      console.log('Preparando activos para crear...');
      
          // Obtener el idUsuario correcto
    const idUsuario = this.getUserIdFromForm(formData);
    console.log('ID Usuario a usar:', idUsuario);
      
      // Crear todos los activos en una sola operación usando el endpoint batch
      const activosToCreate: ActivoDTO[] = assetNumbers.map(assetNumber => ({
        idActivo: 0,
        name: assetNumber,
        criticidad: formData.criticidad,
        clasificacionDeINFO: formData.clasificacionDeINFO,
        estado: formData.estado,
        idTipoActivo: parseInt(formData.idTipoActivo),
        idNumeroCompra: parseInt(formData.idNumeroCompra),
        idItem: parseInt(formData.idItem),
        idEntrega: parseInt(formData.idEntrega),
        idUbicacion: formData.idUbicacion ? parseInt(formData.idUbicacion) : null,
        idUsuario: idUsuario,
        idSecundario: formData.idSecundario,
        idServicioGarantia: parseInt(formData.idServicioGarantia),
        fechaFinGarantia: formData.fechaFinGarantia
      }));

      console.log('Activos a crear:', activosToCreate);
      console.log('Llamando al servicio crearActivosBatch...');

      let createdActivos: ActivoDTO[] = [];
      
      try {
        // Intentar crear en batch primero
        createdActivos = await firstValueFrom(this.activosService.crearActivosBatch(activosToCreate));
        console.log('Respuesta del servicio batch:', createdActivos);
      } catch (batchError) {
        console.log('Error en batch, intentando crear uno por uno:', batchError);
        
        // Si falla el batch, crear uno por uno
        createdActivos = [];
        for (const activo of activosToCreate) {
          try {
            const createdActivo = await firstValueFrom(this.activosService.crearActivo(activo));
            createdActivos.push(createdActivo);
            console.log(`Activo creado: ${createdActivo.name}`);
          } catch (individualError) {
            console.error(`Error al crear activo ${activo.name}:`, individualError);
            // Continuar con los siguientes activos
          }
        }
      }

      this.modalService.dismissAll();
      this.cargarActivos();
      
      if (createdActivos.length > 0) {
        this.successMessage = `Se crearon exitosamente ${createdActivos.length} de ${assetNumbers.length} activos.`;
        setTimeout(() => this.successMessage = null, 5000);
      } else {
        this.errorMessage = 'No se pudo crear ningún activo. Por favor, intente nuevamente.';
        setTimeout(() => this.successMessage = null, 5000);
      }
      
    } catch (error) {
      console.error('Error al crear activos por rango:', error);
      this.errorMessage = `Error al crear los activos: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      setTimeout(() => this.errorMessage = null, 5000);
    } finally {
      // Ocultar indicador de progreso
      this.loading = false;
    }
  }

  eliminarActivo(activo: any) {
    this.activoAEliminar = activo;
    this.showConfirmDialog = true;
  }

  cancelarEliminacion() {
    this.activoAEliminar = null;
    this.showConfirmDialog = false;
  }

  confirmarEliminacion() {
    console.log('activoAEliminar:', this.activoAEliminar);
    if (this.activoAEliminar) {
      console.log('idActivo:', this.activoAEliminar.idActivo);
      this.activosService.eliminarActivo(this.activoAEliminar.idActivo).subscribe(
        () => {
          this.cargarActivos();
          this.showConfirmDialog = false;
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
        this.lotesFiltrados = []; // Inicializar lotes filtrados vacíos
      },
      error: (error) => {
        console.error('Error al cargar lotes:', error);
      }
    });
  }

  onCompraChange(idCompra: number) {
    if (idCompra) {
      // Cargar lotes específicos de la compra seleccionada
      this.lotesService.getLotesByCompra(idCompra).subscribe({
        next: (lotes) => {
          this.lotesFiltrados = lotes;
          // Limpiar el campo de item si no está en la nueva lista
          const currentItemId = this.activoForm.get('idItem')?.value;
          if (currentItemId && !this.lotesFiltrados.find(lote => lote.idItem === currentItemId)) {
            this.activoForm.get('idItem')?.setValue('');
          }
          // Habilitar el campo de item
          this.activoForm.get('idItem')?.enable();
        },
        error: (error) => {
          console.error('Error al cargar lotes de la compra:', error);
          this.lotesFiltrados = [];
          // Deshabilitar el campo de item
          this.activoForm.get('idItem')?.disable();
        }
      });
    } else {
      // Si no hay compra seleccionada, limpiar los lotes filtrados y entregas
      this.lotesFiltrados = [];
      this.entregasFiltradas = [];
      this.activoForm.get('idItem')?.setValue('');
      this.activoForm.get('idEntrega')?.setValue('');
      // Deshabilitar campos dependientes
      this.activoForm.get('idItem')?.disable();
      this.activoForm.get('idEntrega')?.disable();
    }
  }

  onItemChange(idItem: number) {
    if (idItem) {
      // Cargar entregas específicas del item seleccionado
      this.entregasService.getEntregasByItem(idItem).subscribe({
        next: (entregas) => {
          this.entregasFiltradas = entregas;
          // Limpiar el campo de entrega si no está en la nueva lista
          const currentEntregaId = this.activoForm.get('idEntrega')?.value;
          if (currentEntregaId && !this.entregasFiltradas.find(entrega => entrega.idEntrega === currentEntregaId)) {
            this.activoForm.get('idEntrega')?.setValue('');
          }
          // Habilitar el campo de entrega
          this.activoForm.get('idEntrega')?.enable();
        },
        error: (error) => {
          console.error('Error al cargar entregas del item:', error);
          this.entregasFiltradas = [];
          // Deshabilitar el campo de entrega
          this.activoForm.get('idEntrega')?.disable();
        }
      });
    } else {
      // Si no hay item seleccionado, limpiar las entregas filtradas
      this.entregasFiltradas = [];
      this.activoForm.get('idEntrega')?.setValue('');
      // Deshabilitar el campo de entrega
      this.activoForm.get('idEntrega')?.disable();
    }
  }

  onTipoActivoChange(idTipoActivo: number) {
    if (idTipoActivo && this.tiposActivoList.length > 0) {
      // Buscar el tipo de activo seleccionado para obtener el idUsuario
      // Usar búsqueda flexible para manejar diferentes tipos de datos
      const tipoActivo = this.tiposActivoList.find(tipo => 
        tipo.idActivo == idTipoActivo || 
        Number(tipo.idActivo) === Number(idTipoActivo)
      );
      
      if (tipoActivo && tipoActivo.idUsuario) {
        // Cargar automáticamente el usuario responsable
        this.activoForm.get('idUsuario')?.setValue(tipoActivo.idUsuario);
        // Deshabilitar el campo de usuario
        this.activoForm.get('idUsuario')?.disable();
      } else {
        // Habilitar el campo de usuario si no se puede asignar automáticamente
        this.activoForm.get('idUsuario')?.enable();
      }
    } else if (!idTipoActivo) {
      // Si no hay tipo de activo seleccionado, habilitar el campo de usuario
      this.activoForm.get('idUsuario')?.enable();
    }
  }

  isUsuarioDisabled(): boolean {
    return this.activoForm.get('idUsuario')?.disabled || false;
  }

  isItemDisabled(): boolean {
    return this.activoForm.get('idItem')?.disabled || false;
  }

  isEntregaDisabled(): boolean {
    return this.activoForm.get('idEntrega')?.disabled || false;
  }

  // Método para cargar entregas
  cargarEntregas() {
    this.entregasService.getEntregas().subscribe({
      next: (entregas) => {
        this.entregasList = entregas;
        this.entregasFiltradas = []; // Inicializar entregas filtradas vacías
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
    this.tiposActivoService.getTiposActivo().subscribe({
      next: (tipos) => {
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
          this.notificationService.showNotFoundError('No se encontró el hardware correspondiente.');
        }
      },
      error: () => {
        this.notificationService.showError(
          'Error al Buscar Hardware',
          'No se pudo buscar el hardware correspondiente.'
        );
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

  /**
   * Obtiene información del rango de activos a crear
   */
  getRangeInfo(): { start: string; end: string; count: number; isValid: boolean; isPcFormat: boolean } {
    if (!this.rangeStart || !this.rangeEnd) {
      return { start: '', end: '', count: 0, isValid: false, isPcFormat: false };
    }

    // Detectar si es formato PC (PC + dígitos)
    const startPcMatch = this.rangeStart.match(/^PC(\d+)$/);
    const endPcMatch = this.rangeEnd.match(/^PC(\d+)$/);
    
    if (startPcMatch && endPcMatch) {
      // Formato PC
      const startNum = parseInt(startPcMatch[1]);
      const endNum = parseInt(endPcMatch[1]);
      
      if (startNum > endNum) {
        return { start: '', end: '', count: 0, isValid: false, isPcFormat: true };
      }
      
      const count = endNum - startNum + 1;
      return {
        start: this.rangeStart,
        end: this.rangeEnd,
        count: count,
        isValid: true,
        isPcFormat: true
      };
    } else {
      // Formato numérico simple
      const startNum = parseInt(this.rangeStart);
      const endNum = parseInt(this.rangeEnd);
      
      if (isNaN(startNum) || isNaN(endNum)) {
        return { start: '', end: '', count: 0, isValid: false, isPcFormat: false };
      }
      
      if (startNum > endNum) {
        return { start: '', end: '', count: 0, isValid: false, isPcFormat: false };
      }
      
      const count = endNum - startNum + 1;
      return {
        start: this.rangeStart,
        end: this.rangeEnd,
        count: count,
        isValid: true,
        isPcFormat: false
      };
    }
  }

  /**
   * Genera la lista de nombres de activo en el rango especificado
   */
  generateAssetNumbers(): string[] {
    const rangeInfo = this.getRangeInfo();
    if (!rangeInfo.isValid) return [];

          if (rangeInfo.isPcFormat) {
        // Formato PC: generar PC + número
        const startMatch = this.rangeStart.match(/^PC(\d+)$/);
        const endMatch = this.rangeEnd.match(/^PC(\d+)$/);
      
      if (!startMatch || !endMatch) return [];
      
      const startNum = parseInt(startMatch[1]);
      const endNum = parseInt(endMatch[1]);
      const names: string[] = [];

      for (let i = startNum; i <= endNum; i++) {
        names.push(`PC${i.toString()}`);
      }
      return names;
    } else {
      // Formato numérico simple
      const startNum = parseInt(this.rangeStart);
      const endNum = parseInt(this.rangeEnd);
      const names: string[] = [];

      for (let i = startNum; i <= endNum; i++) {
        names.push(i.toString());
      }
      return names;
    }
  }

  /**
   * Verifica si un nombre de activo ya existe
   */
  isAssetNumberExists(number: string): boolean {
    return this.activos.some(activo => activo.name === number);
  }

  /**
   * Valida el formato del nombre de activo (PC o numérico)
   */
  validateAssetName(name: string): boolean {
    // Formato PC: PC + dígitos
    if (name.match(/^PC\d+$/)) {
      return true;
    }
    
    // Formato numérico: solo números
    if (name.match(/^\d+$/)) {
      return true;
    }
    
    return false;
  }

  /**
   * Valida que ambos rangos tengan el mismo formato
   */
  validateRangeFormat(): { isValid: boolean; isPcFormat: boolean; errorMessage: string } {
    if (!this.rangeStart || !this.rangeEnd) {
      return { isValid: false, isPcFormat: false, errorMessage: 'Debe especificar ambos rangos' };
    }

    const startIsPc = this.rangeStart.match(/^PC\d+$/) !== null;
    const endIsPc = this.rangeEnd.match(/^PC\d+$/) !== null;
    const startIsNumeric = this.rangeStart.match(/^\d+$/) !== null;
    const endIsNumeric = this.rangeEnd.match(/^\d+$/) !== null;

    // Ambos deben ser del mismo formato
    if (startIsPc && endIsPc) {
      return { isValid: true, isPcFormat: true, errorMessage: '' };
    } else if (startIsNumeric && endIsNumeric) {
      return { isValid: true, isPcFormat: false, errorMessage: '' };
    } else {
      return { 
        isValid: false, 
        isPcFormat: false, 
        errorMessage: 'Ambos rangos deben tener el mismo formato (PC + números o solo números)' 
      };
    }
  }

  getFieldDisplayName(fieldName: string): string {
    const fieldNames: { [key: string]: string } = {
      'name': 'Número de Activo',
      'idTipoActivo': 'Tipo de Activo',
      'clasificacionDeINFO': 'Clasificación de INFO',
      'criticidad': 'Criticidad',
      'estado': 'Estado',
      'idNumeroCompra': 'Número de Compra',
      'idItem': 'Item',
      'idEntrega': 'Entrega',
      'idUsuario': 'Usuario',
      'idSecundario': 'ID Secundario',
      'idServicioGarantia': 'Servicio de Garantía',
      'fechaFinGarantia': 'Fecha Fin Garantía'
    };
    return fieldNames[fieldName] || fieldName;
  }

  updateValidationRules() {
    const nameControl = this.activoForm.get('name');
    if (nameControl) {
      if (this.creationMode === 'range') {
        // En modo rango, el nombre no es requerido porque se genera automáticamente
        nameControl.clearValidators();
        nameControl.setValue(''); // Limpiar el valor
      } else {
        // En modo individual, el nombre es requerido
        nameControl.setValidators(Validators.required);
        nameControl.setValue(''); // Limpiar el valor
      }
      nameControl.updateValueAndValidity();
    }
  }

  /**
   * Obtiene el idUsuario correcto basado en el estado del formulario
   */
  private getUserIdFromForm(formData: any): number {
    if (formData.idUsuario) {
      // Si el campo está habilitado, usar el valor del formulario
      return parseInt(formData.idUsuario);
    } else {
      // Si el campo está deshabilitado, obtener el idUsuario del tipo de activo
      const tipoActivo = this.tiposActivoList.find(tipo => tipo.idActivo === parseInt(formData.idTipoActivo));
      if (tipoActivo && tipoActivo.idUsuario) {
        return tipoActivo.idUsuario;
      } else {
        throw new Error('No se pudo determinar el usuario responsable del tipo de activo');
      }
    }
  }
} 