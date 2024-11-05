import { Component, OnInit } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ActivatedRoute } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { BiosService } from '../services/bios.service';
import { CpuService } from '../services/cpu.service';
import { DeviceService } from '../services/device.service';
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
import { BiosDetailsComponent } from '../bios-details/bios-details.component';
import { CpuDetailsComponent } from '../cpu-details/cpu-details.component';
import { DeviceDetailsComponent } from '../device-details/device-details.component';
import { DriveDetailsComponent } from '../drive-details/drive-details.component';
import { MemoryDetailsComponent } from '../memory-details/memory-details.component';
import { MonitorDetailsComponent } from '../monitor-details/monitor-details.component';
import { StorageDetailsComponent } from '../storage-details/storage-details.component';
import { VideoDetailsComponent } from '../video-details/video-details.component';
import { UbicacionDetailsComponent } from '../ubicacion-details/ubicacion-details.component';
import { UbicacionEquipoService } from '../services/ubicacion-equipo.service';

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
    AssetEditModalComponent,
    BiosDetailsComponent,
    CpuDetailsComponent,
    DeviceDetailsComponent,
    DriveDetailsComponent,
    MemoryDetailsComponent,
    MonitorDetailsComponent,
    StorageDetailsComponent,
    VideoDetailsComponent,
    UbicacionDetailsComponent
  ],
  providers: [
    BiosService,
    CpuService,
    DeviceService,
    DriveService,
    MemoryService,
    MonitorService,
    StorageService,
    VideoService,
    UbicacionEquipoService
  ],
  templateUrl: './assetdetails.component.html',
  styleUrls: ['./assetdetails.component.css']
})
export class AssetdetailsComponent implements OnInit {
  asset: Asset | null = null;
  activeTab: string = 'general';
  componentData: any = {};

  constructor(
    private route: ActivatedRoute,
    private hardwareService: HardwareService,
    private biosService: BiosService,
    private cpuService: CpuService,
    private deviceService: DeviceService,
    private driveService: DriveService,
    private memoryService: MemoryService,
    private monitorService: MonitorService,
    private storageService: StorageService,
    private videoService: VideoService,
    private location: Location,
    private router: Router,
    private modalService: NgbModal
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
              ['bios', 'cpu', 'device', 'drive', 'memory', 'monitor', 'storage', 'video'].forEach(tab => {
                this.loadComponentData(tab);
              });
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
      case 'device':
        service = this.deviceService;
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
      default:
        return;
    }

    if (service && service[method]) {
      service[method](this.asset.id).subscribe(
        (data: any) => {
          if (component === 'bios' || component === 'cpu' || component === 'device') {
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
    if (!this.componentData[this.activeTab] && this.activeTab !== 'general') {
      console.log('Los datos aún no están cargados. Por favor, espere...');
      return;
    }

    const doc = new jsPDF();
    doc.text(`Detalles del Asset - ${this.activeTab.toUpperCase()}`, 14, 15);

    let tableData: any[][] = [];

    switch (this.activeTab) {
      case 'general':
        tableData = this.prepareGeneralData();
        break;
      case 'bios':
        tableData = this.prepareBiosData();
        break;
      case 'cpu':
        tableData = this.prepareCpuData();
        break;
      case 'device':
        tableData = this.prepareDeviceData();
        break;
      case 'drive':
        tableData = this.prepareDriveData();
        break;
      case 'memory':
        tableData = this.prepareMemoryData();
        break;
      case 'monitor':
        tableData = this.prepareMonitorData();
        break;
      case 'storage':
        tableData = this.prepareStorageData();
        break;
      case 'video':
        tableData = this.prepareVideoData();
        break;
    }

    console.log('Datos para el PDF:', tableData);

    // Generar la tabla
    autoTable(doc, {
      startY: 30,
      head: [['Característica', 'Valor']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [65, 161, 175], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      margin: { top: 30 }
    });

    // Añadir pie de página
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    // Guardar el PDF
    doc.save(`Asset_${this.asset?.name}_${this.activeTab}.pdf`);
  }

  prepareGeneralData(): any[][] {
    return [
      ['ID', this.asset?.id?.toString() ?? ''],
      ['Device ID', this.asset?.deviceId ?? ''],
      ['Nombre', this.asset?.name ?? ''],
      ['Grupo de trabajo', this.asset?.workgroup ?? ''],
      ['Sistema Operativo', this.asset?.osName ?? ''],
      ['Versión SO', this.asset?.osVersion ?? ''],
      ['Procesadores', this.asset?.processors.toString() ?? ''],
      ['Tipo de Procesador', this.asset?.processorType ?? ''],
      ['Núcleos', this.asset?.processorN.toString() ?? ''],
      ['Memoria', `${this.asset?.memory} MB`],
      ['Swap', `${this.asset?.swap} MB`],
      ['Dirección IP', this.asset?.ipAddr ?? ''],
      ['IP Source', this.asset?.ipSrc ?? ''],
      ['DNS', this.asset?.dns ?? ''],
      ['Gateway por defecto', this.asset?.defaultGateway ?? ''],
      ['Tipo', this.asset?.type.toString() ?? ''],
      ['Descripción', this.asset?.description ?? ''],
      ['Compañía Windows', this.asset?.winCompany ?? ''],
      ['Propietario Windows', this.asset?.winOwner ?? ''],
      ['ID de Producto Windows', this.asset?.winProdId ?? ''],
      ['Clave de Producto Windows', this.asset?.winProdKey ?? ''],
      ['Último escaneo', new Date(this.asset?.lastDate ?? 0).toLocaleString()],
      ['Primer inventariado', new Date(this.asset?.lastCome ?? 0).toLocaleString()],
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

  prepareDeviceData(): any[][] {
    if (!this.componentData.device) {
      return [['No hay datos de dispositivo disponibles', '']];
    }

    const device = this.componentData.device;
    return [
      ['ID', device.id?.toString() || 'N/A'],
      ['ID de Hardware', device.hardwareId?.toString() || 'N/A'],
      ['Valor Entero', device.ivalue?.toString() || 'N/A'],
      ['Nombre', device.name || 'N/A'],
      ['Valor de Texto', device.tvalue || 'N/A'],
      ['Comentarios', device.comments || 'N/A']
    ];
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
}