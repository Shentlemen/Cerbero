import { Component, OnInit, ViewEncapsulation } from '@angular/core';
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
  pageSize = 11;
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

  readonly fb: FormBuilder;

  constructor(
    private proveedoresService: ProveedoresService,
    fb: FormBuilder,
    private modalService: NgbModal,
    private contactosService: ContactosService,
    private permissionsService: PermissionsService
  ) {
    this.fb = fb;
    this.filterForm = this.fb.group({
      nombre: [''],
      nombreComercial: ['']
    });

    this.proveedorForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      correoContacto: ['', [Validators.required, Validators.email]],
      telefonoContacto: ['', [Validators.required, Validators.pattern('^[0-9]{9}$')]],
      nombreComercial: ['', [Validators.required, Validators.minLength(3)]]
    });
    this.contactosFormArray = this.fb.array([]);
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
    if (proveedor) {
      this.modoEdicion = true;
      this.proveedorSeleccionado = proveedor;
      this.proveedorForm.patchValue(proveedor);
      this.cargarContactosProveedor(proveedor.idProveedores);
    } else {
      this.modoEdicion = false;
      this.proveedorSeleccionado = null;
      this.proveedorForm.reset();
      this.contactosFormArray.clear();
      this.contactosEliminados = [];
      this.contactosCargados = true;
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
    if (this.proveedorForm.valid) {
      const proveedorData = this.proveedorForm.value;
      console.log('Datos del formulario:', proveedorData);
      // Validar que el teléfono tenga 9 dígitos
      if (proveedorData.telefonoContacto && proveedorData.telefonoContacto.length !== 9) {
        this.error = 'El teléfono debe tener 9 dígitos';
        return;
      }
      // Validar formato de correo electrónico
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(proveedorData.correoContacto)) {
        this.error = 'El correo electrónico no tiene un formato válido';
        return;
      }

      if (this.modoEdicion && this.proveedorSeleccionado) {
        if (!this.proveedorSeleccionado.idProveedores || isNaN(this.proveedorSeleccionado.idProveedores)) {
          this.error = 'ID de proveedor no válido';
          return;
        }

        const proveedorActualizado: ProveedorDTO = {
          ...proveedorData,
          idProveedores: this.proveedorSeleccionado.idProveedores
        };
        
        console.log('Actualizando proveedor:', proveedorActualizado);
        this.proveedoresService.actualizarProveedor(this.proveedorSeleccionado.idProveedores, proveedorActualizado).subscribe({
          next: (proveedorActualizado) => {
            // Sincronizar contactos
            this.sincronizarContactos(proveedorActualizado.idProveedores);
            this.loadProveedores();
            this.modalService.dismissAll();
            this.error = null;
          },
          error: (error) => {
            console.error('Error al actualizar el proveedor:', error);
            this.error = error.message || 'Error al actualizar el proveedor';
          },
          complete: () => {
            this.proveedorForm.reset();
          }
        });
      } else {
        console.log('Creando nuevo proveedor:', proveedorData);
        this.proveedoresService.crearProveedor(proveedorData).subscribe({
          next: (proveedorCreado) => {
            // Guardar contactos nuevos
            this.guardarContactosNuevos(proveedorCreado.idProveedores);
            this.loadProveedores();
            this.modalService.dismissAll();
            this.error = null;
          },
          error: (error) => {
            console.error('Error al crear el proveedor:', error);
            this.error = error.message || 'Error al crear el proveedor';
          },
          complete: () => {
            this.proveedorForm.reset();
          }
        });
      }
    } else {
      // Marcar todos los campos como touched para mostrar los errores
      Object.keys(this.proveedorForm.controls).forEach(key => {
        const control = this.proveedorForm.get(key);
        control?.markAsTouched();
      });
      
      // Mostrar mensaje de error general
      this.error = 'Por favor, complete todos los campos requeridos correctamente';
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