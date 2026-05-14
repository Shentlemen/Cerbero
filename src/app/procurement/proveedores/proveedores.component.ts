import { Component, OnDestroy, OnInit, ViewEncapsulation, ChangeDetectorRef, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { ProveedoresService, ProveedorDTO } from '../../services/proveedores.service';
import { ContactosService, ContactoDTO } from '../../services/contactos.service';
import { PermissionsService } from '../../services/permissions.service';
import { TourRegistryService } from '../../services/tour-registry.service';
import { GuidedTourHostService } from '../../services/guided-tour-host.service';
import { driver, type DriveStep, type Driver } from 'driver.js';

/** Paso del tour DEMO con cambio de pestaña por número (proveedor usa `activeTab: number`). */
interface ProveedorDemoStep {
  selector: string;
  title: string;
  description: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  tab?: number;
}

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule, NgbNavModule],
  templateUrl: './proveedores.component.html',
  styleUrls: ['./proveedores.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ProveedoresComponent implements OnInit, OnDestroy {
  proveedoresList: ProveedorDTO[] = [];
  proveedoresFiltrados: ProveedorDTO[] = [];
  filterForm: FormGroup;
  proveedorForm: FormGroup;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 20;
  collectionSize = 0;
  loading = false;
  error: string | null = null;
  modoEdicion = false;
  proveedorSeleccionado: ProveedorDTO | null = null;
  showConfirmDialog = false;
  proveedorToDelete: number | null = null;
  contactosFormArray: FormArray;
  contactosCargados: boolean = false;
  contactosEliminados: number[] = [];
  activeTab: number = 0;
  contactosVista: ContactoDTO[] = [];
  proveedorVistaNombre: string = '';
  /** Validación y errores del modal crear/editar proveedor (pie del modal, como tickets/compras). */
  proveedorModalValidacion: { titulo: string; lineas: string[]; esError: boolean } | null = null;
  private tourCleanup?: () => void;

  @ViewChild('proveedorModal') proveedorModalTpl!: TemplateRef<unknown>;

  /** Driver activo del tour DEMO (para destruirlo al desmontar). */
  private tourProveedor?: Driver;
  /** Ref al modal abierto en modo demo, para cerrarlo programáticamente al finalizar. */
  private tourDemoModalRef?: { close: () => void; dismiss: () => void; result: Promise<unknown> };
  /** Bandera que el modal usa para mostrar modo demo y bloquear el guardado. */
  tourDemoActivo = false;

  readonly fb: FormBuilder;

  constructor(
    private proveedoresService: ProveedoresService,
    fb: FormBuilder,
    private modalService: NgbModal,
    private contactosService: ContactosService,
    private permissionsService: PermissionsService,
    private cdr: ChangeDetectorRef,
    private tourRegistry: TourRegistryService,
    private guidedTourHost: GuidedTourHostService
  ) {
    this.fb = fb;
    this.filterForm = this.fb.group({
      nombre: [''],
      nombreComercial: ['']
    });

    this.proveedorForm = this.fb.group({
      nombre: [''], // Solo nombre comercial es obligatorio
      correoContacto: ['', [Validators.email]],
      telefonoContacto: ['', [Validators.pattern(/^[\+]?[0-9\s\-\(\)]{7,20}$/)]],
      nombreComercial: ['', [Validators.required, Validators.minLength(3)]],
      direccion: [''],
      observaciones: [''],
      rut: [''],
      webEmpresa: ['', [Validators.pattern(/^https?:\/\/.+/)]],
      webVenta: ['', [Validators.pattern(/^https?:\/\/.+/)]]
    });
    this.contactosFormArray = this.fb.array([]);

    // Suscribirse a cambios en el formulario de filtro
    this.filterForm.valueChanges.subscribe(() => {
      this.aplicarFiltros();
    });

    this.proveedorForm.valueChanges.subscribe(() => this.limpiarFeedbackProveedorModal());
    this.contactosFormArray.valueChanges.subscribe(() => this.limpiarFeedbackProveedorModal());
  }

  limpiarFeedbackProveedorModal(): void {
    this.proveedorModalValidacion = null;
  }

  private mensajeErrorHttp(error: unknown): string {
    const e = error as { error?: string | { message?: string }; message?: string };
    const body = e?.error;
    if (typeof body === 'string') {
      return body;
    }
    if (body && typeof body === 'object' && typeof body.message === 'string') {
      return body.message;
    }
    if (typeof e?.message === 'string') {
      return e.message;
    }
    return 'Ocurrió un error inesperado.';
  }

  ngOnInit(): void {
    this.loadProveedores();
    const tours = [
      {
        id: 'proveedores-overview',
        title: 'Tour de proveedores',
        icon: 'fa-route',
        steps: [
          { selector: '#tour-proveedores-title', title: 'Proveedores', description: 'Directorio de proveedores con datos comerciales y contactos asociados a compras.', side: 'bottom' as const },
          { selector: '#tour-proveedores-nuevo', title: 'Nuevo proveedor', description: 'Alta rápida con pestañas de datos y contactos (si tenés permiso de gestión).', side: 'left' as const },
          { selector: '#tour-proveedores-search', title: 'Búsqueda', description: 'Filtrá por nombre comercial sin recargar la página.', side: 'bottom' as const },
          { selector: '#tour-proveedores-table', title: 'Listado', description: 'Ordená columnas, editá o eliminá; podés ver contactos en modal.', side: 'top' as const }
        ],
        afterEnd: () => this.resetScrollToTop()
      },
      ...(this.canManageProviders()
        ? [{
            id: 'proveedores-crear-detalle',
            title: 'Cómo crear un proveedor',
            icon: 'fa-plus-circle',
            description: 'Abre el modal con un proveedor DEMO pre-cargado y recorre las pestañas Datos y Contactos.',
            run: () => this.runTourCrearProveedor(),
          }]
        : [])
    ];
    this.tourCleanup = this.tourRegistry.register('proveedores', tours);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
    this.tourProveedor?.destroy();
    this.tourProveedor = undefined;
  }

  /**
   * Vuelve la ventana al tope tras finalizar el tour. Se usa `requestAnimationFrame` anidado
   * para que la animación corra después de que el host de tours restaure el zoom global.
   */
  private resetScrollToTop(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
          window.scrollTo(0, 0);
        }
      });
    });
  }

  loadProveedores(): void {
    this.loading = true;
    this.error = null;
    
    this.proveedoresService.getProveedores().subscribe({
      next: (proveedores) => {
        this.proveedoresList = proveedores;
        this.proveedoresFiltrados = [...this.proveedoresList];
        this.collectionSize = this.proveedoresFiltrados.length;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar los proveedores:', error);
        this.error = 'Error al cargar los proveedores. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  get pagedProveedores(): ProveedorDTO[] {
    const startItem = (this.page - 1) * this.pageSize;
    const endItem = this.page * this.pageSize;
    return this.proveedoresFiltrados.slice(startItem, endItem);
  }

  sortData(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.proveedoresFiltrados.sort((a, b) => {
      let valueA = a[column as keyof ProveedorDTO];
      let valueB = b[column as keyof ProveedorDTO];

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

  abrirModal(modal: any, proveedor?: ProveedorDTO): void {
    this.activeTab = 1;
    this.proveedorModalValidacion = null;
    if (proveedor) {
      this.modoEdicion = true;
      this.proveedorSeleccionado = proveedor;
      
      // Preparar los datos del proveedor para el formulario
      
      // Preparar los datos del proveedor para el formulario
      const datosProveedor = {
        nombre: proveedor.nombre || '',
        nombreComercial: proveedor.nombreComercial || '',
        rut: proveedor.rut || '', // Si RUT es undefined, será cadena vacía
        correoContacto: proveedor.correoContacto || '',
        telefonoContacto: proveedor.telefonoContacto || '',
        direccion: proveedor.direccion === 'Sin especificar' ? '' : (proveedor.direccion || ''),
        observaciones: proveedor.observaciones || '', // Si observaciones es null, será cadena vacía
        webEmpresa: proveedor.webEmpresa || '',
        webVenta: proveedor.webVenta || ''
      };
      
      // Cargar todos los datos del proveedor en el formulario
      this.proveedorForm.patchValue(datosProveedor);
      
      // Forzar la detección de cambios
      this.cdr.detectChanges();
      
      this.cargarContactosProveedor(proveedor.idProveedores);
    } else {
      this.modoEdicion = false;
      this.proveedorSeleccionado = null;
      this.proveedorForm.reset();
      this.contactosFormArray.clear();
      this.contactosEliminados = [];
      this.contactosCargados = true;
      // No agregar contacto automáticamente, el usuario debe hacerlo manualmente
    }
    this.modalService.open(modal, {
      size: 'lg',
      backdrop: true,
      windowClass: 'proveedor-form-modal-window'
    });
  }

  cargarContactosProveedor(idProveedores: number) {
    this.contactosFormArray.clear();
    this.contactosEliminados = [];
    this.contactosCargados = false;
    this.contactosService.obtenerContactosPorProveedor(idProveedores).subscribe({
      next: (contactos) => {
        contactos.forEach(contacto => {
          this.contactosFormArray.push(this.fb.group({
            idContacto: [contacto.idContacto],
            nombre: [contacto.nombre, Validators.required],
            telefono: [contacto.telefono || ''],
            email: [contacto.email || ''],
            cargo: [contacto.cargo || ''],
            observaciones: [contacto.observaciones || ''],
            idProveedores: [contacto.idProveedores]
          }));
        });
        this.contactosCargados = true;
      },
      error: () => {
        this.contactosCargados = true;
      }
    });
  }

  get contactosControls() {
    return (this.contactosFormArray.controls as FormGroup[] || []);
  }

  obtenerErroresFormulario(): string[] {
    const errores: string[] = [];
    const controls = this.proveedorForm.controls;

    // Solo validar nombreComercial como obligatorio
    if (controls['nombreComercial']?.errors?.['required']) {
      errores.push('El nombre comercial es requerido');
    }
    if (controls['nombreComercial']?.errors?.['minlength']) {
      errores.push('El nombre comercial debe tener al menos 3 caracteres');
    }

    if (controls['correoContacto']?.errors?.['email']) {
      errores.push('El correo de contacto debe tener un formato válido');
    }

    if (controls['telefonoContacto']?.errors?.['pattern']) {
      errores.push('El formato del teléfono no es válido');
    }

    if (controls['webEmpresa']?.errors?.['pattern']) {
      errores.push('El sitio web de la empresa debe tener un formato válido (debe comenzar con http:// o https://)');
    }

    if (controls['webVenta']?.errors?.['pattern']) {
      errores.push('El sitio web de ventas debe tener un formato válido (debe comenzar con http:// o https://)');
    }

    return errores;
  }

  agregarContacto() {
    this.contactosFormArray.push(this.fb.group({
      idContacto: [null],
      nombre: ['', Validators.required],
      telefono: [''],
      email: ['', [Validators.email]],
      cargo: [''],
      observaciones: [''],
      idProveedores: [this.proveedorSeleccionado?.idProveedores || null]
    }));
  }

  eliminarContacto(index: number) {
    const contacto = this.contactosFormArray.at(index).value;
    if (contacto.idContacto) {
      this.contactosEliminados.push(contacto.idContacto);
    }
    this.contactosFormArray.removeAt(index);
  }

  guardarProveedor(): void {
    if (this.tourDemoActivo) {
      this.tourDemoModalRef?.dismiss();
      return;
    }
    this.proveedorModalValidacion = null;

    Object.keys(this.proveedorForm.controls).forEach(key => {
      this.proveedorForm.get(key)?.markAsTouched();
    });

    if (!this.proveedorForm.valid) {
      const lineas = this.obtenerErroresFormulario();
      this.proveedorModalValidacion = {
        titulo: 'Revisá el formulario antes de guardar',
        lineas: lineas.length > 0 ? lineas : ['Hay campos con datos inválidos.'],
        esError: false
      };
      return;
    }

    if (this.contactosFormArray.length === 0) {
      this.proveedorModalValidacion = {
        titulo: 'Revisá los contactos',
        lineas: ['Debés agregar al menos un contacto para el proveedor.'],
        esError: false
      };
      return;
    }

    const contactosConNombre = this.contactosFormArray.controls.filter(control => {
      const contacto = control.value;
      return contacto.nombre && contacto.nombre.trim() !== '';
    });

    if (contactosConNombre.length === 0) {
      this.contactosFormArray.controls.forEach(c => c.markAllAsTouched());
      this.proveedorModalValidacion = {
        titulo: 'Revisá los contactos',
        lineas: ['Completá al menos un contacto con el nombre.'],
        esError: false
      };
      return;
    }

    const contactosInvalidos = this.contactosFormArray.controls.some(control => {
      const contacto = control.value;
      if (contacto.nombre && contacto.nombre.trim() !== '') {
        return !contacto.nombre || contacto.nombre.trim() === '';
      }
      return false;
    });

    if (contactosInvalidos) {
      this.contactosFormArray.controls.forEach(c => c.markAllAsTouched());
      this.proveedorModalValidacion = {
        titulo: 'Revisá los contactos',
        lineas: ['Cada contacto cargado debe tener el nombre completado.'],
        esError: false
      };
      return;
    }

    const proveedorData = this.proveedorForm.value;

    if (!proveedorData.direccion || proveedorData.direccion.trim() === '') {
      proveedorData.direccion = 'Sin especificar';
    }

    if (proveedorData.correoContacto && proveedorData.correoContacto.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(proveedorData.correoContacto)) {
        this.proveedorModalValidacion = {
          titulo: 'Revisá el correo del proveedor',
          lineas: ['El correo electrónico no tiene un formato válido.'],
          esError: false
        };
        return;
      }
    }

    if (this.modoEdicion && this.proveedorSeleccionado) {
      if (!this.proveedorSeleccionado.idProveedores || isNaN(this.proveedorSeleccionado.idProveedores)) {
        this.proveedorModalValidacion = {
          titulo: 'No se pudo guardar',
          lineas: ['ID de proveedor no válido.'],
          esError: true
        };
        return;
      }

      const proveedorActualizado: ProveedorDTO = {
        ...proveedorData,
        idProveedores: this.proveedorSeleccionado.idProveedores
      };

      this.proveedorModalValidacion = null;
      this.proveedoresService.actualizarProveedor(this.proveedorSeleccionado.idProveedores, proveedorActualizado).subscribe({
        next: (actualizado) => {
          this.sincronizarContactos(actualizado.idProveedores);
          this.loadProveedores();
          this.modalService.dismissAll();
          this.proveedorModalValidacion = null;
        },
        error: (error) => {
          this.proveedorModalValidacion = {
            titulo: 'Error al actualizar el proveedor',
            lineas: [this.mensajeErrorHttp(error)],
            esError: true
          };
        }
      });
    } else {
      this.proveedorModalValidacion = null;
      this.proveedoresService.crearProveedor(proveedorData).subscribe({
        next: (proveedorCreado) => {
          this.guardarContactosNuevos(proveedorCreado.idProveedores);
          this.loadProveedores();
          this.modalService.dismissAll();
          this.proveedorModalValidacion = null;
        },
        error: (error) => {
          this.proveedorModalValidacion = {
            titulo: 'Error al crear el proveedor',
            lineas: [this.mensajeErrorHttp(error)],
            esError: true
          };
        }
      });
    }
  }

  guardarContactosNuevos(idProveedores: number) {
    for (const grupo of this.contactosFormArray.controls) {
      const contacto = grupo.value;
      if (!contacto.idContacto) {
        contacto.idProveedores = idProveedores;
        this.contactosService.crearContacto(contacto).subscribe();
      }
    }
  }

  sincronizarContactos(idProveedores: number) {
    // Eliminar contactos marcados
    for (const id of this.contactosEliminados) {
      this.contactosService.eliminarContacto(id).subscribe();
    }
    // Crear o actualizar contactos
    for (const grupo of this.contactosFormArray.controls) {
      const contacto = grupo.value;
      contacto.idProveedores = idProveedores;
      if (contacto.idContacto) {
        this.contactosService.actualizarContacto(contacto.idContacto, contacto).subscribe();
      } else {
        this.contactosService.crearContacto(contacto).subscribe();
      }
    }
  }

  aplicarFiltros(): void {
    const filtros = this.filterForm.value;
    
    this.proveedoresFiltrados = this.proveedoresList.filter(proveedor => {
      let cumpleFiltros = true;

      if (filtros.nombre && proveedor.nombre) {
        cumpleFiltros = cumpleFiltros && 
          proveedor.nombre.toLowerCase().includes(filtros.nombre.toLowerCase());
      }

      if (filtros.nombreComercial && proveedor.nombreComercial) {
        cumpleFiltros = cumpleFiltros && 
          proveedor.nombreComercial.toLowerCase().includes(filtros.nombreComercial.toLowerCase());
      }

      return cumpleFiltros;
    });

    this.collectionSize = this.proveedoresFiltrados.length;
    this.page = 1;
  }

  eliminarProveedor(id: number): void {
    this.proveedorToDelete = id;
    this.showConfirmDialog = true;
  }

  confirmarEliminacion(): void {
    if (this.proveedorToDelete) {
      this.proveedoresService.eliminarProveedor(this.proveedorToDelete).subscribe({
        next: () => {
          this.loadProveedores();
          this.showConfirmDialog = false;
          this.proveedorToDelete = null;
          this.error = null;
        },
        error: (error) => {
          console.error('Error al eliminar el proveedor:', error);
          this.error = error.message;
          this.showConfirmDialog = false;
          this.proveedorToDelete = null;
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.proveedorToDelete = null;
  }

  verContactosProveedor(proveedor: ProveedorDTO, modal: any) {
    this.contactosVista = [];
    this.proveedorVistaNombre = proveedor.nombre;
    this.contactosService.obtenerContactosPorProveedor(proveedor.idProveedores).subscribe({
      next: (contactos) => {
        this.contactosVista = contactos;
        this.modalService.open(modal, { size: 'xl' });
      },
      error: () => {
        this.contactosVista = [];
        this.modalService.open(modal, { size: 'xl' });
      }
    });
  }

  canManageProviders(): boolean {
    return this.permissionsService.canManageProviders();
  }

  getDisplayUrl(url: string): string {
    if (!url) return '';
    return url.replace(/^https?:\/\//, '');
  }

  // -------------------------------------------------------------------------
  // Tour DEMO «Cómo crear un proveedor»
  // -------------------------------------------------------------------------

  private esperarSelectores(
    selectores: string[],
    timeoutMs: number = 2500,
    intervalMs: number = 60
  ): Promise<string[]> {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const presentes = selectores.filter((sel) => document.querySelector(sel));
        if (presentes.length === selectores.length || Date.now() - start >= timeoutMs) {
          resolve(presentes);
          return;
        }
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  /** Llena el formulario con datos demo y activa la bandera `tourDemoActivo`. */
  private prepararProveedorDemo(): void {
    this.tourDemoActivo = true;
    this.modoEdicion = false;
    this.activeTab = 1;
    this.proveedorSeleccionado = null;
    this.proveedorModalValidacion = null;
    this.contactosEliminados = [];

    this.proveedorForm.reset();
    this.proveedorForm.patchValue({
      nombre: 'Empresa DEMO S.A.',
      nombreComercial: 'EmpresaDEMO',
      rut: '210000000019',
      webEmpresa: 'https://www.empresa-demo.com',
      webVenta: 'https://tienda.empresa-demo.com',
      correoContacto: 'contacto@empresa-demo.com',
      telefonoContacto: '+598 2000 0000',
      direccion: 'Av. Demostración 1234, Montevideo',
      observaciones: 'Proveedor de demostración para el tutorial. No representa datos reales.'
    });

    this.contactosFormArray.clear();
    this.contactosFormArray.push(this.fb.group({
      idContacto: [null],
      nombre: ['Juan Pérez (DEMO)', Validators.required],
      telefono: ['+598 99 000 000'],
      email: ['juan.perez@empresa-demo.com', [Validators.email]],
      cargo: ['Ejecutivo de cuentas'],
      observaciones: ['Contacto principal para órdenes de compra.'],
      idProveedores: [null]
    }));
    this.contactosCargados = true;

    this.cdr.detectChanges();
  }

  /** Limpia todo lo que dejó el demo cuando se cierra el modal o el tour. */
  private finalizarTourDemo(): void {
    if (!this.tourDemoActivo) {
      return;
    }
    this.tourDemoActivo = false;
    this.modoEdicion = false;
    this.proveedorForm.reset();
    this.contactosFormArray.clear();
    this.contactosEliminados = [];
    this.contactosCargados = false;
    this.proveedorModalValidacion = null;
    this.tourDemoModalRef = undefined;
    this.cdr.detectChanges();
  }

  /** Abre el modal con datos demo y lanza el driver con cambio de pestaña por dirección. */
  private runTourCrearProveedor(): void {
    this.tourProveedor?.destroy();
    this.tourProveedor = undefined;
    this.modalService.dismissAll();

    if (!this.canManageProviders()) {
      return;
    }

    this.prepararProveedorDemo();
    this.tourDemoModalRef = this.modalService.open(this.proveedorModalTpl, {
      size: 'lg',
      backdrop: 'static',
      windowClass: 'proveedor-form-modal-window'
    });
    this.tourDemoModalRef.result.then(
      () => this.finalizarTourDemo(),
      () => this.finalizarTourDemo()
    );

    const pasos: ProveedorDemoStep[] = [
      // ---------- PESTAÑA 1: DATOS ----------
      { tab: 1, selector: '#tour-prov-edit-header', title: 'Crear proveedor (DEMO)',
        description: 'Acá creás un proveedor desde cero. El header naranja indica que estás en <strong>modo DEMO</strong>: el botón Guardar está bloqueado para que puedas explorar sin riesgo.', side: 'bottom' },
      { tab: 1, selector: '#tour-prov-edit-tabs', title: 'Dos pestañas',
        description: 'El alta se divide en <strong>Datos del proveedor</strong> y <strong>Contactos</strong>. Los datos identifican a la empresa; los contactos son las personas con las que hablás.', side: 'bottom' },
      { tab: 1, selector: '#tour-prov-edit-row-nombres', title: 'Nombre y Nombre Comercial',
        description: '<strong>Nombre</strong> es la razón social formal (opcional). <strong>Nombre Comercial</strong> es como se lo conoce y aparece en la grilla; es <strong>obligatorio</strong> y debe tener al menos 3 caracteres.', side: 'top' },
      { tab: 1, selector: '#tour-prov-edit-row-rut-web', title: 'RUT y Sitio Web Empresa',
        description: '<strong>RUT</strong>: identificador fiscal (opcional pero recomendado para emisión de OC). <strong>Sitio Web</strong>: URL completa (debe arrancar con <code>http://</code> o <code>https://</code>).', side: 'top' },
      { tab: 1, selector: '#tour-prov-edit-row-web-venta', title: 'Sitio Web de Ventas',
        description: 'URL del e-commerce o portal de catálogo del proveedor (opcional). Útil para cotizar rápido. Mismo formato que el sitio principal.', side: 'top' },
      { tab: 1, selector: '#tour-prov-edit-row-contacto-empresa', title: 'Correo y Teléfono institucional',
        description: 'Datos de contacto <strong>generales de la empresa</strong> (no de una persona). El correo debe tener formato válido y el teléfono acepta dígitos, espacios, paréntesis y guiones.', side: 'top' },
      { tab: 1, selector: '#tour-prov-edit-row-direccion', title: 'Dirección',
        description: 'Domicilio fiscal o de entrega. Si lo dejás vacío se guarda como <em>"Sin especificar"</em>.', side: 'top' },
      { tab: 1, selector: '#tour-prov-edit-row-observaciones', title: 'Observaciones',
        description: 'Texto libre para notas internas (preferencias de pago, restricciones, recordatorios, etc.). No se muestra en la grilla.', side: 'top' },

      // ---------- PESTAÑA 2: CONTACTOS ----------
      { tab: 2, selector: '#tour-prov-edit-tab-contactos', title: 'Pestaña «Contactos»',
        description: 'Acá cargás <strong>las personas</strong> con las que tratás dentro del proveedor (vendedor, soporte, administración, etc.). <strong>Se requiere al menos un contacto con nombre</strong> para poder guardar.', side: 'bottom' },
      { tab: 2, selector: '#tour-prov-edit-contactos-toolbar', title: 'Toolbar de contactos',
        description: 'Vista general de la pestaña. El botón verde <strong>Agregar contacto</strong> suma más tarjetas para registrar varios referentes del mismo proveedor.', side: 'bottom' },
      { tab: 2, selector: '#tour-prov-edit-contacto-card', title: 'Tarjeta de contacto',
        description: 'Cada contacto es una tarjeta independiente con sus datos. Podés tener tantas como necesites y eliminarlas con el botón de la basura.', side: 'top' },
      { tab: 2, selector: '#tour-prov-edit-contacto-row-nombre', title: 'Nombre y Teléfono del contacto',
        description: '<strong>Nombre</strong> es obligatorio y permite identificar al referente. <strong>Teléfono</strong> es opcional, útil para escalar urgencias.', side: 'bottom' },
      { tab: 2, selector: '#tour-prov-edit-contacto-row-email', title: 'Email y Cargo',
        description: '<strong>Email</strong>: para enviar órdenes de compra y cotizaciones (formato válido). <strong>Cargo</strong>: rol que ocupa (Vendedor, Soporte técnico, etc.).', side: 'top' },
      { tab: 2, selector: '#tour-prov-edit-contacto-row-obs', title: 'Observaciones del contacto',
        description: 'Notas específicas de la persona: horarios, idiomas, preferencias de comunicación, etc.', side: 'top' },
      { tab: 2, selector: '#tour-prov-edit-contactos-add', title: 'Agregar otro contacto',
        description: 'Suma una segunda tarjeta para registrar otro referente del mismo proveedor. Útil cuando tenés un vendedor comercial y un técnico de soporte por separado.', side: 'left' },

      // ---------- VOLVER A TAB 1 PARA FOOTER ----------
      { tab: 1, selector: '#tour-prov-edit-save', title: 'Guardar',
        description: 'Crea el proveedor y todos sus contactos en una sola operación. Si falta el <strong>nombre comercial</strong>, hay datos inválidos (correo/teléfono/URLs) o no cargaste ningún contacto, al apretar acá aparece un <strong>aviso amarillo o rojo</strong> arriba del botón con la lista exacta de campos a corregir. En esta demo el botón está bloqueado para no guardar datos de prueba.', side: 'top' }
    ];

    this.esperarSelectores(
      [
        '#tour-prov-edit-header',
        '#tour-prov-edit-tabs',
        '#tour-prov-edit-row-nombres',
        '#tour-prov-edit-save'
      ],
      3000
    ).then(() => this.iniciarTourDemoConPestañas(pasos));
  }

  /**
   * Construye e inicia un driver.js que cambia de pestaña en función de la dirección
   * (Siguiente/Anterior), evitando que `onDeselected` dispare cambios cruzados al ir hacia atrás.
   */
  private iniciarTourDemoConPestañas(pasos: ProveedorDemoStep[]): void {
    const driveSteps: DriveStep[] = pasos.map((p) => ({
      element: p.selector,
      popover: {
        title: p.title,
        description: p.description,
        side: (p.side ?? 'bottom') as 'top' | 'bottom' | 'left' | 'right',
        align: 'start'
      }
    }));

    if (driveSteps.length === 0) {
      this.finalizarTourDemo();
      this.modalService.dismissAll();
      return;
    }

    const aplicarTabDe = (idx: number): void => {
      const tab = pasos[idx]?.tab;
      if (tab !== undefined && this.activeTab !== tab) {
        this.activeTab = tab;
        this.cdr.detectChanges();
      }
    };

    this.guidedTourHost.suspendGlobalZoom();

    const inst: Driver = driver({
      allowClose: true,
      overlayClickBehavior: () => undefined,
      allowKeyboardControl: false,
      showProgress: true,
      animate: false,
      smoothScroll: false,
      stagePadding: 10,
      overlayOpacity: 0.6,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      onNextClick: () => {
        const cur = inst.getActiveIndex() ?? 0;
        const next = cur + 1;
        if (next < driveSteps.length) {
          aplicarTabDe(next);
        }
        inst.moveNext();
      },
      onPrevClick: () => {
        const cur = inst.getActiveIndex() ?? 0;
        const prev = cur - 1;
        if (prev < 0) {
          return;
        }
        aplicarTabDe(prev);
        inst.movePrevious();
      },
      onDestroyed: () => {
        this.tourDemoModalRef?.dismiss();
        this.finalizarTourDemo();
        this.guidedTourHost.restoreGlobalZoom();
      },
      steps: driveSteps
    });

    this.tourProveedor = inst;
    aplicarTabDe(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        inst.drive();
      });
    });
  }

} 