import { ChangeDetectorRef, Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ActivatedRoute } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { BiosService } from '../services/bios.service';
import { CpuService } from '../services/cpu.service';
import { DriveService } from '../services/drive.service';
import { MemoryService } from '../services/memory.service';
import { MonitorService } from '../services/monitor.service';
import { StorageService } from '../services/storage.service';
import { VideoService } from '../services/video.service';
import { Location, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { AssetEditModalComponent } from '../asset-edit-modal/asset-edit-modal.component';
import { forkJoin } from 'rxjs';
import { SoftwareByHardwareService } from '../services/software-by-hardware.service';
import { UbicacionesService } from '../services/ubicaciones.service';
import { UbicacionDTO, UbicacionHistorialDTO } from '../interfaces/ubicacion.interface';
import { LocationSelectorModalComponent } from '../components/location-selector-modal/location-selector-modal.component';
import { AssetLocationPickerModalComponent } from '../components/asset-location-picker-modal/asset-location-picker-modal.component';
import { BiosDetailsComponent } from '../bios-details/bios-details.component';
import { PermissionsService } from '../services/permissions.service';
import {
  SubnetDTO,
  SubnetService,
  resolveSubnetDisplayNameForIpv4
} from '../services/subnet.service';
import { CpuDetailsComponent } from '../cpu-details/cpu-details.component';
import { DriveDetailsComponent } from '../drive-details/drive-details.component';
import { MemoryDetailsComponent } from '../memory-details/memory-details.component';
import { MonitorDetailsComponent } from '../monitor-details/monitor-details.component';
import { StorageDetailsComponent } from '../storage-details/storage-details.component';
import { VideoDetailsComponent } from '../video-details/video-details.component';
import { SoftwareDetailsComponent } from '../software-details/software-details.component';
import { GuidedTourHostService } from '../services/guided-tour-host.service';
import { TourRegistryService } from '../services/tour-registry.service';
import type { Driver, DriveStep } from 'driver.js';

interface Asset {
  id: number;
  deviceId: string;
  name: string;
  workgroup: string;
  osName: string;
  osVersion: string;
  osComments: string;
  processors: string;
  processorType: string;
  processorN: number;
  memory: number;
  swap: number;
  ipAddr: string;
  ipSrc: string;
  dns: string;
  defaultGateway: string;
  type: string;
  description: string;
  winCompany: string;
  winOwner: string;
  userid?: string;
  winProdId: string;
  winProdKey: string;
  lastDate: Date;
  lastCome: Date;
}

@Component({
  selector: 'app-assetdetails',
  standalone: true,
  imports: [
    CommonModule, 
    NgbModalModule,
    BiosDetailsComponent,
    CpuDetailsComponent,
    DriveDetailsComponent,
    MemoryDetailsComponent,
    MonitorDetailsComponent,
    StorageDetailsComponent,
    VideoDetailsComponent,
    SoftwareDetailsComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [
    BiosService,
    CpuService,
    DriveService,
    MemoryService,
    MonitorService,
    StorageService,
    VideoService,
    SoftwareByHardwareService,
    UbicacionesService
  ],
  templateUrl: './assetdetails.component.html',
  styleUrls: ['./assetdetails.component.css']
})
export class AssetdetailsComponent implements OnInit, OnDestroy {
  asset: Asset | null = null;
  /** Lista de subnets cargada desde la API para resolver nombre por IP. */
  subnets: SubnetDTO[] = [];
  subnetsLoaded = false;
  activeTab: string = 'general';
  componentData: any = {};
  ubicacionActual?: UbicacionDTO;
  loading: boolean = false;
  error: string | null = null;
  ubicacionesDisponibles: UbicacionDTO[] = [];
  historialUbicaciones: UbicacionHistorialDTO[] = [];
  loadingHistorialUbicaciones = false;
  errorHistorialUbicaciones: string | null = null;
  deletingHistorialId: number | null = null;
  showDeleteHistorialDialog = false;
  historialPendienteEliminar: UbicacionHistorialDTO | null = null;
  private pageTour?: Driver;
  private tourCleanup?: () => void;
  private returnToAssetsAfterTour = false;
  private readonly loadedComponentTabs = new Set<string>();
  private readonly loadingComponentTabs = new Set<string>();

  private readonly tourTabButtonSelectors: Record<string, string> = {
    general: '#tour-assetdetails-tab-general',
    bios: '#tour-assetdetails-tab-bios',
    cpu: '#tour-assetdetails-tab-cpu',
    drive: '#tour-assetdetails-tab-drive',
    memory: '#tour-assetdetails-tab-memory',
    monitor: '#tour-assetdetails-tab-monitor',
    storage: '#tour-assetdetails-tab-storage',
    video: '#tour-assetdetails-tab-video',
    ubicacion: '#tour-assetdetails-tab-ubicacion',
    software: '#tour-assetdetails-tab-software'
  };

  constructor(
    private route: ActivatedRoute,
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private cpuService: CpuService,
    private driveService: DriveService,
    private memoryService: MemoryService,
    private monitorService: MonitorService,
    private storageService: StorageService,
    private videoService: VideoService,
    private location: Location,
    private router: Router,
    private modalService: NgbModal,
    private softwareByHardwareService: SoftwareByHardwareService,
    private ubicacionesService: UbicacionesService,
    private subnetService: SubnetService,
    public permissionsService: PermissionsService,
    private guidedTourHost: GuidedTourHostService,
    private tourRegistry: TourRegistryService,
    private cdr: ChangeDetectorRef
  ) { }

  /** Nombre de subred (`subnet.NAME`) obtenido emparejando `asset.ipAddr` con NETID/MASK de Cerbero. */
  get nombreSubredDesdeIp(): string {
    if (!this.subnetsLoaded) return 'Cargando…';
    return resolveSubnetDisplayNameForIpv4(this.asset?.ipAddr, this.subnets);
  }

  ngOnInit(): void {
    this.tourCleanup = this.tourRegistry.register('asset-details', [{
      id: 'assetdetails-overview',
      title: 'Tour del detalle del equipo',
      icon: 'fa-route',
      run: () => this.iniciarTourDetalleActivo(),
    }]);
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      if (idParam) {
        const id = parseInt(idParam, 10);
        if (!isNaN(id)) {
          this.hardwareService.getHardwareById(id).subscribe(
            (result: any) => {
              result.lastDate = result.lastDate ? new Date(result.lastDate) : null;
              result.lastCome = result.lastCome ? new Date(result.lastCome) : null;
              this.asset = result as Asset;
              this.componentData = {};
              this.loadedComponentTabs.clear();
              this.loadingComponentTabs.clear();
              this.scrollAssetDetailsViewportToTop();
              window.setTimeout(() => this.scrollAssetDetailsViewportToTop(), 0);

              this.subnetsLoaded = false;
              this.subnetService.getSubnets().subscribe({
                next: (subs) => {
                  this.subnets = subs;
                  this.subnetsLoaded = true;
                },
                error: () => {
                  this.subnets = [];
                  this.subnetsLoaded = true;
                }
              });
              
              // Pre-cargar datos de todas las pestañas (incl. Software: evita desalinear el spotlight del tour hasta que llega el HTTP).
              ['bios', 'cpu', 'drive', 'memory', 'monitor', 'storage', 'video', 'software'].forEach((tab) => {
                this.loadComponentData(tab);
              });

              if (this.asset?.id) {
                this.cargarUbicacion();
                this.cargarHistorialUbicaciones();
                const startDetailsTour = sessionStorage.getItem('cerbero:start-asset-details-tour') === '1';
                this.returnToAssetsAfterTour = sessionStorage.getItem('cerbero:return-to-assets-after-details-tour') === '1';
                if (startDetailsTour) {
                  sessionStorage.removeItem('cerbero:start-asset-details-tour');
                  window.setTimeout(() => this.iniciarTourDetalleActivo(), 220);
                }
              }
            },
            (error) => {
              console.error('Error al obtener el asset:', error);
            }
          );
        } else {
          console.error('ID inválido:', idParam);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
    this.pageTour?.destroy();
    this.pageTour = undefined;
  }

  changeTab(tab: string): void {
    const tabContent = document.querySelector('.tab-content');
    if (tabContent) {
      tabContent.classList.add('fading');
    }

    setTimeout(() => {
      this.activeTab = tab;
      this.loadComponentData(tab);
      if (tabContent) {
        tabContent.classList.remove('fading');
      }
    }, 150);
  }

  loadComponentData(component: string, forceReload = false): void {
    if (!this.asset) return;
    if (!forceReload && (this.loadedComponentTabs.has(component) || this.loadingComponentTabs.has(component))) {
      return;
    }

    let service: any;
    let method: string = 'getByHardwareId';

    switch (component) {
      case 'bios':
        service = this.biosService;
        break;
      case 'cpu':
        service = this.cpuService;
        break;
      case 'drive':
        service = this.driveService;
        break;
      case 'memory':
        service = this.memoryService;
        break;
      case 'monitor':
        service = this.monitorService;
        break;
      case 'storage':
        service = this.storageService;
        break;
      case 'video':
        service = this.videoService;
        break;
      case 'software':
        service = this.softwareByHardwareService;
        break;
      default:
        return;
    }

    if (service && service[method]) {
      this.loadingComponentTabs.add(component);
      service[method](this.asset.id).subscribe(
        (data: any) => {
          if (component === 'bios' || component === 'cpu') {
            // Asegurarse de que los datos sean un objeto único
            this.componentData[component] = Array.isArray(data) ? data[0] : data;
          } else {
            // Para otros componentes, mantener el comportamiento actual
            this.componentData[component] = Array.isArray(data) ? data : [data];
          }
          this.loadedComponentTabs.add(component);
          this.loadingComponentTabs.delete(component);

        },
        (error: unknown) => {
          console.error(`Error al cargar datos de ${component}:`, error);
          this.componentData[component] = null;
          this.loadedComponentTabs.add(component);
          this.loadingComponentTabs.delete(component);
        }
      );
    } else {
      console.error(`Método ${method} no encontrado en el servicio para ${component}`);
    }
  }

  exportarAPdf(): void {
    // Verificar que todos los datos estén cargados
    if (!this.asset) {
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let currentY = 20;

    const addFooterToAllPages = () => {
      const pageCount = doc.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
        doc.setPage(pageNumber);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(
          `Página ${pageNumber} de ${pageCount}`,
          pageWidth - 20,
          pageHeight - 10,
          { align: 'right' }
        );

        doc.setDrawColor(200);
        doc.line(
          14,
          pageHeight - 20,
          pageWidth - 14,
          pageHeight - 20
        );
      }
    };
    
    // Configuración del encabezado
    doc.setFillColor(65, 161, 175);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text(`REPORTE COMPLETO - ${this.asset.name}`, pageWidth/2, 18, { align: 'center' });
    
    // Resetear color de texto para el contenido
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    
    // Agregar fecha de generación
    const fecha = new Date().toLocaleString();
    doc.text(`Generado el: ${fecha}`, 14, 35);
    // El contenido de secciones debe empezar debajo de la fecha para evitar solapamientos.
    currentY = 45;
    
    // Función para agregar nueva página si es necesario
    const addNewPageIfNeeded = (requiredSpace: number) => {
      if (currentY + requiredSpace > pageHeight - 30) {
        doc.addPage();
        currentY = 20;
        return true;
      }
      return false;
    };

    // Función para agregar sección con título
    const addSection = (title: string, data: any[][]) => {
      // Verificar si necesitamos nueva página
      const requiredSpace = 20 + (data.length * 8);
      addNewPageIfNeeded(requiredSpace);
      
      // Título de sección
      doc.setFontSize(14);
      doc.setTextColor(65, 161, 175);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, currentY);
      currentY += 8;
      
      // Línea divisoria
      doc.setDrawColor(65, 161, 175);
      doc.line(14, currentY, pageWidth - 14, currentY);
      currentY += 5;
      
      // Generar tabla
      autoTable(doc, {
        startY: currentY,
        head: [['Característica', 'Valor']],
        body: data,
        theme: 'grid',
        headStyles: {
          fillColor: [65, 161, 175],
          textColor: 255,
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 9,
          textColor: 50,
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        margin: { top: currentY, right: 14, bottom: 20, left: 14 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 'auto' },
          1: { cellWidth: 'auto' }
        }
      });
      
      // Actualizar posición Y después de la tabla
      const tableHeight = (doc as any).lastAutoTable.finalY;
      currentY = tableHeight + 15;
    };

    // 1. INFORMACIÓN GENERAL
    addSection('INFORMACIÓN GENERAL', this.prepareGeneralData());
    
    // 2. INFORMACIÓN DE BIOS
    if (this.componentData.bios) {
      addSection('INFORMACIÓN DE BIOS', this.prepareBiosData());
    }
    
    // 3. INFORMACIÓN DE CPU
    if (this.componentData.cpu) {
      addSection('INFORMACIÓN DE CPU', this.prepareCpuData());
    }
    
    // 4. INFORMACIÓN DE UNIDADES
    if (this.componentData.drive && this.componentData.drive.length > 0) {
      addSection('INFORMACIÓN DE UNIDADES', this.prepareDriveData());
    }
    
    // 5. INFORMACIÓN DE MEMORIA
    if (this.componentData.memory && this.componentData.memory.length > 0) {
      addSection('INFORMACIÓN DE MEMORIA', this.prepareMemoryData());
    }
    
    // 6. INFORMACIÓN DE MONITORES
    if (this.componentData.monitor && this.componentData.monitor.length > 0) {
      addSection('INFORMACIÓN DE MONITORES', this.prepareMonitorData());
    }
    
    // 7. INFORMACIÓN DE ALMACENAMIENTO
    if (this.componentData.storage && this.componentData.storage.length > 0) {
      addSection('INFORMACIÓN DE ALMACENAMIENTO', this.prepareStorageData());
    }
    
    // 8. INFORMACIÓN DE VIDEO
    if (this.componentData.video && this.componentData.video.length > 0) {
      addSection('INFORMACIÓN DE VIDEO', this.prepareVideoData());
    }
    
    // 9. INFORMACIÓN DE UBICACIÓN
    if (this.ubicacionActual) {
      addSection('INFORMACIÓN DE UBICACIÓN', this.prepareUbicacionData());
    }
    
    // 10. SOFTWARE INSTALADO
    if (this.componentData.software && this.componentData.software.length > 0) {
      addSection('SOFTWARE INSTALADO', this.prepareSoftwareData());
    }

    // Renderizar pie de página una sola vez por hoja para evitar superposición.
    addFooterToAllPages();

    // Guardar el PDF con nombre descriptivo
    const fileName = `${this.asset.name}_REPORTE_COMPLETO_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  prepareGeneralData(): any[][] {
    const subredPdf = !this.subnetsLoaded
      ? 'Cargando…'
      : resolveSubnetDisplayNameForIpv4(this.asset?.ipAddr, this.subnets);
    return [
      ['ID', this.asset?.id?.toString() ?? 'N/A'],
      ['Device ID', this.asset?.deviceId ?? 'N/A'],
      ['Nombre', this.asset?.name ?? 'N/A'],
      ['Grupo de trabajo', this.asset?.workgroup ?? 'N/A'],
      ['Sistema Operativo', this.asset?.osName ?? 'N/A'],
      ['Versión SO', this.asset?.osVersion ?? 'N/A'],
      ['Comentarios SO', this.asset?.osComments ?? 'N/A'],
      ['Procesadores', this.asset?.processors?.toString() ?? 'N/A'],
      ['Tipo de Procesador', this.asset?.processorType ?? 'N/A'],
      ['Núcleos', this.asset?.processorN?.toString() ?? 'N/A'],
      ['Memoria', this.asset?.memory ? `${this.asset.memory} MB` : 'N/A'],
      ['Swap', this.asset?.swap ? `${this.asset.swap} MB` : 'N/A'],
      ['Dirección IP', this.asset?.ipAddr ?? 'N/A'],
      ['IP Source', this.asset?.ipSrc ?? 'N/A'],
      ['DNS', this.asset?.dns ?? 'N/A'],
      ['Gateway por defecto', this.asset?.defaultGateway ?? 'N/A'],
      ['Subred (según IP)', subredPdf],
      ['Descripción', this.asset?.description ?? 'N/A'],
      ['Compañía Windows', this.asset?.winCompany ?? 'N/A'],
      ['Último usuario conectado', this.asset?.userid ?? 'N/A'],
      ['ID de Producto Windows', this.asset?.winProdId ?? 'N/A'],
      ['Clave de Producto Windows', this.asset?.winProdKey ?? 'N/A'],
      ['Último inventario procesado', this.asset?.lastDate ? new Date(this.asset.lastDate).toLocaleString() : 'N/A'],
      ['Último contacto del agente', this.asset?.lastCome ? new Date(this.asset.lastCome).toLocaleString() : 'N/A'],
    ];
  }

  prepareBiosData(): any[][] {
    if (!this.componentData.bios) {
      return [['No hay datos de BIOS disponibles', '']];
    }

    const bios = this.componentData.bios;
    

    
    return [
      ['Fabricante del Sistema', bios.smanufacturer || 'N/A'],
      ['Modelo del Sistema', bios.smodel || 'N/A'],
      ['Número de Serie del Sistema', bios.ssn || 'N/A'],
      ['Tipo de BIOS', bios.type || 'N/A'],
      ['Fabricante del BIOS', bios.bmanufacturer || 'N/A'],
      ['Versión del BIOS', bios.bversion || 'N/A'],
      ['Fecha del BIOS', bios.bdate || 'N/A'],
      ['Etiqueta de Activo', bios.assetTag || 'N/A'],
      ['Fabricante de la Placa Base', bios.mmanufacturer || 'N/A'],
      ['Modelo de la Placa Base', bios.mmodel || 'N/A'],
      ['Número de Serie de la Placa Base', bios.msn || 'N/A']
    ];
  }

  prepareCpuData(): any[][] {
    if (!this.componentData.cpu) {
      return [['No hay datos de CPU disponibles', '']];
    }

    const cpu = this.componentData.cpu;
    const data = [
      ['ID', cpu.id?.toString() || 'N/A'],
      ['ID de Hardware', cpu.hardwareId?.toString() || 'N/A'],
      ['Fabricante', cpu.manufacturer || 'N/A'],
      ['Tipo', cpu.type || 'N/A'],
      ['Número de Serie', cpu.serialNumber || 'N/A'],
      ['Velocidad', cpu.speed ? `${cpu.speed} GHz` : 'N/A'],
      ['Núcleos', cpu.cores?.toString() || 'N/A'],
      ['Tamaño de Caché L2', cpu.l2CacheSize ? `${cpu.l2CacheSize} MB` : 'N/A'],
      ['Arquitectura', cpu.cpuArch || 'N/A'],
      ['Ancho de Datos', cpu.dataWidth?.toString() || 'N/A'],
      ['Ancho de Dirección Actual', cpu.currentAddressWidth?.toString() || 'N/A'],
      ['CPUs Lógicas', cpu.logicalCpus?.toString() || 'N/A'],
      ['Voltaje', cpu.voltage ? `${cpu.voltage}V` : 'N/A'],
      ['Velocidad Actual', cpu.currentSpeed ? `${cpu.currentSpeed} GHz` : 'N/A'],
      ['Socket', cpu.socket || 'N/A']
    ];

    return data;
  }

  prepareDriveData(): any[][] {
    if (!this.componentData.drive || this.componentData.drive.length === 0) {
      return [['No hay datos de unidades disponibles', '']];
    }

    return this.componentData.drive.flatMap((drive: any, index: number) => [
      [`Unidad ${index + 1}`, ''],
      ['ID', drive.id?.toString() || 'N/A'],
      ['ID de Hardware', drive.hardwareId?.toString() || 'N/A'],
      ['Fecha de creación', drive.createDate ? new Date(drive.createDate).toLocaleString() : 'N/A'],
      ['Sistema de archivos', drive.filesystem || 'N/A'],
      ['Espacio libre', drive.free ? `${drive.free} GB` : 'N/A'],
      ['Letra de unidad', drive.letter || 'N/A'],
      ['Número de archivos', drive.numFiles?.toString() || 'N/A'],
      ['Capacidad total', drive.total ? `${drive.total} GB` : 'N/A'],
      ['Tipo', drive.type || 'N/A'],
      ['Volumen', drive.volumn || 'N/A']
    ]);
  }

  prepareMemoryData(): any[][] {
    if (!this.componentData.memory || this.componentData.memory.length === 0) {
      return [['No hay datos de memoria disponibles', '']];
    }

    return this.componentData.memory.flatMap((memory: any, index: number) => [
      [`Módulo de memoria ${index + 1}`, ''],
      ['Capacidad', memory.capacity ? `${memory.capacity} MB` : 'N/A'],
      ['Descripción breve', memory.caption || 'N/A'],
      ['Descripción detallada', memory.description || 'N/A'],
      ['ID de Hardware', memory.hardwareId?.toString() || 'N/A'],
      ['Número de slots', memory.numSlots?.toString() || 'N/A'],
      ['Propósito', memory.purpose || 'N/A'],
      ['Número de serie', memory.serialNumber || 'N/A'],
      ['Velocidad', memory.speed ? `${memory.speed} MHz` : 'N/A'],
      ['Tipo', memory.type || 'N/A']
    ]);
  }

  prepareMonitorData(): any[][] {
    if (!this.componentData.monitor || this.componentData.monitor.length === 0) {
      return [['No hay datos de monitor disponibles', '']];
    }

    return this.componentData.monitor.flatMap((monitor: any, index: number) => [
      [`Monitor ${index + 1}`, ''],
      ['Nombre', monitor.caption || 'N/A'],
      ['Descripción', monitor.description || 'N/A'],
      ['ID de Hardware', monitor.hardwareId?.toString() || 'N/A'],
      ['ID', monitor.id?.toString() || 'N/A'],
      ['Fabricante', monitor.manufacturer || 'N/A'],
      ['Número de serie', monitor.serial || 'N/A'],
      ['Tipo', monitor.type || 'N/A']
    ]);
  }

  prepareStorageData(): any[][] {
    if (!this.componentData.storage || this.componentData.storage.length === 0) {
      return [['No hay datos de almacenamiento disponibles', '']];
    }

    return this.componentData.storage.flatMap((storage: any, index: number) => [
      [`Dispositivo de almacenamiento ${index + 1}`, ''],
      ['Descripción', storage.description || 'N/A'],
      ['Tamaño del disco', storage.diskSize ? `${storage.diskSize} GB` : 'N/A'],
      ['Firmware', storage.firmware || 'N/A'],
      ['ID de Hardware', storage.hardwareId?.toString() || 'N/A'],
      ['ID', storage.id?.toString() || 'N/A'],
      ['Fabricante', storage.manufacturer || 'N/A'],
      ['Modelo', storage.model || 'N/A'],
      ['Nombre', storage.name || 'N/A'],
      ['Número de serie', storage.serialNumber || 'N/A'],
      ['Tipo', storage.type || 'N/A']
    ]);
  }

  prepareVideoData(): any[][] {
    if (!this.componentData.video || this.componentData.video.length === 0) {
      return [['No hay datos de video disponibles', '']];
    }

    return this.componentData.video.flatMap((video: any, index: number) => [
      [`Tarjeta de video ${index + 1}`, ''],
      ['Chipset', video.chipset || 'N/A'],
      ['ID de Hardware', video.hardwareId?.toString() || 'N/A'],
      ['ID', video.id?.toString() || 'N/A'],
      ['Memoria', video.memory ? `${video.memory} MB` : 'N/A'],
      ['Nombre', video.name || 'N/A'],
      ['Resolución', video.resolution || 'N/A']
    ]);
  }

  prepareSoftwareData(): any[][] {
    if (!this.componentData.software || this.componentData.software.length === 0) {
      return [['No hay software instalado disponible', '']];
    }

    return this.componentData.software.map((sw: any) => [
      ['Nombre', sw.name || 'N/A'],
      ['Editor', sw.publisher || 'N/A'],
      ['Versión', sw.version || 'N/A']
    ]).flat();
  }

  prepareUbicacionData(): any[][] {
    if (!this.componentData.ubicacion) {
      return [['No hay datos de ubicación disponibles', '']];
    }

    const ubicacion = this.componentData.ubicacion;
    return [
      ['Gerencia', ubicacion.nombreGerencia || 'N/A'],
      ['Oficina', ubicacion.nombreOficina || 'N/A'],
      ['Piso', ubicacion.piso || 'N/A'],
      ['Número de Puerta', ubicacion.numeroPuerta || 'N/A'],
      ['Interno', ubicacion.interno || 'N/A'],
      ['Departamento', ubicacion.departamento || 'N/A'],
      ['Ciudad', ubicacion.ciudad || 'N/A'],
      ['Dirección', ubicacion.direccion || 'N/A'],
      ['Subnet', ubicacion.subnet?.toString() || 'N/A']
    ];
  }

  volver(): void {
    this.location.back();
  }

  editarAsset(): void {
    const modalRef = this.modalService.open(AssetEditModalComponent, { size: 'lg' });
    modalRef.componentInstance.asset = { ...this.asset };
    modalRef.result.then((result) => {
      if (result) {
        this.asset = result;
      }
    }, (reason) => {
    });
  }

  cargarUbicacion() {
    if (this.asset?.id) {
      this.loading = true;
      this.error = null;
      this.ubicacionesService.getUbicacionEquipo(this.asset.id).subscribe({
        next: (ubicacion) => {
          this.ubicacionActual = ubicacion;
          this.componentData.ubicacion = ubicacion;
          this.loading = false;
        },
        error: (error: any) => {
          if (error.message?.includes('no encontrada')) {
            this.ubicacionActual = undefined;
            this.componentData.ubicacion = null;
            this.error = null;
          } else {
            console.error('Error al cargar ubicación:', error);
            this.error = 'Error al cargar la ubicación. Por favor, intente nuevamente.';
            this.ubicacionActual = undefined;
            this.componentData.ubicacion = null;
          }
          this.loading = false;
        }
      });
    }
  }

  cargarHistorialUbicaciones() {
    if (!this.asset?.id) {
      this.historialUbicaciones = [];
      this.errorHistorialUbicaciones = null;
      return;
    }

    this.loadingHistorialUbicaciones = true;
    this.errorHistorialUbicaciones = null;

    this.ubicacionesService.getHistorialUbicacionesEquipo(this.asset.id).subscribe({
      next: (historial) => {
        this.historialUbicaciones = historial ?? [];
        this.loadingHistorialUbicaciones = false;
      },
      error: (error: unknown) => {
        console.error('Error al cargar historial de ubicaciones:', error);
        this.historialUbicaciones = [];
        this.errorHistorialUbicaciones = 'No se pudo cargar el historial de ubicaciones.';
        this.loadingHistorialUbicaciones = false;
      }
    });
  }

  formatHistorialFecha(value: string | null): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  formatHistorialOrigen(origen: string | null | undefined): string {
    if (!origen) return 'N/A';
    switch (origen) {
      case 'INVENTARIO_MODAL':
        return 'Inventario (edición activo)';
      case 'ASSET_DETAILS':
        return 'Asset details (pestaña Ubicación)';
      case 'BACKFILL':
        return 'Backfill automático';
      case 'BACKFILL_LEGACY':
        return 'Backfill legacy';
      default:
        return origen;
    }
  }

  solicitarEliminarMovimientoHistorial(item: UbicacionHistorialDTO): void {
    if (!item?.id || this.deletingHistorialId !== null) return;
    this.historialPendienteEliminar = item;
    this.showDeleteHistorialDialog = true;
  }

  cancelarEliminarMovimientoHistorial(): void {
    this.showDeleteHistorialDialog = false;
    this.historialPendienteEliminar = null;
  }

  confirmarEliminarMovimientoHistorial(): void {
    const item = this.historialPendienteEliminar;
    if (!item?.id || this.deletingHistorialId !== null) return;

    this.deletingHistorialId = item.id;
    this.ubicacionesService.deleteHistorialUbicacion(item.id).subscribe({
      next: () => {
        this.deletingHistorialId = null;
        this.cancelarEliminarMovimientoHistorial();
        this.cargarHistorialUbicaciones();
      },
      error: (error: any) => {
        this.deletingHistorialId = null;
        console.error('Error al eliminar movimiento del historial:', error);
        this.errorHistorialUbicaciones = error?.error?.message || error?.message || 'No se pudo eliminar el movimiento del historial.';
        this.cancelarEliminarMovimientoHistorial();
      }
    });
  }

  actualizarUbicacion() {
    if (this.ubicacionActual && this.asset?.id) {
      this.loading = true;
      this.error = null;

      // Si ya existe una ubicación, actualizamos; si no, creamos una nueva
      if (this.ubicacionActual.id) {
        // Para actualización, enviamos el ID de la ubicación, hardwareId y tipo
        const ubicacionData = {
          id: this.ubicacionActual.id,
          hardwareId: this.asset.id,
          tipo: 'EQUIPO' as const
        };

        this.ubicacionesService.actualizarUbicacionEquipo(this.asset.id, ubicacionData).subscribe({
          next: (response) => {
            this.cargarUbicacion();
            this.cargarHistorialUbicaciones();
            this.loading = false;
          },
          error: (error: any) => {
            console.error('Error al actualizar ubicación:', error);
            this.error = error.error?.message || 'Error al actualizar la ubicación. Por favor, intente nuevamente.';
            this.loading = false;
          }
        });
      } else {
        // Para creación, enviamos el ID y hardwareId
        const ubicacionData = {
          id: this.ubicacionActual.id,
          hardwareId: this.asset.id,
          tipo: 'EQUIPO' as const
        };

        this.ubicacionesService.crearUbicacionEquipo(ubicacionData).subscribe({
          next: (response) => {
            this.cargarUbicacion();
            this.cargarHistorialUbicaciones();
            this.loading = false;
          },
          error: (error: any) => {
            console.error('Error al crear ubicación:', error);
            this.error = error.error?.message || 'Error al crear la ubicación. Por favor, intente nuevamente.';
            this.loading = false;
          }
        });
      }
    }
  }

  seleccionarUbicacion() {
    this.loading = true;
    this.error = null;
    
    this.ubicacionesService.getUbicaciones().subscribe({
      next: (ubicaciones) => {
        this.ubicacionesDisponibles = ubicaciones;
        const modalRef = this.modalService.open(AssetLocationPickerModalComponent, { 
          size: 'lg',
          backdrop: 'static',
          keyboard: false
        });
        
        modalRef.componentInstance.ubicaciones = this.ubicacionesDisponibles;
        
        modalRef.result.then(
          (ubicacionSeleccionada: UbicacionDTO) => {
            if (ubicacionSeleccionada && this.asset?.id) {
              // Validaciones
              if (!ubicacionSeleccionada.id) {
                console.error('La ubicación seleccionada no tiene ID');
                this.error = 'Error: La ubicación seleccionada no es válida';
                return;
              }

              if (typeof ubicacionSeleccionada.id !== 'number') {
                console.error('El ID de ubicación debe ser un número');
                this.error = 'Error: ID de ubicación inválido';
                return;
              }

              // Preparar datos
              this.ubicacionActual = {
                ...ubicacionSeleccionada,
                tipo: 'EQUIPO',
                hardwareId: this.asset.id,
                macaddr: null
              };

              this.actualizarUbicacion();
            }
          },
          () => {
            this.loading = false;
          }
        ).catch(error => {
          console.error('Error en el modal:', error);
          this.error = 'Error al seleccionar la ubicación';
          this.loading = false;
        });
      },
      error: (error) => {
        console.error('Error cargando ubicaciones:', error);
        this.error = 'Error al cargar las ubicaciones disponibles. Por favor, intente nuevamente.';
        this.loading = false;
      }
    });
  }

  openLocationModal() {
    const modalRef = this.modalService.open(LocationSelectorModalComponent, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });

    modalRef.componentInstance.ubicacion = this.ubicacionActual;
    modalRef.componentInstance.isAssignmentMode = true;
    
    modalRef.result.then(
      (result) => {
        if (result) {
          this.ubicacionActual = result;
          this.cargarUbicacion();
        }
      },
      (reason) => {
      }
    );
  }

  /**
   * Verifica si el usuario puede gestionar ubicaciones de assets
   * Solo administradores y Game Masters pueden modificar ubicaciones
   */
  canManageAssetLocations(): boolean {
    return this.permissionsService.canManageAssets();
  }

  canDeleteAssetLocationHistory(): boolean {
    return this.permissionsService.isGMOrAdmin();
  }

  /** Al abrir esta pantalla conviene quedar arriba (evita recuperar scroll de navegaciones largas previas). */
  private scrollAssetDetailsViewportToTop(): void {
    const apply = (): void => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
      document.body.scrollTop = 0;
      const main = document.querySelector('.main-content');
      if (main instanceof HTMLElement) {
        main.scrollTop = 0;
      }
    };
    apply();
    requestAnimationFrame(apply);
  }

  /**
   * Asegura que la franja de pestañas técnicas quede visible para el spotlight.
   *
   * Antes usábamos `block: 'start'`, que empujaba las pestañas al borde superior
   * del viewport aunque ya fueran visibles, ocultando la cabecera y dando la
   * sensación de que la página estaba scrolleada hacia abajo. `block: 'nearest'`
   * solo desplaza si el elemento no entra completo en pantalla, así no se mueve
   * cuando la página ya está al inicio (cabecera + pestañas a la vista).
   */
  private repositionTourTechnicalTabs(driverInst?: Driver): void {
    const tabsEl = document.querySelector('#tour-assetdetails-tabs');
    if (tabsEl instanceof HTMLElement && !this.isElementFullyVisible(tabsEl)) {
      tabsEl.scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
        inline: 'nearest'
      });
    }
    this.guidedTourHost.refreshPopoverLayout(driverInst);
  }

  /** True si el elemento entra completo (vertical) en el viewport actual. */
  private isElementFullyVisible(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    return rect.top >= 0 && rect.bottom <= viewportHeight;
  }

  /** Cambio instantáneo de pestaña para el tour (sin animación fade de changeTab). */
  private activateTabForTour(tab: string): void {
    this.activeTab = tab;
    this.loadComponentData(tab);
    this.cdr.detectChanges();
  }

  private refreshTourStage(driverInst: Driver): void {
    this.guidedTourHost.refreshPopoverLayout(driverInst);
  }

  /** Elemento del botón de pestaña para el spotlight de driver.js (fallback: franja completa). */
  private tourTabButtonEl(tabKey: string): HTMLElement {
    const sel = this.tourTabButtonSelectors[tabKey];
    const btn = sel ? document.querySelector(sel) : null;
    return (btn ?? document.querySelector('#tour-assetdetails-tabs')) as HTMLElement;
  }

  /** Una sola explicación para BIOS, CPU, Unidades, Memoria, Monitor, Discos físicos y Video. */
  private tourHardwareComponentsOverviewStep(): DriveStep {
    return {
      element: '#tour-assetdetails-tabs',
      popover: {
        title: 'Hardware del equipo',
        description:
          'Las pestañas BIOS, CPU, Unidades de disco, Memoria, Monitor, Almacenamiento y Video muestran el detalle técnico inventariado por el agente: modelos, series, tamaños y periféricos. Abrí cada una cuando necesités profundizar en un componente concreto.',
        side: 'bottom',
        align: 'start'
      },
      onHighlightStarted: () => {
        this.activateTabForTour('bios');
      },
      onHighlighted: (_el, _step, opts) => {
        this.repositionTourTechnicalTabs(opts.driver);
      }
    };
  }

  /**
   * Software: después de cargar tabla el layout cambia una vez; segundo refresh tarde alinea hueco/popover si el navegador aún pintaba la filas.
   */
  private tourSoftwareTabStep(): DriveStep {
    return {
      element: (): HTMLElement => {
        this.activateTabForTour('software');
        return this.tourTabButtonEl('software');
      },
      popover: {
        title: 'Software',
        description:
          'Listado de aplicaciones instaladas detectadas por el inventario del agente. El software marcado como prohibido se muestra en rojo (texto y fila destacada).',
        side: 'bottom',
        align: 'start'
      },
      onHighlighted: (_el, _step, opts) => {
        this.repositionTourTechnicalTabs(opts.driver);
        window.setTimeout(() => this.guidedTourHost.refreshPopoverLayout(opts.driver), 240);
      }
    };
  }

  /**
   * Paso por pestaña: driver ilumina solo el botón; el contenido de abajo se actualiza para que coincida con el texto.
   */
  private tourTabContentStep(tab: string, title: string, description: string, side: 'top' | 'bottom' | 'left' | 'right' = 'bottom'): DriveStep {
    return {
      element: (): HTMLElement => {
        this.activateTabForTour(tab);
        return this.tourTabButtonEl(tab);
      },
      popover: { title, description, side, align: 'start' },
      onHighlighted: (_el, _step, opts) => {
        this.refreshTourStage(opts.driver);
      }
    };
  }

  /** Pestaña Ubicación abierta + spotlight sobre el bloque Historial (#tour-assetdetails-history). */
  private tourUbicacionHistorialStep(): DriveStep {
    return {
      element: (): HTMLElement => {
        this.activateTabForTour('ubicacion');
        const hist = document.querySelector('#tour-assetdetails-history');
        const panel = document.querySelector('#tour-assetdetails-tab-panel');
        return (hist ?? panel) as HTMLElement;
      },
      popover: {
        title: 'Historial de ubicaciones',
        description:
          'Cada cambio queda registrado (fecha, usuario, origen, de/a): es la trazabilidad del equipo dentro del organismo.',
        side: 'top',
        align: 'start'
      },
      onHighlighted: (_el, _step, opts) => {
        document.querySelector('#tour-assetdetails-history')?.scrollIntoView({
          behavior: 'auto',
          block: 'start',
          inline: 'nearest'
        });
        this.refreshTourStage(opts.driver);
      }
    };
  }

  private iniciarTourDetalleActivo(): void {
    this.pageTour?.destroy();
    this.scrollAssetDetailsViewportToTop();
    const steps: DriveStep[] = [];
    if (document.querySelector('#tour-assetdetails-ficha-step')) {
      steps.push({
        element: '#tour-assetdetails-ficha-step',
        popover: {
          title: 'Ficha del equipo',
          description: 'Desde esta cabecera y las pestañas accedés a toda la ficha técnica del equipo; cada pestaña muestra datos distintos abajo.',
          side: 'bottom',
          align: 'start'
        },
        onHighlighted: (_el, _step, opts) => {
          this.scrollAssetDetailsViewportToTop();
          this.guidedTourHost.refreshPopoverLayout(opts.driver);
        }
      });
    }

    if (document.querySelector('#tour-assetdetails-tabs')) {
      steps.push({
        element: '#tour-assetdetails-tabs',
        popover: {
          title: 'Pestañas técnicas',
          description:
            'Te mostramos la pestaña General con detalle, un resumen de las pestañas de hardware del equipo, después Ubicación e historial, y por último Software y la exportación a PDF.',
          side: 'bottom',
          align: 'start'
        },
        onHighlighted: (_el, _step, opts) => {
          this.repositionTourTechnicalTabs(opts.driver);
        }
      });
      steps.push(
        this.tourTabContentStep(
          'general',
          'General',
          'Acá ves la identidad del equipo en red (IP y nombre de subred desde Cerbero), últimas fechas de inventario/contacto del agente, sistema operativo, vista resumida de hardware y datos de Windows (usuario, empresa, producto cuando el agente lo informó). Es el panorama operativo día a día antes de entrar en el detalle por componentes.',
          'bottom'
        ),
        this.tourHardwareComponentsOverviewStep(),
        this.tourTabContentStep(
          'ubicacion',
          'Ubicación',
          'Ubicación operativa actual (gerencia, oficina, dirección, etc.). Si tenés permisos, podés asignar o actualizar desde acá.',
          'bottom'
        ),
        this.tourUbicacionHistorialStep(),
        this.tourSoftwareTabStep()
      );
    }

    // Último paso: el botón de exportar PDF está arriba a la derecha de la
    // ficha. Si dejamos que driver.js lo encuadre automáticamente, lo lleva
    // al centro del viewport y la página queda scrolleada hacia abajo
    // mostrando un espacio en blanco arriba. Forzamos el scroll al top
    // (donde el botón vive naturalmente) y refrescamos el popover.
    if (document.querySelector('#tour-assetdetails-print')) {
      steps.push({
        element: '#tour-assetdetails-print',
        popover: {
          title: 'Exportar PDF',
          description: 'Genera un reporte técnico completo del activo.',
          side: 'left',
          align: 'start'
        },
        onHighlighted: (_el, _step, opts) => {
          this.scrollAssetDetailsViewportToTop();
          this.guidedTourHost.refreshPopoverLayout(opts.driver);
        }
      });
    }
    const inst = this.guidedTourHost.startTour(steps, () => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (this.returnToAssetsAfterTour) {
        sessionStorage.removeItem('cerbero:return-to-assets-after-details-tour');
        this.router.navigate(['/menu/assets']);
      }
    });
    if (inst) {
      this.pageTour = inst;
    }
  }

}