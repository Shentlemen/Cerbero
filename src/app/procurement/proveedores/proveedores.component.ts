import { Component, OnInit, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbPaginationModule, NgbModal, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { ProveedoresService, ProveedorDTO } from '../../services/proveedores.service';
import { ContactosService, ContactoDTO } from '../../services/contactos.service';
import { PermissionsService } from '../../services/permissions.service';

@Component({
  selector: 'app-proveedores',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule, NgbPaginationModule, NgbNavModule],
  templateUrl: './proveedores.component.html',
  styleUrls: ['./proveedores.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ProveedoresComponent implements OnInit {
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
  formError: string | null = null;

  readonly fb: FormBuilder;

  constructor(
    private proveedoresService: ProveedoresService,
    fb: FormBuilder,
    private modalService: NgbModal,
    private contactosService: ContactosService,
    private permissionsService: PermissionsService,
    private cdr: ChangeDetectorRef
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
  }

  ngOnInit(): void {
    this.loadProveedores();
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
    this.formError = null; // Limpiar errores del formulario
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
      backdrop: true
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
    // Limpiar errores previos
    this.formError = null;
    
    // Marcar todos los campos como touched para mostrar los errores de validación
    Object.keys(this.proveedorForm.controls).forEach(key => {
      const control = this.proveedorForm.get(key);
      control?.markAsTouched();
    });

    if (!this.proveedorForm.valid) {
      // Obtener errores específicos del formulario
      const errores = this.obtenerErroresFormulario();
      this.formError = errores.join('. ');
      return; // No cerrar el modal, solo mostrar errores
    }

    // Validar que haya al menos un contacto
    if (this.contactosFormArray.length === 0) {
      this.formError = 'Debe agregar al menos un contacto para el proveedor';
      return;
    }

    // Validar que todos los contactos tengan al menos el nombre
    const contactosConNombre = this.contactosFormArray.controls.filter(control => {
      const contacto = control.value;
      return contacto.nombre && contacto.nombre.trim() !== '';
    });

    if (contactosConNombre.length === 0) {
      this.formError = 'Debe completar al menos un contacto con el nombre';
      return;
    }

    // Validar que todos los contactos con datos sean válidos
    const contactosInvalidos = this.contactosFormArray.controls.some(control => {
      const contacto = control.value;
      // Solo validar contactos que tengan al menos el nombre (campo obligatorio)
      if (contacto.nombre && contacto.nombre.trim() !== '') {
        // Solo el nombre es obligatorio, los demás campos son opcionales
        return !contacto.nombre || contacto.nombre.trim() === '';
      }
      return false; // No validar contactos completamente vacíos
    });

    if (contactosInvalidos) {
      this.formError = 'Los contactos deben tener al menos el nombre completado';
      return;
    }

    const proveedorData = this.proveedorForm.value;
    
    // Asegurar que la dirección no esté vacía
    if (!proveedorData.direccion || proveedorData.direccion.trim() === '') {
      proveedorData.direccion = 'Sin especificar';
    }
    
    // Validar formato de correo electrónico solo si se proporciona
    if (proveedorData.correoContacto && proveedorData.correoContacto.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(proveedorData.correoContacto)) {
        this.formError = 'El correo electrónico no tiene un formato válido';
        return;
      }
    }

    if (this.modoEdicion && this.proveedorSeleccionado) {
      if (!this.proveedorSeleccionado.idProveedores || isNaN(this.proveedorSeleccionado.idProveedores)) {
        this.formError = 'ID de proveedor no válido';
        return;
      }

      const proveedorActualizado: ProveedorDTO = {
        ...proveedorData,
        idProveedores: this.proveedorSeleccionado.idProveedores
      };
      
      this.proveedoresService.actualizarProveedor(this.proveedorSeleccionado.idProveedores, proveedorActualizado).subscribe({
        next: (proveedorActualizado) => {
          // Sincronizar contactos
          this.sincronizarContactos(proveedorActualizado.idProveedores);
          this.loadProveedores();
          this.modalService.dismissAll();
          this.formError = null;
        },
        error: (error) => {
          this.formError = error.message || 'Error al actualizar el proveedor';
        }
      });
    } else {
      this.proveedoresService.crearProveedor(proveedorData).subscribe({
        next: (proveedorCreado) => {
          // Guardar contactos nuevos
          this.guardarContactosNuevos(proveedorCreado.idProveedores);
          this.loadProveedores();
          this.modalService.dismissAll();
          this.formError = null;
        },
        error: (error) => {
          this.formError = error.message || 'Error al crear el proveedor';
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
} 