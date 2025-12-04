import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { StockAlmacenService } from '../../services/stock-almacen.service';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';
import { EstadoEquipoService } from '../../services/estado-equipo.service';
import { EstadoDispositivoService } from '../../services/estado-dispositivo.service';
import { HardwareService } from '../../services/hardware.service';
import { BiosService } from '../../services/bios.service';
import { NetworkInfoService } from '../../services/network-info.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-almacenes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    NotificationContainerComponent
  ],
  templateUrl: './almacenes.component.html',
  styleUrls: ['./almacenes.component.css']
})
export class AlmacenesComponent implements OnInit {
  almacenes: Almacen[] = [];
  almacenesFiltrados: Almacen[] = [];
  stock: any[] = []; // Stock del sistema (incluye stock normal + equipos especiales)
  loading: boolean = false;
  error: string | null = null;
  almacenForm: FormGroup;
  modoEdicion: boolean = false;
  almacenSeleccionado: Almacen | null = null;
  almacenAEliminar: Almacen | null = null;

  // Almacenes especiales
  almacenCementerio: Almacen | null = null; // alm01 subsuelo
  almacenLaboratorio: Almacen | null = null; // alm05 pañol 3

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

  // Propiedades para el diálogo de confirmación
  showConfirmDialog: boolean = false;

  constructor(
    private stockAlmacenService: StockAlmacenService,
    private almacenService: AlmacenService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private router: Router,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private estadoEquipoService: EstadoEquipoService,
    private estadoDispositivoService: EstadoDispositivoService,
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private networkInfoService: NetworkInfoService
  ) {
    this.almacenForm = this.fb.group({
      numero: ['', [Validators.required, Validators.maxLength(50)]],
      nombre: ['', [Validators.required, Validators.maxLength(100)]],
      descripcion: ['', Validators.maxLength(500)]
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    // Cargar almacenes y stock en paralelo
    Promise.all([
      this.almacenService.getAllAlmacenes().toPromise(),
      this.stockAlmacenService.getAllStock().toPromise()
    ]).then(([almacenes, stock]) => {
      if (almacenes) {
        this.almacenes = almacenes;
        this.almacenesFiltrados = [...this.almacenes];
        this.actualizarPaginacion();
        
        // Encontrar los almacenes especiales
        this.almacenCementerio = almacenes.find((a: Almacen) => 
          a.numero?.toLowerCase().trim() === 'alm01' || 
          a.numero?.toLowerCase().trim() === 'alm 01' ||
          a.nombre?.toLowerCase().includes('subsuelo')
        ) || null;
        
        this.almacenLaboratorio = almacenes.find((a: Almacen) => 
          a.numero?.toLowerCase().trim() === 'alm05' || 
          a.numero?.toLowerCase().trim() === 'alm 05' ||
          a.nombre?.toLowerCase().includes('pañol 3')
        ) || null;
      }
      if (stock) {
        this.stock = stock; // Asignar el stock normal
      }
      
      // Cargar equipos especiales del cementerio y almacén laboratorio
      this.cargarEquiposEspeciales();
    }).catch(error => {
      console.error('Error al cargar datos:', error);
      this.error = 'Error al cargar los datos';
      this.loading = false;
    });
  }

  cargarEquiposEspeciales(): void {
    // Si no hay almacenes especiales, solo usar el stock normal
    if (!this.almacenCementerio && !this.almacenLaboratorio) {
      this.loading = false;
      return;
    }

    forkJoin({
      equiposBaja: this.estadoEquipoService.getEquiposEnBaja(),
      dispositivosBaja: this.estadoDispositivoService.getDispositivosEnBaja(),
      equiposAlmacen: this.estadoEquipoService.getEquiposEnAlmacen(),
      dispositivosAlmacen: this.estadoDispositivoService.getDispositivosEnAlmacen(),
      hardware: this.hardwareService.getHardware(),
      bios: this.biosService.getAllBios(),
      networkInfo: this.networkInfoService.getNetworkInfo()
    }).subscribe({
      next: (response) => {
        // Convertir equipos del cementerio a formato StockAlmacen
        const itemsCementerio = this.convertirEquiposAStock(
          response.equiposBaja,
          response.dispositivosBaja,
          Array.isArray(response.hardware) ? response.hardware : [],
          Array.isArray(response.bios) ? response.bios : [],
          response.networkInfo,
          this.almacenCementerio,
          'CEMENTERIO'
        );

        // Convertir equipos del almacén laboratorio a formato StockAlmacen
        const itemsLaboratorio = this.convertirEquiposAStock(
          response.equiposAlmacen,
          response.dispositivosAlmacen,
          Array.isArray(response.hardware) ? response.hardware : [],
          Array.isArray(response.bios) ? response.bios : [],
          response.networkInfo,
          this.almacenLaboratorio,
          'ALMACEN'
        );

        // Combinar con el stock normal
        this.stock = [...this.stock, ...itemsCementerio, ...itemsLaboratorio];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar equipos especiales:', error);
        // Si falla, al menos mostrar el stock normal
        this.loading = false;
      }
    });
  }

  convertirEquiposAStock(
    equiposResponse: any,
    dispositivosResponse: any,
    hardware: any[],
    bios: any[],
    networkInfo: any,
    almacen: Almacen | null,
    tipo: 'CEMENTERIO' | 'ALMACEN'
  ): any[] {
    if (!almacen) return [];

    const items: any[] = [];
    
    if (!Array.isArray(hardware)) hardware = [];
    if (!Array.isArray(bios)) bios = [];
    
    const biosMap = new Map(bios.map((b: any) => [b.hardwareId, b]));

    // Procesar equipos
    if (equiposResponse?.success && Array.isArray(equiposResponse.data)) {
      equiposResponse.data.forEach((estado: any) => {
        const hw = hardware.find((h: any) => h.id === estado.hardwareId);
        if (hw) {
          const biosData = biosMap.get(estado.hardwareId);
          items.push({
            id: `equipo-${estado.hardwareId}-${tipo}`,
            itemId: estado.hardwareId,
            idCompra: null,
            almacen: almacen,
            estanteria: 'Equipos',
            estante: tipo === 'CEMENTERIO' ? 'En Baja' : 'En Almacén',
            cantidad: 1,
            numero: hw.name || `EQ-${estado.hardwareId}`,
            descripcion: `${hw.name || 'Equipo'} - ${biosData?.type || 'N/A'} | ${hw.osName || 'N/A'}`,
            fechaRegistro: estado.fechaCambio,
            item: {
              nombreItem: hw.name || `Equipo ${estado.hardwareId}`,
              descripcion: `${biosData?.type || 'N/A'} | ${hw.osName || 'N/A'}`
            },
            esEquipoEspecial: true,
            tipoEquipo: 'EQUIPO',
            estadoInfo: estado
          });
        }
      });
    }

    // Procesar dispositivos
    if (dispositivosResponse?.success && Array.isArray(dispositivosResponse.data) && 
        networkInfo?.success && Array.isArray(networkInfo.data)) {
      const networkInfoMap = new Map(
        networkInfo.data.map((device: any) => [device.mac, device])
      );

      dispositivosResponse.data.forEach((estado: any) => {
        const device: any = networkInfoMap.get(estado.mac);
        if (device) {
          items.push({
            id: `dispositivo-${estado.mac}-${tipo}`,
            itemId: null,
            idCompra: null,
            almacen: almacen,
            estanteria: 'Dispositivos',
            estante: tipo === 'CEMENTERIO' ? 'En Baja' : 'En Almacén',
            cantidad: 1,
            numero: device.mac,
            descripcion: `${device.name || device.mac} - ${device.type || 'N/A'}`,
            fechaRegistro: estado.fechaCambio,
            item: {
              nombreItem: device.name || device.mac,
              descripcion: `${device.type || 'N/A'} | ${device.description || 'Sin descripción'}`
            },
            esEquipoEspecial: true,
            tipoEquipo: 'DISPOSITIVO',
            estadoInfo: estado
          });
        }
      });
    }

    return items;
  }

  abrirModalAlmacen(modal: any, almacen?: Almacen): void {
    this.modoEdicion = !!almacen;
    this.almacenSeleccionado = almacen || null;

    if (this.modoEdicion && almacen) {
      this.almacenForm.patchValue({
        numero: almacen.numero,
        nombre: almacen.nombre
      });
    } else {
      this.almacenForm.reset();
    }

    this.modalService.open(modal, { size: 'lg' });
  }

  guardarAlmacen(): void {
    if (this.almacenForm.valid) {
      const formData = this.almacenForm.value;
      
      if (this.modoEdicion && this.almacenSeleccionado) {
        // Actualizar almacén existente
        const almacenActualizado: Almacen = {
          ...this.almacenSeleccionado,
          numero: formData.numero,
          nombre: formData.nombre
        };

        this.almacenService.updateAlmacen(this.almacenSeleccionado.id, almacenActualizado).subscribe({
          next: () => {
            this.modalService.dismissAll();
            this.cargarDatos();
          },
          error: (error) => {
            console.error('Error al actualizar almacén:', error);
          }
        });
      } else {
        // Crear nuevo almacén
        const nuevoAlmacen: Omit<Almacen, 'id'> = {
          numero: formData.numero,
          nombre: formData.nombre
        };

        this.almacenService.createAlmacen(nuevoAlmacen).subscribe({
          next: () => {
            this.modalService.dismissAll();
            this.cargarDatos();
          },
          error: (error) => {
            console.error('Error al crear almacén:', error);
          }
        });
      }
    }
  }

  confirmarEliminacion(almacen: Almacen): void {
    this.almacenAEliminar = almacen;
    this.showConfirmDialog = true;
  }

  eliminarAlmacen(): void {
    if (this.almacenAEliminar) {
      this.almacenService.deleteAlmacen(this.almacenAEliminar.id).subscribe({
        next: () => {
          this.showConfirmDialog = false;
          this.almacenAEliminar = null;
          this.cargarDatos();
        },
        error: (error) => {
          console.error('Error al eliminar almacén:', error);
          this.showConfirmDialog = false;
        }
      });
    }
  }

  cancelarEliminacion(): void {
    this.showConfirmDialog = false;
    this.almacenAEliminar = null;
  }



  canManageAlmacenes(): boolean {
    return this.permissionsService.canManageAssets();
  }

  verStockAlmacen(almacen: Almacen): void {
    // Navegar al componente stock-almacen con el ID del almacén
    this.router.navigate(['/menu/almacen/stock', almacen.id]);
  }

  /**
   * Calcula el stock disponible por almacén
   */
  private calcularStockPorAlmacen(stock: any[]): void {
    // Esta función se puede implementar si es necesario para cálculos adicionales
  }

  /**
   * Verifica si un almacén tiene stock disponible
   */
  tieneStock(almacenId: number): boolean {
    // Buscar en el stock si hay items para este almacén
    return this.stock && this.stock.some((item: any) => item.almacen.id === almacenId);
  }

  /**
   * Obtiene el stock disponible de un almacén
   */
  getStockDisponible(almacenId: number): number {
    if (!this.stock) return 0;
    return this.stock
      .filter((item: any) => item.almacen.id === almacenId)
      .reduce((total: number, item: any) => total + (item.cantidad || 1), 0);
  }

  actualizarPaginacion(): void {
    this.collectionSize = this.almacenesFiltrados.length;
    this.page = 1;
  }
} 