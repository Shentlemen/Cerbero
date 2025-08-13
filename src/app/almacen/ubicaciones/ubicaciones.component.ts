import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ActivoAlmacenService, ActivoAlmacen, ActivoAlmacenCreate } from '../../services/activo-almacen.service';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { ActivosService, ActivoDTO } from '../../services/activos.service';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-ubicaciones',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    NotificationContainerComponent
  ],
  templateUrl: './ubicaciones.component.html',
  styleUrls: ['./ubicaciones.component.css']
})
export class UbicacionesComponent implements OnInit {
  ubicaciones: ActivoAlmacen[] = [];
  ubicacionesFiltradas: ActivoAlmacen[] = [];
  almacenes: Almacen[] = [];
  activos: ActivoDTO[] = [];
  loading: boolean = false;
  error: string | null = null;
  ubicacionForm: FormGroup;
  modoEdicion: boolean = false;
  ubicacionSeleccionada: ActivoAlmacen | null = null;
  ubicacionAEliminar: ActivoAlmacen | null = null;

  // Paginación
  page = 1;
  pageSize = 10;
  collectionSize = 0;

  // Ordenamiento
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Filtrado
  searchTerm: string = '';
  searchResultsCount: number = 0;

  // Propiedades para creación múltiple
  creationMode: 'single' | 'range' = 'single';
  rangeStart: string = '';
  rangeEnd: string = '';

  // Propiedades para búsqueda de activos
  activoSearchTerm: string = '';
  activosFiltrados: ActivoDTO[] = [];
  mostrarDropdownActivos: boolean = false;

  // Propiedades para el diálogo de confirmación
  showConfirmDialog: boolean = false;

  constructor(
    private activoAlmacenService: ActivoAlmacenService,
    private almacenService: AlmacenService,
    private activosService: ActivosService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService
  ) {
    this.ubicacionForm = this.fb.group({
      activoId: [''],
      almacenId: ['', Validators.required],
      estanteria: ['', [Validators.required, Validators.maxLength(50)]],
      estante: ['', [Validators.required, Validators.maxLength(50)]]
    });
    
    // No necesitamos escuchar cambios en activoId ya que updateFormValidation se llama manualmente
  }

  ngOnInit(): void {
    this.cargarDatos();
    // Inicializar activos filtrados
    this.activosFiltrados = [];
  }

  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    // Cargar ubicaciones, almacenes y activos en paralelo
    Promise.all([
      this.activoAlmacenService.getAllUbicaciones().toPromise(),
      this.almacenService.getAllAlmacenes().toPromise(),
      this.activosService.getActivos().toPromise()
    ]).then(([ubicaciones, almacenes, activos]) => {
      if (ubicaciones) {
        this.ubicaciones = ubicaciones;
        this.ubicacionesFiltradas = [...this.ubicaciones];
        this.actualizarPaginacion();
      }

      if (almacenes) {
        this.almacenes = almacenes;
      }

      if (activos) {
        this.activos = activos;
      }

      this.loading = false;
    }).catch(error => {
      console.error('Error al cargar datos:', error);
      this.error = 'Error al cargar datos. Por favor, intente nuevamente.';
      this.loading = false;
    });
  }

  abrirModalUbicacion(modal: any, ubicacion?: ActivoAlmacen): void {
    this.modoEdicion = !!ubicacion;
    this.ubicacionSeleccionada = ubicacion || null;

    console.log('=== DEBUG: Abriendo modal ===');
    console.log('modoEdicion:', this.modoEdicion);
    console.log('creationMode antes:', this.creationMode);

    if (this.modoEdicion && ubicacion) {
      // Modo edición: cargar datos existentes
      this.ubicacionForm.patchValue({
        activoId: ubicacion.activoId,
        almacenId: ubicacion.almacen.id,
        estanteria: ubicacion.estanteria,
        estante: ubicacion.estante
      });
      
      // En modo edición, siempre usar modo individual y ocultar opciones de múltiples activos
      this.creationMode = 'single';
      this.rangeStart = '';
      this.rangeEnd = '';
    } else {
      // Modo creación: resetear formulario y permitir selección de modo
      this.ubicacionForm.reset();
      // No forzar creationMode = 'single', permitir que el usuario elija
      this.rangeStart = '';
      this.rangeEnd = '';
      // Inicializar búsqueda de activos
      this.activoSearchTerm = '';
      this.activosFiltrados = [...this.activos];
      this.mostrarDropdownActivos = false;
    }

    console.log('creationMode después:', this.creationMode);
    console.log('modoEdicion final:', this.modoEdicion);

    // Actualizar validaciones después de configurar el formulario
    this.updateFormValidation();
    this.modalService.open(modal, { size: 'lg' });
  }

  guardarUbicacion(): void {
    if (this.isFormValid()) {
      // Verificar permisos antes de proceder
      if (!this.canManageUbicaciones()) {
        this.notificationService.showError(
          'Permisos Insuficientes',
          'No tienes permisos para gestionar ubicaciones. Solo los administradores y Game Masters pueden realizar esta acción.'
        );
        return;
      }

      if (this.creationMode === 'range') {
        this.guardarUbicacionesMultiples();
      } else {
        this.guardarUbicacionIndividual();
      }
    }
  }

  private guardarUbicacionIndividual(): void {
    const formData = this.ubicacionForm.value;
    const nuevaUbicacion: ActivoAlmacenCreate = {
      activoId: formData.activoId,
      almacenId: formData.almacenId,
      estanteria: formData.estanteria,
      estante: formData.estante
    };

    if (this.modoEdicion && this.ubicacionSeleccionada) {
      // Actualizar ubicación existente
      this.activoAlmacenService.updateUbicacion(this.ubicacionSeleccionada.id, nuevaUbicacion).subscribe({
        next: () => {
          this.modalService.dismissAll();
          this.cargarDatos();
        },
        error: (error) => {
          console.error('Error al actualizar ubicación:', error);
        }
      });
    } else {
      // Crear nueva ubicación
      this.activoAlmacenService.createUbicacion(nuevaUbicacion).subscribe({
        next: () => {
          this.modalService.dismissAll();
          this.cargarDatos();
        },
        error: (error) => {
          console.error('Error al crear ubicación:', error);
        }
      });
    }
  }

  private async guardarUbicacionesMultiples(): Promise<void> {
    const formData = this.ubicacionForm.value;
    
    console.log('=== DEBUG: Iniciando creación de ubicaciones múltiples ===');
    console.log('FormData:', formData);
    console.log('RangeStart:', this.rangeStart);
    console.log('RangeEnd:', this.rangeEnd);
    
    // Validar que se hayan ingresado los rangos
    if (!this.rangeStart || !this.rangeEnd) {
      this.notificationService.showError(
        'Error de Validación',
        'Debe especificar el rango de números (inicio y fin).'
      );
      return;
    }
    
    // Validar formato de los rangos
    const formatValidation = this.validateRangeFormat();
    if (!formatValidation.isValid) {
      this.notificationService.showError(
        'Error de Formato',
        formatValidation.errorMessage
      );
      return;
    }
    
    const rangeInfo = this.getRangeInfo();
    console.log('RangeInfo:', rangeInfo);
    
    if (!rangeInfo.isValid || rangeInfo.count <= 0) {
      this.notificationService.showError(
        'Error de Rango',
        'El número inicial debe ser menor al número final.'
      );
      return;
    }

    if (rangeInfo.count > 1000) {
      this.notificationService.showError(
        'Rango Demasiado Grande',
        'El máximo de activos por operación es 1000.'
      );
      return;
    }

    // Verificar que todos los activos existan antes de proceder
    const activosInfo = this.getActivosInfo();
    console.log('ActivosInfo:', activosInfo);
    
    if (!activosInfo.isValid) {
      this.notificationService.showError(
        'Activos No Encontrados',
        activosInfo.errorMessage || 'Algunos activos del rango no fueron encontrados.'
      );
      return;
    }

    // Mostrar indicador de progreso
    this.loading = true;

    try {
      const ubicacionesACrear: ActivoAlmacenCreate[] = [];
      
      // Crear ubicaciones para cada activo encontrado
      for (const activo of activosInfo.activos) {
        ubicacionesACrear.push({
          activoId: activo.idActivo,
          almacenId: formData.almacenId,
          estanteria: formData.estanteria,
          estante: formData.estante
        });
      }

      console.log('Ubicaciones a crear:', ubicacionesACrear);

      // Crear todas las ubicaciones en una sola operación
      try {
        const ubicacionesCreadas = await firstValueFrom(
          this.activoAlmacenService.createUbicacionesBatch(ubicacionesACrear)
        );
        
        console.log('Ubicaciones creadas exitosamente:', ubicacionesCreadas);
        
        this.modalService.dismissAll();
        this.cargarDatos();
        
        this.notificationService.showSuccess(
          'Ubicaciones Creadas',
          `Se crearon exitosamente ${ubicacionesCreadas.length} ubicaciones.`
        );
        
      } catch (error) {
        console.error('Error al crear ubicaciones en lote:', error);
        this.notificationService.showError(
          'Error',
          'Error al crear las ubicaciones. Por favor, intente nuevamente.'
        );
      }

    } catch (error) {
      console.error('Error al preparar ubicaciones:', error);
      this.notificationService.showError(
        'Error',
        'Error al preparar las ubicaciones. Por favor, intente nuevamente.'
      );
    } finally {
      this.loading = false;
    }
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

  getActivosInfo(): { 
    count: number; 
    isValid: boolean; 
    activos: any[];
    errorMessage?: string;
  } {
    const rangeInfo = this.getRangeInfo();
    if (!rangeInfo.isValid) {
      return { count: 0, isValid: false, activos: [] };
    }

    // Generar todos los nombres del rango
    const nombres = this.generateAssetNumbers();
    if (nombres.length === 0) {
      return { count: 0, isValid: false, activos: [] };
    }

    // Buscar activos por nombre
    const activosEncontrados = [];
    const noEncontrados = [];

    for (const nombre of nombres) {
      const activo = this.activos.find(a => a.name === nombre);
      if (activo) {
        activosEncontrados.push(activo);
      } else {
        noEncontrados.push(nombre);
      }
    }

    if (noEncontrados.length > 0) {
      return {
        count: 0,
        isValid: false,
        activos: [],
        errorMessage: `Los siguientes activos no fueron encontrados: ${noEncontrados.slice(0, 5).join(', ')}${noEncontrados.length > 5 ? '...' : ''}`
      };
    }

    return {
      count: activosEncontrados.length,
      isValid: true,
      activos: activosEncontrados
    };
  }

  confirmarEliminacion(ubicacion: ActivoAlmacen): void {
    this.ubicacionAEliminar = ubicacion;
    this.showConfirmDialog = true;
  }

  eliminarUbicacion(): void {
    if (this.ubicacionAEliminar) {
      this.activoAlmacenService.deleteUbicacion(this.ubicacionAEliminar.id).subscribe({
        next: () => {
          this.showConfirmDialog = false;
          this.ubicacionAEliminar = null;
          this.cargarDatos();
        },
        error: (error) => {
          console.error('Error al eliminar ubicación:', error);
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.ubicacionAEliminar = null;
  }

  filtrarUbicaciones(): void {
    if (!this.searchTerm.trim()) {
      this.ubicacionesFiltradas = [...this.ubicaciones];
    } else {
      const termino = this.searchTerm.toLowerCase();
      this.ubicacionesFiltradas = this.ubicaciones.filter(ubicacion => {
        // Buscar por activo (prioridad alta)
        const activo = this.activos.find(a => a.idActivo === ubicacion.activoId);
        const activoName = activo?.name || '';
        
        // Si el término coincide con el nombre del activo, dar prioridad
        if (activoName.toLowerCase().includes(termino)) {
          return true;
        }
        
        // Buscar por almacén
        const almacenNumero = ubicacion.almacen.numero || '';
        const almacenNombre = ubicacion.almacen.nombre || '';
        
        return almacenNumero.toLowerCase().includes(termino) ||
               almacenNombre.toLowerCase().includes(termino);
      });
    }
    this.actualizarPaginacion();
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.ubicacionesFiltradas.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (column) {
        case 'activo':
          const activoA = this.activos.find(act => act.idActivo === a.activoId);
          const activoB = this.activos.find(act => act.idActivo === b.activoId);
          valueA = activoA?.name || '';
          valueB = activoB?.name || '';
          break;
        case 'almacen':
          valueA = a.almacen.numero;
          valueB = b.almacen.numero;
          break;
        case 'estanteria':
          valueA = a.estanteria;
          valueB = b.estanteria;
          break;
        case 'estante':
          valueA = a.estante;
          valueB = b.estante;
          break;
        default:
          return 0;
      }

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

  getActivoName(activoId: number): string {
    const activo = this.activos.find(a => a.idActivo === activoId);
    return activo?.name || 'Activo no encontrado';
  }

  /**
   * Resalta el término de búsqueda en el texto del activo
   */
  highlightActivoName(activoId: number): string {
    const activoName = this.getActivoName(activoId);
    
    if (!this.searchTerm.trim()) {
      return activoName;
    }
    
    const termino = this.searchTerm.toLowerCase();
    const index = activoName.toLowerCase().indexOf(termino);
    
    if (index >= 0) {
      const before = activoName.substring(0, index);
      const match = activoName.substring(index, index + this.searchTerm.length);
      const after = activoName.substring(index + this.searchTerm.length);
      
      return `${before}<mark class="bg-warning">${match}</mark>${after}`;
    }
    
    return activoName;
  }

  /**
   * Verifica si el activo coincide con el término de búsqueda
   */
  isActivoMatch(activoId: number): boolean {
    if (!this.searchTerm.trim()) {
      return false;
    }
    
    const activoName = this.getActivoName(activoId);
    return activoName.toLowerCase().includes(this.searchTerm.toLowerCase());
  }

  /**
   * Verifica si el almacén coincide con el término de búsqueda
   */
  isAlmacenMatch(almacen: any): boolean {
    if (!this.searchTerm.trim()) {
      return false;
    }
    
    const almacenNumero = almacen.numero || '';
    const almacenNombre = almacen.nombre || '';
    const termino = this.searchTerm.toLowerCase();
    
    return almacenNumero.toLowerCase().includes(termino) ||
           almacenNombre.toLowerCase().includes(termino);
  }

  /**
   * Limpia la búsqueda
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.filtrarUbicaciones();
  }

  /**
   * Obtiene el número de activos que coinciden con la búsqueda
   */
  getActivoMatchesCount(): number {
    if (!this.searchTerm.trim()) {
      return 0;
    }
    
    return this.ubicacionesFiltradas.filter(ubicacion => 
      this.isActivoMatch(ubicacion.activoId)
    ).length;
  }

  /**
   * Obtiene el número de almacenes que coinciden con la búsqueda
   */
  getAlmacenMatchesCount(): number {
    if (!this.searchTerm.trim()) {
      return 0;
    }
    
    return this.ubicacionesFiltradas.filter(ubicacion => 
      this.isAlmacenMatch(ubicacion.almacen)
    ).length;
  }

  private actualizarPaginacion(): void {
    this.collectionSize = this.ubicacionesFiltradas.length;
    this.searchResultsCount = this.ubicacionesFiltradas.length;
    this.page = 1;
  }

  get pagedUbicaciones(): ActivoAlmacen[] {
    const start = (this.page - 1) * this.pageSize;
    const end = this.page * this.pageSize;
    return this.ubicacionesFiltradas.slice(start, end);
  }

  canManageUbicaciones(): boolean {
    return this.permissionsService.canManageAssets();
  }

  /**
   * Actualiza las validaciones del formulario según el modo de creación
   */
  updateFormValidation(): void {
    const activoIdControl = this.ubicacionForm.get('activoId');
    
    if (this.creationMode === 'single') {
      // En modo individual, el activo es requerido
      activoIdControl?.setValidators([Validators.required]);
    } else {
      // En modo batch, el activo no es requerido
      activoIdControl?.clearValidators();
    }
    
    activoIdControl?.updateValueAndValidity();
  }

  /**
   * Maneja el cambio de modo de creación
   */
  onCreationModeChange(): void {
    // Limpiar el campo activoId cuando se cambia a modo batch
    if (this.creationMode === 'range') {
      this.ubicacionForm.patchValue({ activoId: '' });
    }
    
    this.updateFormValidation();
  }

  /**
   * Verifica si el formulario es válido según el modo de creación
   */
  isFormValid(): boolean {
    try {
      if (this.creationMode === 'single') {
        // En modo individual, validar todo el formulario
        return this.ubicacionForm.valid;
      } else {
        // En modo batch, validar solo almacén, estantería y estante
        // También validar que se hayan ingresado los rangos
        const basicFieldsValid = !!(this.ubicacionForm.get('almacenId')?.valid &&
                                this.ubicacionForm.get('estanteria')?.valid &&
                                this.ubicacionForm.get('estante')?.valid);
        
        // Validar que los rangos estén completos
        if (!this.rangeStart || !this.rangeEnd) {
          return false;
        }
        
        const rangeInfo = this.getRangeInfo();
        const activosInfo = this.getActivosInfo();
        
        const rangeValid = rangeInfo.isValid && activosInfo.isValid;
        
        return basicFieldsValid && rangeValid;
      }
    } catch (error) {
      console.error('Error en validación del formulario:', error);
      return false;
    }
  }

  // Métodos para búsqueda de activos
  filtrarActivos(): void {
    if (!this.activoSearchTerm.trim()) {
      this.activosFiltrados = [...this.activos];
      return;
    }
    
    const searchTerm = this.activoSearchTerm.toLowerCase().trim();
    this.activosFiltrados = this.activos.filter(activo => 
      activo.name.toLowerCase().includes(searchTerm)
    );
  }

  seleccionarActivo(activo: ActivoDTO): void {
    this.ubicacionForm.patchValue({ activoId: activo.idActivo });
    this.activoSearchTerm = activo.name;
    this.mostrarDropdownActivos = false;
    this.activosFiltrados = [];
  }

  onActivoBlur(): void {
    // Pequeño delay para permitir que el click en la opción se ejecute
    setTimeout(() => {
      this.mostrarDropdownActivos = false;
    }, 200);
  }
} 