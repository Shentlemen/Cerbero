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
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      correoContacto: ['', [Validators.required, Validators.email]],
      telefonoContacto: ['', [Validators.required, Validators.pattern(/^[\+]?[0-9\s\-\(\)]{7,20}$/)]],
      nombreComercial: ['', [Validators.required, Validators.minLength(3)]],
      direccion: ['', [Validators.minLength(5)]],
      observaciones: [''],
      rut: ['', [Validators.required]]
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
      
      // Debug: verificar qué datos llegan del backend
      console.log('=== DATOS DEL PROVEEDOR RECIBIDOS ===');
      console.log('Proveedor completo:', proveedor);
      console.log('RUT:', proveedor.rut);
      console.log('Dirección:', proveedor.direccion);
      console.log('Observaciones:', proveedor.observaciones);
      console.log('Tipo de RUT:', typeof proveedor.rut);
      console.log('Tipo de Dirección:', typeof proveedor.direccion);
      console.log('Tipo de Observaciones:', typeof proveedor.observaciones);
      console.log('¿RUT existe en el objeto?', 'rut' in proveedor);
      console.log('¿Dirección existe en el objeto?', 'direccion' in proveedor);
      console.log('¿Observaciones existe en el objeto?', 'observaciones' in proveedor);
      
      // Preparar los datos del proveedor para el formulario
      const datosProveedor = {
        nombre: proveedor.nombre || '',
        nombreComercial: proveedor.nombreComercial || '',
        rut: proveedor.rut || '', // Si RUT es undefined, será cadena vacía
        correoContacto: proveedor.correoContacto || '',
        telefonoContacto: proveedor.telefonoContacto || '',
        direccion: proveedor.direccion === 'Sin especificar' ? '' : (proveedor.direccion || ''),
        observaciones: proveedor.observaciones || '' // Si observaciones es null, será cadena vacía
      };
      
      console.log('=== DATOS PREPARADOS PARA EL FORMULARIO ===');
      console.log('Datos a cargar:', datosProveedor);
      console.log('RUT preparado:', datosProveedor.rut);
      console.log('Dirección preparada:', datosProveedor.direccion);
      console.log('Observaciones preparadas:', datosProveedor.observaciones);
      
      // Cargar todos los datos del proveedor en el formulario
      this.proveedorForm.patchValue(datosProveedor);
      
      // Verificar que el formulario se haya actualizado correctamente
      console.log('=== ESTADO DEL FORMULARIO DESPUÉS DE PATCHVALUE ===');
      console.log('Formulario completo:', this.proveedorForm.value);
      console.log('RUT en el formulario:', this.proveedorForm.get('rut')?.value);
      console.log('Dirección en el formulario:', this.proveedorForm.get('direccion')?.value);
      console.log('Observaciones en el formulario:', this.proveedorForm.get('observaciones')?.value);
      
      // Forzar la detección de cambios inmediatamente después de patchValue
      this.cdr.detectChanges();
      
      // Forzar la detección de cambios para asegurar que el formulario se actualice
      this.proveedorForm.updateValueAndValidity();
      
      // Verificar una vez más después de updateValueAndValidity
      setTimeout(() => {
        console.log('=== VERIFICACIÓN FINAL DEL FORMULARIO ===');
        console.log('RUT final:', this.proveedorForm.get('rut')?.value);
        console.log('Dirección final:', this.proveedorForm.get('direccion')?.value);
        console.log('Observaciones final:', this.proveedorForm.get('observaciones')?.value);
        
        // Forzar la detección de cambios de Angular
        this.proveedorForm.markAllAsTouched();
        
        // Verificar que los controles individuales tengan los valores correctos
        const rutControl = this.proveedorForm.get('rut');
        const direccionControl = this.proveedorForm.get('direccion');
        const observacionesControl = this.proveedorForm.get('observaciones');
        
        console.log('=== VERIFICACIÓN DE CONTROLES INDIVIDUALES ===');
        console.log('Control RUT:', rutControl);
        console.log('Valor del control RUT:', rutControl?.value);
        console.log('Control Dirección:', direccionControl);
        console.log('Valor del control Dirección:', direccionControl?.value);
        console.log('Control Observaciones:', observacionesControl);
        console.log('Valor del control Observaciones:', observacionesControl?.value);
        
        // Forzar la detección de cambios de Angular
        this.cdr.detectChanges();
      }, 100);
      
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
    this.modalService.open(modal, { size: 'lg' });
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
            telefono: [contacto.telefono, Validators.required],
            email: [contacto.email, [Validators.required, Validators.email]],
            cargo: [contacto.cargo, Validators.required],
            observaciones: [contacto.observaciones],
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

    if (controls['nombre']?.errors?.['required']) {
      errores.push('El nombre es requerido');
    }
    if (controls['nombre']?.errors?.['minlength']) {
      errores.push('El nombre debe tener al menos 3 caracteres');
    }

    if (controls['nombreComercial']?.errors?.['required']) {
      errores.push('El nombre comercial es requerido');
    }
    if (controls['nombreComercial']?.errors?.['minlength']) {
      errores.push('El nombre comercial debe tener al menos 3 caracteres');
    }

    if (controls['correoContacto']?.errors?.['required']) {
      errores.push('El correo de contacto es requerido');
    }
    if (controls['correoContacto']?.errors?.['email']) {
      errores.push('El correo de contacto debe tener un formato válido');
    }

    if (controls['telefonoContacto']?.errors?.['required']) {
      errores.push('El teléfono de contacto es requerido');
    }
    if (controls['telefonoContacto']?.errors?.['pattern']) {
      errores.push('El formato del teléfono no es válido');
    }

    if (controls['direccion']?.errors?.['minlength']) {
      errores.push('La dirección debe tener al menos 5 caracteres');
    }

    if (controls['rut']?.errors?.['required']) {
      errores.push('El RUT es requerido');
    }

    return errores;
  }

  agregarContacto() {
    this.contactosFormArray.push(this.fb.group({
      idContacto: [null],
      nombre: ['', Validators.required],
      telefono: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      cargo: ['', Validators.required],
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

    // Validar que todos los contactos tengan datos válidos
    const contactosConDatos = this.contactosFormArray.controls.filter(control => {
      const contacto = control.value;
      return contacto.nombre && contacto.telefono && contacto.email && contacto.cargo;
    });

    if (contactosConDatos.length === 0) {
      this.formError = 'Debe completar al menos un contacto con todos los campos requeridos (nombre, teléfono, email y cargo)';
      return;
    }

    // Validar que todos los contactos con datos sean válidos
    const contactosInvalidos = this.contactosFormArray.controls.some(control => {
      const contacto = control.value;
      // Solo validar contactos que tengan al menos un campo lleno
      if (contacto.nombre || contacto.telefono || contacto.email || contacto.cargo) {
        return !control.valid;
      }
      return false; // No validar contactos completamente vacíos
    });

    if (contactosInvalidos) {
      this.formError = 'Los contactos con datos deben tener todos los campos requeridos completos';
      return;
    }

    const proveedorData = this.proveedorForm.value;
    
    // Asegurar que la dirección no esté vacía
    if (!proveedorData.direccion || proveedorData.direccion.trim() === '') {
      proveedorData.direccion = 'Sin especificar';
    }
    
    // Validar que el RUT no esté vacío
    if (!proveedorData.rut || proveedorData.rut.trim() === '') {
      this.formError = 'El RUT es requerido';
      return;
    }
    
    // Validar formato de correo electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(proveedorData.correoContacto)) {
      this.formError = 'El correo electrónico no tiene un formato válido';
      return;
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
} 