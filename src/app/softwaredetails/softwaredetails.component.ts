import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SwService } from '../sw.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Location, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { SoftwareEditModalComponent } from '../software-edit-modal/software-edit-modal.component';

interface Software {
  nroSoftware: number;
  nombre: string;
  version: string;
  licencia: string;
  fechaInstalacion: string;
  nroProveedor: number;
}

@Component({
  selector: 'app-softwaredetails',
  standalone: true,
  imports: [CommonModule, NgbModalModule, SoftwareEditModalComponent],
  templateUrl: './softwaredetails.component.html',
  styleUrls: ['./softwaredetails.component.css']
})
export class SoftwaredetailsComponent implements OnInit {
  software: Software | null = null;

  constructor(
    private route: ActivatedRoute,
    private softwareService: SwService,
    private location: Location,
    private router: Router,
    private modalService: NgbModal
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.software = this.softwareService.getSoftware(id);
      }
    });
  }

  exportarAPdf(): void {
    if (!this.software) return;

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Detalles del Software', 14, 22);

    const tableData = [
      ['Nombre', this.software.nombre],
      ['Versión', this.software.version],
      ['Proveedor', this.software.licencia],
      ['Fecha de Instalación', this.software.fechaInstalacion],
      // ... otros campos
    ];

    autoTable(doc, {
      startY: 30,
      head: [['Característica', 'Valor']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [65, 161, 175], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      margin: { top: 30 }
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    doc.save(`Software_${this.software.nombre}.pdf`);
  }

  volver(): void {
    this.location.back();
  }

  editarSoftware(): void {
    const modalRef = this.modalService.open(SoftwareEditModalComponent, { size: 'lg' });
    modalRef.componentInstance.software = { ...this.software };
    modalRef.result.then((result) => {
      if (result) {
        this.software = result;
        console.log('Software actualizado:', this.software);
      }
    }, (reason) => {
      console.log('Modal cerrado sin guardar cambios');
    });
  }
}
