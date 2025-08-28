import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
import { UbicacionDTO } from '../interfaces/ubicacion.interface';
import { LocationSelectorModalComponent } from '../components/location-selector-modal/location-selector-modal.component';
import { AssetLocationPickerModalComponent } from '../components/asset-location-picker-modal/asset-location-picker-modal.component';
import { BiosDetailsComponent } from '../bios-details/bios-details.component';
import { PermissionsService } from '../services/permissions.service';
import { CpuDetailsComponent } from '../cpu-details/cpu-details.component';
import { DriveDetailsComponent } from '../drive-details/drive-details.component';
import { MemoryDetailsComponent } from '../memory-details/memory-details.component';
import { MonitorDetailsComponent } from '../monitor-details/monitor-details.component';
import { StorageDetailsComponent } from '../storage-details/storage-details.component';
import { VideoDetailsComponent } from '../video-details/video-details.component';
import { SoftwareDetailsComponent } from '../software-details/software-details.component';

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
export class AssetdetailsComponent implements OnInit {
  asset: Asset | null = null;
  activeTab: string = 'general';
  componentData: any = {};
  ubicacionActual?: UbicacionDTO;
  loading: boolean = false;
  error: string | null = null;
  ubicacionesDisponibles: UbicacionDTO[] = [];

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
    public permissionsService: PermissionsService
  ) { }

  ngOnInit(): void {
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
              console.log('Asset obtenido:', this.asset);
              
              // Pre-cargar datos de todas las pestañas
              ['bios', 'cpu', 'drive', 'memory', 'monitor', 'storage', 'video'].forEach(tab => {
                this.loadComponentData(tab);
              });

              if (this.asset?.id) {
                this.cargarUbicacion();
                

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

  loadComponentData(component: string): void {
    if (!this.asset) return;

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
      service[method](this.asset.id).subscribe(
        (data: any) => {
          if (component === 'bios' || component === 'cpu') {
            // Asegurarse de que los datos sean un objeto único
            this.componentData[component] = Array.isArray(data) ? data[0] : data;
          } else {
            // Para otros componentes, mantener el comportamiento actual
            this.componentData[component] = Array.isArray(data) ? data : [data];
          }
          console.log(`Datos de ${component} cargados:`, this.componentData[component]);
          

        },
        (error: unknown) => {
          console.error(`Error al cargar datos de ${component}:`, error);
          this.componentData[component] = null;
        }
      );
    } else {
      console.error(`Método ${method} no encontrado en el servicio para ${component}`);
    }
  }

  exportarAPdf(): void {
    // Verificar que todos los datos estén cargados
    if (!this.asset) {
      console.log('No hay datos del asset disponibles');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let currentY = 20;
    
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
        },
        didDrawPage: function(data) {
          // Agregar pie de página en cada página
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            pageWidth - 20,
            pageHeight - 10,
            { align: 'right' }
          );
          
          // Agregar línea divisoria en el pie de página
          doc.setDrawColor(200);
          doc.line(
            14,
            pageHeight - 20,
            pageWidth - 14,
            pageHeight - 20
          );
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

    // Guardar el PDF con nombre descriptivo
    const fileName = `${this.asset.name}_REPORTE_COMPLETO_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  prepareGeneralData(): any[][] {
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
      ['Tipo', this.asset?.type?.toString() ?? 'N/A'],
      ['Descripción', this.asset?.description ?? 'N/A'],
      ['Compañía Windows', this.asset?.winCompany ?? 'N/A'],
      ['Propietario Windows', this.asset?.winOwner ?? 'N/A'],
      ['ID de Producto Windows', this.asset?.winProdId ?? 'N/A'],
      ['Clave de Producto Windows', this.asset?.winProdKey ?? 'N/A'],
      ['Último escaneo', this.asset?.lastDate ? new Date(this.asset.lastDate).toLocaleString() : 'N/A'],
      ['Primer inventariado', this.asset?.lastCome ? new Date(this.asset.lastCome).toLocaleString() : 'N/A'],
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

    console.log('Datos de CPU preparados para PDF:', data);
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
        console.log('Asset actualizado:', this.asset);
      }
    }, (reason) => {
      console.log('Modal cerrado sin guardar cambios');
    });
  }

  cargarUbicacion() {
    if (this.asset?.id) {
      this.loading = true;
      this.error = null;
      this.ubicacionesService.getUbicacionEquipo(this.asset.id).subscribe({
        next: (ubicacion) => {
          this.ubicacionActual = ubicacion;
          this.loading = false;
        },
        error: (error: any) => {
          if (error.message?.includes('no encontrada')) {
            this.ubicacionActual = undefined;
            this.error = null;
          } else {
            console.error('Error al cargar ubicación:', error);
            this.error = 'Error al cargar la ubicación. Por favor, intente nuevamente.';
          }
          this.loading = false;
        }
      });
    }
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

        console.log('Datos a enviar para actualización:', ubicacionData);

        this.ubicacionesService.actualizarUbicacionEquipo(this.asset.id, ubicacionData).subscribe({
          next: (response) => {
            console.log('Ubicación actualizada:', response);
            this.cargarUbicacion();
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

        console.log('Datos a enviar para creación:', ubicacionData);

        this.ubicacionesService.crearUbicacionEquipo(ubicacionData).subscribe({
          next: (response) => {
            console.log('Ubicación creada:', response);
            this.cargarUbicacion();
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

              // Logs de depuración
              console.log('Ubicación seleccionada:', this.ubicacionActual);

              this.actualizarUbicacion();
            }
          },
          () => {
            console.log('Modal cerrado sin selección');
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
          console.log('Ubicación asignada:', result);
          this.ubicacionActual = result;
          this.cargarUbicacion();
        }
      },
      (reason) => {
        console.log('Modal cerrado por:', reason);
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

}