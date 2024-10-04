import { Component, OnInit } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ActivatedRoute } from '@angular/router';
import { HardwareService } from '../services/hardware.service';
import { Location, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { AssetEditModalComponent } from '../asset-edit-modal/asset-edit-modal.component';

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
  imports: [CommonModule, NgbModalModule, AssetEditModalComponent],
  templateUrl: './assetdetails.component.html',
  styleUrls: ['./assetdetails.component.css']
})
export class AssetdetailsComponent implements OnInit {
  asset: Asset | null = null;

  constructor(
    private route: ActivatedRoute,
    private hardwareService: HardwareService,
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
            (result: any) => { // Cambiado de Asset a any temporalmente
              // Parsear las fechas
              result.lastDate = result.lastDate ? new Date(result.lastDate) : null;
              result.lastCome = result.lastCome ? new Date(result.lastCome) : null;
              this.asset = result as Asset;
              console.log('Asset obtenido:', this.asset);
            },
            (error) => {
              console.error('Error al obtener el asset:', error);
              // Handle the error, e.g., redirect to an error page
              // this.router.navigate(['/error']);
            }
          );
        } else {
          console.error('ID inválido:', idParam);
          // Handle invalid ID, e.g., redirect to an error page
          // this.router.navigate(['/error']);
        }
      }
    });
  }

  exportarAPdf(): void {
    if (!this.asset) return;

    const doc = new jsPDF();

    // Añadir título
    doc.setFontSize(18);
    doc.text('Detalles del Asset', 14, 22);

    // Preparar los datos para la tabla
    const tableData = [
      ['ID', this.asset.id.toString()],
      ['Device ID', this.asset.deviceId],
      ['Nombre', this.asset.name],
      ['Grupo de trabajo', this.asset.workgroup],
      ['Sistema Operativo', this.asset.osName],
      ['Versión SO', this.asset.osVersion],
      ['Procesadores', this.asset.processors.toString()],
      ['Tipo de Procesador', this.asset.processorType],
      ['Núcleos', this.asset.processorN.toString()],
      ['Memoria', `${this.asset.memory} MB`],
      ['Swap', `${this.asset.swap} MB`],
      ['Dirección IP', this.asset.ipAddr],
      ['IP Source', this.asset.ipSrc],
      ['DNS', this.asset.dns],
      ['Gateway por defecto', this.asset.defaultGateway],
      ['Tipo', this.asset.type.toString()],
      ['Descripción', this.asset.description],
      ['Compañía Windows', this.asset.winCompany],
      ['Propietario Windows', this.asset.winOwner],
      ['ID de Producto Windows', this.asset.winProdId],
      ['Clave de Producto Windows', this.asset.winProdKey],
      ['Último escaneo', new Date(this.asset.lastDate).toLocaleString()],
      ['Primer inventariado', new Date(this.asset.lastCome).toLocaleString()],
    ];

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
    doc.save(`Asset_${this.asset.name}.pdf`);
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
        // Aquí puedes llamar a un servicio para actualizar el asset en el backend
        console.log('Asset actualizado:', this.asset);
      }
    }, (reason) => {
      console.log('Modal cerrado sin guardar cambios');
    });
  }

  // Se ha eliminado la función eliminarAsset()

  // ... resto del código ...
}
