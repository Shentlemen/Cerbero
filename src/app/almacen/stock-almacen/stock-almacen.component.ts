import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ActivatedRoute } from '@angular/router';
import { StockAlmacenService, StockAlmacen } from '../../services/stock-almacen.service';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';
import { TransferirEquipoModalComponent } from '../../components/transferir-equipo-modal/transferir-equipo-modal.component';
import { Almacen3DComponent, StockItem } from '../../components/almacen-3d/almacen-3d.component';
import { EstadoEquipoService, CambioEstadoRequest } from '../../services/estado-equipo.service';
import { EstadoDispositivoService, CambioEstadoDispositivoRequest } from '../../services/estado-dispositivo.service';
import { HardwareService } from '../../services/hardware.service';
import { BiosService } from '../../services/bios.service';
import { NetworkInfoService } from '../../services/network-info.service';
import { forkJoin } from 'rxjs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-stock-almacen',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    NotificationContainerComponent,
    Almacen3DComponent
  ],
  templateUrl: './stock-almacen.component.html',
  styleUrls: ['./stock-almacen.component.css']
})
export class StockAlmacenComponent implements OnInit, OnDestroy {
  stock: StockAlmacen[] = [];
  almacenes: Almacen[] = [];
  almacenSeleccionado: Almacen | null = null;
  almacenId: number | null = null;
  loading: boolean = false;
  error: string | null = null;

  // Modal de cantidad
  itemSeleccionado: StockAlmacen | null = null;
  cantidadForm: FormGroup;
  mostrarConfirmacionEliminacion: boolean = false;

  // Organización del stock por almacén y estantería
  stockOrganizado: { [key: string]: { [key: string]: any[] } } = {};

  // Almacenes especiales
  almacenCementerio: Almacen | null = null; // alm01 subsuelo
  almacenLaboratorio: Almacen | null = null; // alm05 pañol 3

  // Estado de exportación
  isExporting: boolean = false;
  isExportingEstanteria: { [key: string]: boolean } = {};

  // Estado de transferencia
  transferiendoItemId: string | number | null = null;
  
  // Estado de reactivación
  reactivandoItemId: string | number | null = null;
  
  // Estado del dropdown de acciones
  dropdownAbiertoId: string | number | null = null;

  // Datos de stock para el componente 3D (solo para ALM03)
  stockData3D: StockItem[] = [];

  constructor(
    private stockAlmacenService: StockAlmacenService,
    private almacenService: AlmacenService,
    private route: ActivatedRoute,
    private modalService: NgbModal,
    private fb: FormBuilder,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private estadoEquipoService: EstadoEquipoService,
    private estadoDispositivoService: EstadoDispositivoService,
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private networkInfoService: NetworkInfoService
  ) {
    this.cantidadForm = this.fb.group({
      cantidad: [1, [Validators.required, Validators.min(0)]]
    });
  }

  ngOnInit(): void {
    // Suscribirse a los parámetros de la ruta para obtener el ID del almacén
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      this.almacenId = id ? parseInt(id, 10) : null;
      this.cargarDatos();
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Cerrar dropdown si se hace clic fuera
    const target = event.target as HTMLElement;
    if (!target.closest('.position-relative')) {
      this.cerrarDropdown();
    }
  }

  ngOnDestroy(): void {
    // Limpiar estado
    this.cerrarDropdown();
  }

  cargarDatos(): void {
    this.loading = true;
    this.error = null;

    Promise.all([
      this.stockAlmacenService.getAllStock().toPromise(),
      this.almacenService.getAllAlmacenes().toPromise()
    ]).then(([stock, almacenes]) => {
      if (stock) {
        this.stock = stock;
      }

      if (almacenes) {
        this.almacenes = almacenes;
        
        // Encontrar los almacenes especiales (búsqueda case-insensitive y flexible)
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
        
        // Debug: mostrar qué almacenes se encontraron
        console.log('🔍 Almacenes disponibles:', almacenes.map((a: Almacen) => `${a.numero} - ${a.nombre}`));
        console.log('🏛️ Almacén Cementerio encontrado:', this.almacenCementerio ? `${this.almacenCementerio.numero} - ${this.almacenCementerio.nombre}` : 'NO ENCONTRADO');
        console.log('📦 Almacén Laboratorio encontrado:', this.almacenLaboratorio ? `${this.almacenLaboratorio.numero} - ${this.almacenLaboratorio.nombre}` : 'NO ENCONTRADO');
        
        // Encontrar el almacén seleccionado
        if (this.almacenId) {
          this.almacenSeleccionado = this.almacenes.find(a => a.id === this.almacenId) || null;
        }
      }

      // Cargar equipos del cementerio y almacén laboratorio
      this.cargarEquiposEspeciales();
    }).catch(error => {
      console.error('Error al cargar datos:', error);
      this.error = 'Error al cargar los datos';
      this.loading = false;
    });
  }

  cargarEquiposEspeciales(): void {
    if (!this.almacenCementerio && !this.almacenLaboratorio) {
      // Si no hay almacenes especiales, solo organizar el stock normal
      let stockCompleto = [...this.stock];
      
      // Filtrar por almacén si hay un ID específico
      if (this.almacenId) {
        stockCompleto = stockCompleto.filter(item => item.almacen.id === this.almacenId);
      }
      
      this.organizarStock(stockCompleto);
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
        console.log('📊 Respuesta de equipos en baja:', response.equiposBaja);
        console.log('📊 Respuesta de equipos en almacén:', response.equiposAlmacen);
        console.log('📊 Respuesta de dispositivos en baja:', response.dispositivosBaja);
        console.log('📊 Respuesta de dispositivos en almacén:', response.dispositivosAlmacen);
        
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

        // Filtrar equipos en almacén para separar laboratorio de almacenes regulares
        const equiposEnAlmacen = response.equiposAlmacen?.success && Array.isArray(response.equiposAlmacen.data) 
          ? response.equiposAlmacen.data 
          : [];
        
        console.log('📦 Equipos en almacén recibidos:', equiposEnAlmacen.length);
        console.log('📦 Equipos con almacenId:', equiposEnAlmacen.filter((e: any) => e.almacenId).map((e: any) => ({
          hardwareId: e.hardwareId,
          almacenId: e.almacenId
        })));
        
        // Filtrar dispositivos en almacén para separar laboratorio de almacenes regulares
        const dispositivosEnAlmacen = response.dispositivosAlmacen?.success && Array.isArray(response.dispositivosAlmacen.data) 
          ? response.dispositivosAlmacen.data 
          : [];
        
        const laboratorioId = this.almacenLaboratorio?.id;
        // Equipos del laboratorio: aquellos con almacenId del laboratorio O sin almacenId (antiguos)
        const equiposLaboratorio = equiposEnAlmacen.filter((e: any) => 
          e.almacenId === laboratorioId || e.almacenId === null || e.almacenId === undefined
        );
        // Equipos de almacenes regulares: aquellos con almacenId pero que no es el laboratorio
        const equiposAlmacenesRegulares = equiposEnAlmacen.filter((e: any) => 
          e.almacenId && e.almacenId !== laboratorioId
        );
        
        // Dispositivos del laboratorio: aquellos con almacenId del laboratorio O sin almacenId (antiguos)
        const dispositivosLaboratorio = dispositivosEnAlmacen.filter((d: any) => 
          d.almacenId === laboratorioId || d.almacenId === null || d.almacenId === undefined
        );
        // Dispositivos de almacenes regulares: aquellos con almacenId pero que no es el laboratorio
        const dispositivosAlmacenesRegulares = dispositivosEnAlmacen.filter((d: any) => 
          d.almacenId && d.almacenId !== laboratorioId
        );
        
        console.log('📦 Equipos del laboratorio (almacenId=' + laboratorioId + '):', equiposLaboratorio.length);
        console.log('🏢 Equipos en almacenes regulares:', equiposAlmacenesRegulares.length);
        console.log('📱 Dispositivos del laboratorio:', dispositivosLaboratorio.length);
        console.log('📱 Dispositivos en almacenes regulares:', dispositivosAlmacenesRegulares.length);

        // Convertir equipos del almacén laboratorio a formato StockAlmacen
        const itemsLaboratorio = this.convertirEquiposAStock(
          { success: true, data: equiposLaboratorio },
          { success: true, data: dispositivosLaboratorio },
          Array.isArray(response.hardware) ? response.hardware : [],
          Array.isArray(response.bios) ? response.bios : [],
          response.networkInfo,
          this.almacenLaboratorio,
          'ALMACEN'
        );

        // Cargar equipos transferidos a almacenes regulares
        const itemsEquiposAlmacenesRegulares = this.cargarEquiposTransferidosAAlmacenesRegulares(
          equiposAlmacenesRegulares,
          Array.isArray(response.hardware) ? response.hardware : [],
          Array.isArray(response.bios) ? response.bios : []
        );

        // Cargar dispositivos transferidos a almacenes regulares
        const itemsDispositivosAlmacenesRegulares = this.cargarDispositivosTransferidosAAlmacenesRegulares(
          dispositivosAlmacenesRegulares,
          response.networkInfo
        );

        const itemsAlmacenesRegulares = [...itemsEquiposAlmacenesRegulares, ...itemsDispositivosAlmacenesRegulares];

        console.log('⚰️ Items cementerio convertidos:', itemsCementerio.length);
        console.log('📦 Items almacén laboratorio convertidos:', itemsLaboratorio.length);
        console.log('🏢 Items almacenes regulares convertidos:', itemsAlmacenesRegulares.length);

        // Combinar con el stock normal
        let stockCompleto: any[] = [...this.stock, ...itemsCementerio, ...itemsLaboratorio, ...itemsAlmacenesRegulares];
        
        // Filtrar por almacén si hay un ID específico
        if (this.almacenId) {
          stockCompleto = stockCompleto.filter(item => item.almacen.id === this.almacenId);
        }
        
        console.log('📋 Stock completo total:', stockCompleto.length);
        
        // Organizar todo el stock
        this.organizarStock(stockCompleto);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar equipos especiales:', error);
        // Si falla, al menos mostrar el stock normal
        let stockCompleto = [...this.stock];
        if (this.almacenId) {
          stockCompleto = stockCompleto.filter(item => item.almacen.id === this.almacenId);
        }
        this.organizarStock(stockCompleto);
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
    if (!almacen) {
      console.warn(`⚠️ No se encontró almacén para ${tipo}`);
      return [];
    }

    const items: any[] = [];
    
    // Verificar que hardware y bios sean arrays
    if (!Array.isArray(hardware)) hardware = [];
    if (!Array.isArray(bios)) bios = [];
    
    const biosMap = new Map(bios.map((b: any) => [b.hardwareId, b]));

    // Procesar equipos
    console.log(`🔧 Procesando equipos para ${tipo}:`, {
      responseSuccess: equiposResponse?.success,
      dataIsArray: Array.isArray(equiposResponse?.data),
      dataLength: equiposResponse?.data?.length || 0,
      hardwareLength: hardware.length
    });

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
        } else {
          console.warn(`⚠️ No se encontró hardware para hardwareId: ${estado.hardwareId}`);
        }
      });
    } else {
      console.warn(`⚠️ Respuesta de equipos inválida para ${tipo}:`, equiposResponse);
    }

    // Procesar dispositivos
    console.log(`🔧 Procesando dispositivos para ${tipo}:`, {
      responseSuccess: dispositivosResponse?.success,
      dataIsArray: Array.isArray(dispositivosResponse?.data),
      dataLength: dispositivosResponse?.data?.length || 0,
      networkInfoSuccess: networkInfo?.success,
      networkInfoDataIsArray: Array.isArray(networkInfo?.data),
      networkInfoDataLength: networkInfo?.data?.length || 0
    });

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
        } else {
          console.warn(`⚠️ No se encontró dispositivo para MAC: ${estado.mac}`);
        }
      });
    } else {
      console.warn(`⚠️ Respuesta de dispositivos inválida para ${tipo}:`, {
        dispositivosResponse,
        networkInfo
      });
    }

    console.log(`✅ Total items convertidos para ${tipo}:`, items.length);
    return items;
  }

  /**
   * Carga y convierte equipos transferidos a almacenes regulares
   */
  cargarEquiposTransferidosAAlmacenesRegulares(
    equiposEnAlmacen: any[],
    hardware: any[],
    bios: any[]
  ): any[] {
    const items: any[] = [];
    
    if (!Array.isArray(equiposEnAlmacen) || equiposEnAlmacen.length === 0) {
      return items;
    }

    if (!Array.isArray(hardware)) hardware = [];
    if (!Array.isArray(bios)) bios = [];
    
    const biosMap = new Map(bios.map((b: any) => [b.hardwareId, b]));

    equiposEnAlmacen.forEach((estado: any) => {
      // Solo procesar equipos con almacen_id (almacenes regulares)
      if (!estado.almacenId) {
        return;
      }

      const hw = hardware.find((h: any) => h.id === estado.hardwareId);
      if (!hw) {
        console.warn(`⚠️ No se encontró hardware para hardwareId: ${estado.hardwareId}`);
        return;
      }

      // Buscar el almacén correspondiente
      const almacen = this.almacenes.find(a => a.id === estado.almacenId);
      if (!almacen) {
        console.warn(`⚠️ No se encontró almacén para almacenId: ${estado.almacenId}`);
        return;
      }

      // Parsear estantería, estante y sección de las observaciones
      const { estanteria, estante, seccion } = this.parsearEstanteriaYEstante(estado.observaciones);
      
      const biosData = biosMap.get(estado.hardwareId);
      
      items.push({
        id: `equipo-${estado.hardwareId}-almacen-${estado.almacenId}`,
        itemId: estado.hardwareId,
        idCompra: null,
        almacen: almacen,
        estanteria: estanteria || 'Equipos',
        estante: estante || 'Sin especificar',
        seccion: seccion || null,
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
    });

    return items;
  }

  /**
   * Parsea estantería, estante y sección de las observaciones
   * Formato esperado: "Estantería: X, Estante: Y, Sección: Z" o "Estantería: X | Estante: Y | Sección: Z"
   */
  parsearEstanteriaYEstante(observaciones: string | null | undefined): { estanteria: string | null, estante: string | null, seccion: string | null } {
    if (!observaciones) {
      return { estanteria: null, estante: null, seccion: null };
    }

    let estanteria: string | null = null;
    let estante: string | null = null;
    let seccion: string | null = null;

    // Buscar "Estantería: X"
    const estanteriaMatch = observaciones.match(/Estanter[íi]a:\s*([^,|]+)/i);
    if (estanteriaMatch && estanteriaMatch[1]) {
      estanteria = estanteriaMatch[1].trim();
    }

    // Buscar "Estante: Y"
    const estanteMatch = observaciones.match(/Estante:\s*([^,|]+)/i);
    if (estanteMatch && estanteMatch[1]) {
      estante = estanteMatch[1].trim();
    }

    // Buscar "Sección: Z"
    const seccionMatch = observaciones.match(/Secci[óo]n:\s*([^,|]+)/i);
    if (seccionMatch && seccionMatch[1]) {
      seccion = seccionMatch[1].trim();
    }

    return { estanteria, estante, seccion };
  }

  /**
   * Cargar dispositivos transferidos a almacenes regulares
   */
  cargarDispositivosTransferidosAAlmacenesRegulares(
    dispositivosAlmacenesRegulares: any[],
    networkInfo: any
  ): any[] {
    const items: any[] = [];

    if (!dispositivosAlmacenesRegulares || dispositivosAlmacenesRegulares.length === 0) {
      return items;
    }

    if (!networkInfo?.success || !Array.isArray(networkInfo.data)) {
      console.warn('⚠️ No se encontró información de red para dispositivos');
      return items;
    }

    const networkInfoMap = new Map(
      networkInfo.data.map((device: any) => [device.mac, device])
    );

    dispositivosAlmacenesRegulares.forEach((estado: any) => {
      const device: any = networkInfoMap.get(estado.mac);
      if (!device) {
        console.warn(`⚠️ No se encontró dispositivo para MAC: ${estado.mac}`);
        return;
      }

      // Buscar el almacén correspondiente
      const almacen = this.almacenes.find(a => a.id === estado.almacenId);
      if (!almacen) {
        console.warn(`⚠️ No se encontró almacén para almacenId: ${estado.almacenId}`);
        return;
      }

      // Parsear estantería, estante y sección de las observaciones
      const { estanteria, estante, seccion } = this.parsearEstanteriaYEstante(estado.observaciones);
      
      items.push({
        id: `dispositivo-${estado.mac}-almacen-${estado.almacenId}`,
        itemId: null,
        idCompra: null,
        almacen: almacen,
        estanteria: estanteria || 'Dispositivos',
        estante: estante || 'Sin especificar',
        seccion: seccion || null,
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
    });

    console.log('✅ Total items de dispositivos en almacenes regulares:', items.length);
    return items;
  }

  organizarStock(stock: any[]): void {
    // Organizar stock por almacén y estantería
    const grupos: { [key: string]: { [key: string]: any[] } } = {};

    stock.forEach(item => {
      const almacenKey = `${item.almacen.numero} - ${item.almacen.nombre}`;
      const estanteriaKey = item.estanteria;

      if (!grupos[almacenKey]) {
        grupos[almacenKey] = {};
      }
      if (!grupos[almacenKey][estanteriaKey]) {
        grupos[almacenKey][estanteriaKey] = [];
      }

      grupos[almacenKey][estanteriaKey].push(item);
    });

    // Para ALM03 (Almacen Principal), asegurar que todas las estanterías (E1-E6) y estantes (1-3) estén presentes
    const almacenPrincipalKey = Object.keys(grupos).find(key => 
      key.toUpperCase().includes('ALM03') || key.toUpperCase().includes('ALMACEN PRINCIPAL')
    );
    
    if (almacenPrincipalKey) {
      const estanteriasEsperadas = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
      const estantesEsperados = ['1', '2', '3'];
      
      estanteriasEsperadas.forEach(estanteria => {
        if (!grupos[almacenPrincipalKey][estanteria]) {
          grupos[almacenPrincipalKey][estanteria] = [];
        }
      });
    }

    this.stockOrganizado = grupos;
    
    // Preparar datos para el componente 3D si estamos viendo ALM03
    this.prepararStockData3D(stock);
  }

  /**
   * Prepara los datos de stock en formato para el componente 3D
   * Solo para ALM03 (Almacen Principal)
   */
  prepararStockData3D(stock: any[]): void {
    // Solo preparar datos si estamos viendo el almacén 3 (ALM03)
    if (this.almacenId !== 3) {
      this.stockData3D = [];
      return;
    }

    // Filtrar stock del ALM03 y convertir al formato StockItem
    const stockALM03 = stock.filter(item => 
      item.almacen && 
      (item.almacen.id === 3 || 
       item.almacen.numero?.toUpperCase().includes('ALM03') ||
       item.almacen.nombre?.toUpperCase().includes('ALMACEN PRINCIPAL'))
    );

    this.stockData3D = stockALM03.map(item => {
      // Normalizar estantería (E1, E2, etc.)
      let estanteria = item.estanteria?.toString().trim().toUpperCase() || '';
      // Si no empieza con E, agregarlo
      if (estanteria && !estanteria.startsWith('E')) {
        // Intentar extraer número si es solo un número
        const numMatch = estanteria.match(/\d+/);
        if (numMatch) {
          estanteria = `E${numMatch[0]}`;
        }
      }

      // Normalizar estante (1, 2, 3)
      let estante = item.estante?.toString().trim() || '';
      // Si es un número, mantenerlo; si no, intentar extraerlo
      if (estante && !/^\d+$/.test(estante)) {
        const numMatch = estante.match(/\d+/);
        if (numMatch) {
          estante = numMatch[0];
        }
      }

      // Normalizar sección (A, B, C)
      let seccion = item.seccion?.toString().trim().toUpperCase() || '';
      // Si es una letra, mantenerla; si no, intentar extraerla
      if (seccion && !/^[A-Z]$/.test(seccion)) {
        const letraMatch = seccion.match(/[A-Z]/);
        if (letraMatch) {
          seccion = letraMatch[0];
        }
      }

      return {
        estanteria: estanteria,
        estante: estante,
        seccion: seccion || undefined,
        cantidad: item.cantidad || 1,
        ...item
      } as StockItem;
    });

    console.log('📦 StockData3D preparado:', this.stockData3D.length, 'items');
    console.log('📦 Detalles:', this.stockData3D.map(item => ({
      estanteria: item.estanteria,
      estante: item.estante,
      seccion: item.seccion
    })));
  }

  /**
   * Maneja la selección de una caja en el componente 3D
   */
  onCaja3DSeleccionada(cajaInfo: any): void {
    console.log('📦 Caja seleccionada en 3D:', cajaInfo);
    // Aquí puedes mostrar un modal con los detalles de la caja si lo deseas
    if (cajaInfo.contenido && cajaInfo.contenido.length > 0) {
      this.notificationService.showInfo(
        `Caja ${cajaInfo.estanteria} - Estante ${cajaInfo.nivel} - Sección ${cajaInfo.seccion}`,
        `Contiene ${cajaInfo.contenido.length} item(s)`
      );
    }
  }

  getAlmacenes(): string[] {
    return Object.keys(this.stockOrganizado);
  }

  getEstanterias(almacen: string): string[] {
    return Object.keys(this.stockOrganizado[almacen] || {});
  }

  getStockPorEstanteria(almacen: string, estanteria: string): any[] {
    return this.stockOrganizado[almacen]?.[estanteria] || [];
  }

  getTotalStockPorAlmacen(almacen: string): number {
    const estanterias = this.getEstanterias(almacen);
    return estanterias.reduce((total, estanteria) => {
      const stock = this.getStockPorEstanteria(almacen, estanteria);
      return total + stock.reduce((sum, item) => sum + (item.cantidad || 1), 0);
    }, 0);
  }

  getTotalStockPorEstanteria(almacen: string, estanteria: string): number {
    const stock = this.getStockPorEstanteria(almacen, estanteria);
    return stock.reduce((total, item) => total + (item.cantidad || 1), 0);
  }

  getTotalAlmacenes(): number {
    return this.getAlmacenes().length;
  }

  // Nuevos métodos para la estructura de estantes
  getEstantesPorEstanteria(almacen: string, estanteria: string): string[] {
    const stockItems = this.getStockPorEstanteria(almacen, estanteria);
    const estantes = new Set<string>();
    stockItems.forEach(item => {
      estantes.add(item.estante);
    });
    
    // Para ALM03 (Almacen Principal), mostrar todos los estantes (1-3) aunque estén vacíos
    const esAlmacenPrincipal = almacen.toUpperCase().includes('ALM03') || 
                               almacen.toUpperCase().includes('ALMACEN PRINCIPAL');
    const esEstanteriaValida = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'].includes(estanteria.toUpperCase());
    
    if (esAlmacenPrincipal && esEstanteriaValida) {
      const estantesEsperados = ['1', '2', '3'];
      estantesEsperados.forEach(estante => {
        estantes.add(estante);
      });
    }
    
    return Array.from(estantes).sort();
  }
  
  /**
   * Verifica si un estante está vacío
   */
  estaEstanteVacio(almacen: string, estanteria: string, estante: string): boolean {
    const items = this.getItemsPorEstante(almacen, estanteria, estante);
    return items.length === 0;
  }

  getItemsPorEstante(almacen: string, estanteria: string, estante: string): any[] {
    const stockItems = this.getStockPorEstanteria(almacen, estanteria);
    return stockItems.filter(item => item.estante === estante);
  }

  /**
   * Abre el modal para modificar la cantidad de un item
   */
  abrirModalCantidad(item: any, modal: any): void {
    // No permitir editar equipos especiales (cementerio y almacén laboratorio)
    if (item.esEquipoEspecial) {
      this.notificationService.showError(
        'No se puede modificar',
        'Los equipos del cementerio y almacén laboratorio no se pueden modificar desde aquí. Use las secciones correspondientes.'
      );
      return;
    }

    if (!this.canManageStock()) {
      this.notificationService.showError(
        'Permisos Insuficientes',
        'No tienes permisos para modificar el stock.'
      );
      return;
    }

    this.itemSeleccionado = item;
    this.cantidadForm.patchValue({
      cantidad: item.cantidad
    });
    this.mostrarConfirmacionEliminacion = false;
    this.modalService.open(modal, { size: 'md' });
  }

  /**
   * Aumenta la cantidad en 1
   */
  aumentarCantidad(): void {
    const cantidadActual = this.cantidadForm.get('cantidad')?.value || 0;
    this.cantidadForm.patchValue({
      cantidad: cantidadActual + 1
    });
    this.mostrarConfirmacionEliminacion = false;
  }

  /**
   * Reduce la cantidad en 1
   */
  reducirCantidad(): void {
    const cantidadActual = this.cantidadForm.get('cantidad')?.value || 0;
    const nuevaCantidad = Math.max(0, cantidadActual - 1);
    this.cantidadForm.patchValue({
      cantidad: nuevaCantidad
    });
    
    // Mostrar confirmación si la cantidad llega a 0
    this.mostrarConfirmacionEliminacion = nuevaCantidad === 0;
  }

  /**
   * Guarda los cambios de cantidad
   */
  guardarCantidad(): void {
    if (!this.itemSeleccionado || !this.cantidadForm.valid) {
      return;
    }

    const nuevaCantidad = this.cantidadForm.get('cantidad')?.value;

    if (nuevaCantidad === 0) {
      // Eliminar el item si la cantidad es 0
      this.eliminarItem();
    } else {
      // Actualizar la cantidad
      this.actualizarCantidad(nuevaCantidad);
    }
  }

  /**
   * Actualiza la cantidad del item
   */
  private actualizarCantidad(nuevaCantidad: number): void {
    if (!this.itemSeleccionado) return;

    this.stockAlmacenService.updateStockQuantity(this.itemSeleccionado.id, nuevaCantidad).subscribe({
      next: () => {
        this.notificationService.showSuccess(
          'Stock Actualizado',
          `La cantidad se ha actualizado a ${nuevaCantidad} unidades.`
        );
        this.modalService.dismissAll();
        this.cargarDatos();
      },
      error: (error) => {
        console.error('Error al actualizar cantidad:', error);
        this.notificationService.showError(
          'Error',
          'No se pudo actualizar la cantidad. Intente nuevamente.'
        );
      }
    });
  }

  /**
   * Elimina el item del stock
   */
  private eliminarItem(): void {
    if (!this.itemSeleccionado) return;

    this.stockAlmacenService.deleteStock(this.itemSeleccionado.id).subscribe({
      next: () => {
        this.notificationService.showSuccess(
          'Item Eliminado',
          'El item ha sido eliminado del stock.'
        );
        this.modalService.dismissAll();
        this.cargarDatos();
      },
      error: (error) => {
        console.error('Error al eliminar item:', error);
        this.notificationService.showError(
          'Error',
          'No se pudo eliminar el item. Intente nuevamente.'
        );
      }
    });
  }

  /**
   * Cancela los cambios y cierra el modal
   */
  cancelarCambios(): void {
    this.modalService.dismissAll();
    this.itemSeleccionado = null;
    this.mostrarConfirmacionEliminacion = false;
  }

  /**
   * Verifica si el usuario puede gestionar stock
   */
  canManageStock(): boolean {
    return this.permissionsService.canManageAssets();
  }

  /**
   * Helper para verificar si un item es equipo especial
   */
  esEquipoEspecial(item: any): boolean {
    return item?.esEquipoEspecial === true;
  }

  /**
   * Helper para obtener el tipo de equipo
   */
  getTipoEquipo(item: any): string {
    return item?.tipoEquipo || '';
  }

  /**
   * Helper para obtener la descripción del equipo especial
   */
  getDescripcionEquipo(item: any): string {
    return item?.descripcion || '';
  }

  /**
   * Identifica el tipo de almacén de un item: 'cementerio', 'laboratorio', o 'regular'
   */
  getTipoAlmacen(item: any): 'cementerio' | 'laboratorio' | 'regular' | null {
    if (!this.esEquipoEspecial(item)) {
      return 'regular';
    }

    // Verificar si el item tiene estadoInfo con almacenId
    const almacenId = item?.estadoInfo?.almacenId || item?.almacen?.id;
    
    // Si no tiene almacenId pero está en baja, es cementerio
    if (item?.estadoInfo?.baja === true) {
      return 'cementerio';
    }

    // Comparar con almacenes especiales
    if (almacenId) {
      if (this.almacenCementerio && almacenId === this.almacenCementerio.id) {
        return 'cementerio';
      }
      if (this.almacenLaboratorio && almacenId === this.almacenLaboratorio.id) {
        return 'laboratorio';
      }
      // Si tiene almacenId pero no es cementerio ni laboratorio, es regular
      return 'regular';
    }

    // Verificar por nombre de almacén como fallback
    const almacenNombre = item?.almacen?.nombre?.toLowerCase() || '';
    const almacenNumero = item?.almacen?.numero?.toLowerCase() || '';
    
    if (almacenNumero.includes('alm01') || almacenNombre.includes('subsuelo') || almacenNombre.includes('cementerio')) {
      return 'cementerio';
    }
    
    if (almacenNumero.includes('alm05') || almacenNombre.includes('pañol 3') || almacenNombre.includes('laboratorio')) {
      return 'laboratorio';
    }

    return 'regular';
  }

  /**
   * Obtiene el icono según el tipo de almacén
   */
  getIconoAlmacen(item: any): string {
    if (!this.esEquipoEspecial(item)) {
      return 'fa-warehouse'; // Almacén regular
    }

    const tipoAlmacen = this.getTipoAlmacen(item);
    
    switch (tipoAlmacen) {
      case 'cementerio':
        return 'fa-skull-crossbones'; // Icono de cementerio
      case 'laboratorio':
        return 'fa-flask'; // Icono de laboratorio
      case 'regular':
        return 'fa-warehouse'; // Icono de almacén regular
      default:
        return 'fa-box';
    }
  }

  /**
   * Obtiene el color de fondo del badge según el tipo de almacén
   */
  getBadgeColorAlmacen(item: any): string {
    const tipoAlmacen = this.getTipoAlmacen(item);
    
    switch (tipoAlmacen) {
      case 'cementerio':
        return 'bg-danger';
      case 'laboratorio':
        return 'bg-info';
      case 'regular':
        return 'bg-secondary';
      default:
        return 'bg-secondary';
    }
  }

  /**
   * Exporta el contenido de una estantería a PDF
   */
  exportarPDFEstanteria(almacenKey: string, estanteriaKey: string): void {
    const items = this.getStockPorEstanteria(almacenKey, estanteriaKey);
    
    if (items.length === 0) {
      this.notificationService.showInfo('Sin items', 'No hay items para exportar en esta estantería.');
      return;
    }

    const estanteriaId = `${almacenKey}-${estanteriaKey}`;
    this.isExportingEstanteria[estanteriaId] = true;
    this.notificationService.showInfo('Generando PDF', 'Generando PDF de estantería...');

    const doc = new jsPDF('landscape');
    const fechaGeneracion = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Título
    doc.setFontSize(18);
    doc.text(`Estantería ${estanteriaKey} - ${almacenKey}`, 14, 22);

    // Información
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Almacén: ${almacenKey}`, 14, 30);
    doc.text(`Total de items: ${items.length}`, 14, 35);
    doc.text(`Fecha de generación: ${fechaGeneracion}`, 14, 40);

    // Organizar items por estante
    const itemsPorEstante: { [key: string]: any[] } = {};
    items.forEach(item => {
      const estante = item.estante;
      if (!itemsPorEstante[estante]) {
        itemsPorEstante[estante] = [];
      }
      itemsPorEstante[estante].push(item);
    });

    let startY = 50;
    const estantes = Object.keys(itemsPorEstante).sort();

    estantes.forEach((estante, index) => {
      if (startY > 180) {
        doc.addPage();
        startY = 20;
      }

      // Título del estante
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`Estante ${estante}`, 14, startY);
      startY += 8;

      // Preparar datos para la tabla
      const head = [['Item', 'Cantidad', 'Número', 'Descripción']];
      const body = itemsPorEstante[estante].map(item => [
        item.item?.nombreItem || 'N/A',
        item.cantidad?.toString() || '1',
        item.numero || 'N/A',
        item.descripcion || item.item?.descripcion || 'Sin descripción'
      ]);

      // Generar tabla
      autoTable(doc, {
        head: head,
        body: body,
        startY: startY,
        theme: 'striped',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          halign: 'left',
          valign: 'middle'
        },
        headStyles: {
          fillColor: [52, 152, 219],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240]
        }
      });

      startY = (doc as any).lastAutoTable.finalY + 10;
    });

    // Footer en cada página
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Página ${i} de ${totalPages}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }

    const nombreArchivo = `estanteria_${estanteriaKey.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(nombreArchivo);
    this.notificationService.showSuccess('PDF Generado', 'PDF de estantería generado exitosamente.');
    this.isExportingEstanteria[estanteriaId] = false;
  }

  /**
   * Exporta todo el contenido del almacén seleccionado o el primero disponible
   */
  exportarPDFAlmacenCompleto(): void {
    const almacenes = this.getAlmacenes();
    if (almacenes.length === 0) {
      this.notificationService.showInfo('Sin almacenes', 'No hay almacenes para exportar.');
      return;
    }

    // Si hay un almacén seleccionado, exportar ese; si no, exportar el primero
    let almacenKey: string;
    if (this.almacenSeleccionado) {
      almacenKey = `${this.almacenSeleccionado.numero} - ${this.almacenSeleccionado.nombre}`;
    } else {
      almacenKey = almacenes[0];
    }

    this.exportarPDFAlmacen(almacenKey);
  }

  /**
   * Exporta todo el contenido del almacén a PDF
   */
  exportarPDFAlmacen(almacenKey: string): void {
    const almacenes = this.getAlmacenes();
    if (!almacenes.includes(almacenKey)) {
      this.notificationService.showInfo('Almacén no encontrado', 'El almacén especificado no existe.');
      return;
    }

    const estanterias = this.getEstanterias(almacenKey);
    if (estanterias.length === 0) {
      this.notificationService.showInfo('Sin estanterías', 'No hay estanterías para exportar en este almacén.');
      return;
    }

    this.isExporting = true;
    this.notificationService.showInfo('Generando PDF', 'Generando PDF del almacén completo...');

    const doc = new jsPDF('landscape');
    const fechaGeneracion = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Título
    doc.setFontSize(18);
    doc.text(`Reporte Completo - ${almacenKey}`, 14, 22);

    // Información
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Almacén: ${almacenKey}`, 14, 30);
    doc.text(`Total de estanterías: ${estanterias.length}`, 14, 35);
    doc.text(`Fecha de generación: ${fechaGeneracion}`, 14, 40);

    let startY = 50;

    estanterias.forEach((estanteria, estanteriaIndex) => {
      if (startY > 170) {
        doc.addPage();
        startY = 20;
      }

      // Título de la estantería
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text(`Estantería ${estanteria}`, 14, startY);
      startY += 8;

      const items = this.getStockPorEstanteria(almacenKey, estanteria);
      
      // Organizar items por estante
      const itemsPorEstante: { [key: string]: any[] } = {};
      items.forEach(item => {
        const estante = item.estante;
        if (!itemsPorEstante[estante]) {
          itemsPorEstante[estante] = [];
        }
        itemsPorEstante[estante].push(item);
      });

      const estantes = Object.keys(itemsPorEstante).sort();

      estantes.forEach((estante) => {
        if (startY > 180) {
          doc.addPage();
          startY = 20;
        }

        // Subtítulo del estante
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.text(`  Estante ${estante}`, 14, startY);
        startY += 6;

        // Preparar datos para la tabla
        const head = [['Item', 'Cantidad', 'Número', 'Descripción']];
        const body = itemsPorEstante[estante].map(item => [
          item.item?.nombreItem || 'N/A',
          item.cantidad?.toString() || '1',
          item.numero || 'N/A',
          item.descripcion || item.item?.descripcion || 'Sin descripción'
        ]);

        // Generar tabla
        autoTable(doc, {
          head: head,
          body: body,
          startY: startY,
          theme: 'striped',
          styles: {
            fontSize: 7,
            cellPadding: 1.5,
            halign: 'left',
            valign: 'middle'
          },
          headStyles: {
            fillColor: [52, 152, 219],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          }
        });

        startY = (doc as any).lastAutoTable.finalY + 8;
      });

      // Espacio entre estanterías
      if (estanteriaIndex < estanterias.length - 1) {
        startY += 5;
      }
    });

    // Footer en cada página
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Página ${i} de ${totalPages}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
    }

    const nombreArchivo = `almacen_${almacenKey.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(nombreArchivo);
    this.notificationService.showSuccess('PDF Generado', 'PDF del almacén completo generado exitosamente.');
    this.isExporting = false;
  }

  /**
   * Helper para verificar si se está exportando una estantería
   */
  isExportingEstanteriaKey(almacenKey: string, estanteriaKey: string): boolean {
    const estanteriaId = `${almacenKey}-${estanteriaKey}`;
    return this.isExportingEstanteria[estanteriaId] || false;
  }

  /**
   * Método para transferir equipo o dispositivo (solo para equipos especiales)
   */
  transferirEquipo(item: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.cerrarDropdown();

    // Solo permitir transferir equipos o dispositivos especiales
    if (!this.esEquipoEspecial(item)) {
      this.notificationService.showError(
        'Operación no permitida',
        'Solo se pueden transferir equipos o dispositivos especiales (del cementerio o almacén laboratorio).'
      );
      return;
    }

    const tipoEquipo = this.getTipoEquipo(item);
    
    if (tipoEquipo === 'EQUIPO') {
      // Obtener el hardwareId del item
      const hardwareId = item.itemId || item.estadoInfo?.hardwareId;
      if (!hardwareId) {
        this.notificationService.showError(
          'Error',
          'No se pudo identificar el equipo a transferir.'
        );
        return;
      }

      // Buscar el hardware completo para pasar al modal
      this.hardwareService.getHardware().subscribe({
        next: (hardwareList) => {
          const hardware = hardwareList.find((h: any) => h.id === hardwareId);
          if (!hardware) {
            this.notificationService.showError(
              'Error',
              'No se encontró la información del equipo.'
            );
            return;
          }

          const modalRef = this.modalService.open(TransferirEquipoModalComponent, { size: 'lg' });
          modalRef.componentInstance.item = {
            ...hardware,
            tipo: 'EQUIPO',
            name: hardware.name
          };

          modalRef.result.then((transferData: any) => {
            if (transferData) {
              // Log para debugging - ver qué viene del modal
              console.log('🔍 StockAlmacen - transferData recibido del modal:', {
                transferData,
                seccion: transferData.seccion,
                seccionType: typeof transferData.seccion,
                tipoAlmacen: transferData.tipoAlmacen,
                tieneSeccion: 'seccion' in transferData
              });
              this.procesarTransferenciaEquipo(item, hardwareId, transferData);
            }
          }).catch(() => {
            // Usuario canceló el modal
          });
        },
        error: (error) => {
          console.error('Error al cargar hardware:', error);
          this.notificationService.showError(
            'Error',
            'No se pudo cargar la información del equipo.'
          );
        }
      });
    } else if (tipoEquipo === 'DISPOSITIVO') {
      // Obtener la MAC del dispositivo
      const mac = item.numero || item.estadoInfo?.mac || item.item?.nombreItem;
      if (!mac) {
        this.notificationService.showError(
          'Error',
          'No se pudo identificar el dispositivo a transferir.'
        );
        return;
      }

      // Buscar la información del dispositivo para pasar al modal
      this.networkInfoService.getNetworkInfo().subscribe({
        next: (networkInfoResponse) => {
          if (networkInfoResponse.success && Array.isArray(networkInfoResponse.data)) {
            const dispositivo = networkInfoResponse.data.find((d: any) => d.mac === mac);
            
            const modalRef = this.modalService.open(TransferirEquipoModalComponent, { size: 'lg' });
            modalRef.componentInstance.item = {
              ...(dispositivo || {}),
              tipo: 'DISPOSITIVO',
              name: dispositivo?.name || mac,
              mac: mac
            };

            modalRef.result.then((transferData: any) => {
              if (transferData) {
                this.procesarTransferenciaDispositivo(item, mac, transferData);
              }
            }).catch(() => {
              // Usuario canceló el modal
            });
          } else {
            this.notificationService.showError(
              'Error',
              'No se pudo cargar la información del dispositivo.'
            );
          }
        },
        error: (error) => {
          console.error('Error al cargar network info:', error);
          this.notificationService.showError(
            'Error',
            'No se pudo cargar la información del dispositivo.'
          );
        }
      });
    } else {
      this.notificationService.showError(
        'Operación no permitida',
        'Tipo de item no soportado para transferencia.'
      );
    }
  }

  private procesarTransferenciaEquipo(item: any, hardwareId: number, transferData: any): void {
    this.transferiendoItemId = item.id;

    // Preparar datos para el backend
    const requestData: any = {
      almacenId: transferData.almacenId,
      tipoAlmacen: transferData.tipoAlmacen,
      observaciones: transferData.observaciones || '',
      usuario: 'Usuario' // TODO: Obtener del contexto de autenticación
    };

    // Siempre incluir estantería, estante y sección si tipoAlmacen es 'regular'
    if (transferData.tipoAlmacen === 'regular') {
      requestData.estanteria = transferData.estanteria || '';
      requestData.estante = transferData.estante || '';
      // Asegurar que seccion siempre se incluya, incluso si está vacía o es null/undefined
      // IMPORTANTE: Capturar el valor directamente del transferData
      // Si viene como string vacío '', también lo capturamos
      const seccionRaw = transferData.seccion;
      let seccionValue = '';
      
      if (seccionRaw !== undefined && seccionRaw !== null) {
        // Si es string, usar trim; si es otro tipo, convertir a string y trim
        seccionValue = typeof seccionRaw === 'string' ? seccionRaw.trim() : String(seccionRaw).trim();
      }
      
      // Forzar que seccion siempre esté presente en el objeto
      requestData.seccion = seccionValue;
      
      console.log('🔍 StockAlmacen - Procesando almacén regular:', {
        transferDataSeccion: transferData.seccion,
        transferDataSeccionType: typeof transferData.seccion,
        seccionValue: seccionValue,
        requestDataSeccion: requestData.seccion,
        requestDataKeys: Object.keys(requestData),
        requestDataJSON: JSON.stringify(requestData)
      });
    } else {
      console.log('🔍 StockAlmacen - NO es almacén regular:', {
        tipoAlmacen: transferData.tipoAlmacen,
        transferData
      });
    }
    
    // Log para debugging - ANTES de enviar
    console.log('🔍 Frontend - Datos de transferencia ANTES de enviar:', {
      hardwareId,
      requestData,
      requestDataKeys: Object.keys(requestData),
      transferDataSeccion: transferData.seccion,
      requestDataSeccion: requestData.seccion,
      requestDataSeccionType: typeof requestData.seccion,
      tieneSeccionEnRequest: 'seccion' in requestData,
      requestDataStringified: JSON.stringify(requestData)
    });

    this.estadoEquipoService.transferirEquipo(hardwareId, requestData).subscribe({
      next: (response) => {
        if (response.success) {
          this.cargarDatos();
          this.notificationService.showSuccessMessage(
            `Equipo transferido exitosamente.`
          );
        } else {
          throw new Error(response.message || 'Error al transferir el equipo');
        }
      },
      error: (error) => {
        console.error('Error al transferir equipo:', error);
        this.notificationService.showError(
          'Error al transferir equipo',
          `No se pudo transferir el equipo: ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        this.transferiendoItemId = null;
      }
    });
  }

  private procesarTransferenciaDispositivo(item: any, mac: string, transferData: any): void {
    this.transferiendoItemId = item.id;

    // Preparar datos para el backend
    const requestData: any = {
      almacenId: transferData.almacenId,
      tipoAlmacen: transferData.tipoAlmacen,
      observaciones: transferData.observaciones || '',
      usuario: 'Usuario' // TODO: Obtener del contexto de autenticación
    };

    if (transferData.tipoAlmacen === 'regular') {
      requestData.estanteria = transferData.estanteria;
      requestData.estante = transferData.estante;
      requestData.seccion = transferData.seccion;
    }

    this.estadoDispositivoService.transferirDispositivo(mac, requestData).subscribe({
      next: (response) => {
        if (response.success) {
          this.cargarDatos();
          this.notificationService.showSuccessMessage(
            `Dispositivo transferido exitosamente.`
          );
        } else {
          throw new Error(response.message || 'Error al transferir el dispositivo');
        }
      },
      error: (error) => {
        console.error('Error al transferir dispositivo:', error);
        this.notificationService.showError(
          'Error al transferir dispositivo',
          `No se pudo transferir el dispositivo: ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        this.transferiendoItemId = null;
      }
    });
  }

  /**
   * Toggle del dropdown de acciones
   */
  toggleDropdown(item: any, event: Event): void {
    event.stopPropagation();
    if (this.dropdownAbiertoId === item.id) {
      this.dropdownAbiertoId = null;
    } else {
      this.dropdownAbiertoId = item.id;
    }
  }

  /**
   * Cerrar dropdown de acciones
   */
  cerrarDropdown(): void {
    this.dropdownAbiertoId = null;
  }

  /**
   * Método para reactivar equipo o dispositivo
   */
  reactivarEquipo(item: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.cerrarDropdown();

    // Solo permitir reactivar equipos o dispositivos especiales
    if (!this.esEquipoEspecial(item)) {
      this.notificationService.showError(
        'Operación no permitida',
        'Solo se pueden reactivar equipos o dispositivos especiales (del cementerio o almacén laboratorio).'
      );
      return;
    }

    const tipoEquipo = this.getTipoEquipo(item);
    
    if (tipoEquipo === 'EQUIPO') {
      const hardwareId = item.itemId || item.estadoInfo?.hardwareId;
      if (!hardwareId) {
        this.notificationService.showError(
          'Error',
          'No se pudo identificar el equipo a reactivar.'
        );
        return;
      }
      this.procesarReactivacionEquipo(item, hardwareId);
    } else if (tipoEquipo === 'DISPOSITIVO') {
      const mac = item.numero || item.estadoInfo?.mac || item.item?.nombreItem;
      if (!mac) {
        this.notificationService.showError(
          'Error',
          'No se pudo identificar el dispositivo a reactivar.'
        );
        return;
      }
      this.procesarReactivacionDispositivo(item, mac);
    } else {
      this.notificationService.showError(
        'Operación no permitida',
        'Tipo de item no soportado para reactivación.'
      );
    }
  }

  private procesarReactivacionEquipo(item: any, hardwareId: number): void {
    this.reactivandoItemId = item.id;

    const request: CambioEstadoRequest = {
      observaciones: 'Reactivado desde almacén',
      usuario: 'Usuario' // TODO: Obtener del contexto de autenticación
    };

    this.estadoEquipoService.reactivarEquipo(hardwareId, request).subscribe({
      next: (response) => {
        if (response.success) {
          this.cargarDatos();
          this.notificationService.showSuccessMessage(
            `Equipo reactivado exitosamente.`
          );
        } else {
          throw new Error(response.message || 'Error al reactivar el equipo');
        }
      },
      error: (error) => {
        console.error('Error al reactivar equipo:', error);
        this.notificationService.showError(
          'Error al reactivar equipo',
          `No se pudo reactivar el equipo: ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        this.reactivandoItemId = null;
      }
    });
  }

  private procesarReactivacionDispositivo(item: any, mac: string): void {
    this.reactivandoItemId = item.id;

    const request: CambioEstadoDispositivoRequest = {
      observaciones: 'Reactivado desde almacén',
      usuario: 'Usuario' // TODO: Obtener del contexto de autenticación
    };

    this.estadoDispositivoService.reactivarDispositivo(mac, request).subscribe({
      next: (response) => {
        if (response.success) {
          this.cargarDatos();
          this.notificationService.showSuccessMessage(
            `Dispositivo reactivado exitosamente.`
          );
        } else {
          throw new Error(response.message || 'Error al reactivar el dispositivo');
        }
      },
      error: (error) => {
        console.error('Error al reactivar dispositivo:', error);
        this.notificationService.showError(
          'Error al reactivar dispositivo',
          `No se pudo reactivar el dispositivo: ${error.message || 'Error desconocido'}`
        );
      },
      complete: () => {
        this.reactivandoItemId = null;
      }
    });
  }
} 