import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HwService } from '../hw.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Location, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { AssetEditModalComponent } from '../asset-edit-modal/asset-edit-modal.component';

interface Asset {
  NAME: string; // Cambiado de nroEquipo a NAME
  tipoEquipo: string;
  marca: string;
  modelo: string;
  nroSerie: string;
  disco: string;
  memoria: string;
  tarjetaVideo: string;
  nroSerieTeclado: string;
  nroSerieMouse: string;
  propietario: string;
  OSNAME: string;
  IPADDR: string;
  TYPE: string;
  // ... otros campos que puedas tener
}

@Component({
  selector: 'app-assetdetails',
  standalone: true,  // Añade esta línea
  imports: [CommonModule, NgbModalModule, AssetEditModalComponent],  // Añade NgbModal y AssetEditModalComponent a los imports
  templateUrl: './assetdetails.component.html',
  styleUrls: ['./assetdetails.component.css']
})
export class AssetdetailsComponent implements OnInit {
  asset: Asset | null = null;

  constructor(
    private route: ActivatedRoute,
    private hwService: HwService,
    private location: Location,
    private router: Router,
    private modalService: NgbModal
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      console.log('ID recibido:', id);
      if (id) {
        this.asset = this.hwService.getHardwareById(id);
        console.log('Asset obtenido:', this.asset);
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
      ['Nombre del Equipo', this.asset.NAME], // Cambiado de nroEquipo a NAME
      ['Tipo de Equipo', this.asset.tipoEquipo],
      ['Marca', this.asset.marca],
      ['Modelo', this.asset.modelo],
      ['Número de Serie', this.asset.nroSerie],
      ['Disco', this.asset.disco],
      ['Memoria', this.asset.memoria],
      ['Tarjeta de Video', this.asset.tarjetaVideo],
      ['Número de Serie del Teclado', this.asset.nroSerieTeclado],
      ['Número de Serie del Mouse', this.asset.nroSerieMouse],
      ['Propietario', this.asset.propietario],
      ['Sistema Operativo', this.asset.OSNAME],
      ['Dirección IP', this.asset.IPADDR],
      ['Tipo', this.asset.TYPE]
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
    doc.save(`Asset_${this.asset.NAME}.pdf`); // Cambiado de nroEquipo a NAME
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
