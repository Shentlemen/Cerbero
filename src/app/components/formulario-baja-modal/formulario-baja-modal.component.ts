import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

export interface DatosBaja {
  hardwareId: number;
  nombreEquipo: string;
  descripcion?: string;
}

@Component({
  selector: 'app-formulario-baja-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './formulario-baja-modal.component.html',
  styleUrls: ['./formulario-baja-modal.component.css']
})
export class FormularioBajaModalComponent implements OnInit {
  @Input() datos!: DatosBaja;

  // Campos del formulario (precargados con valores por defecto)
  fechaContable = { dia: '', mes: '', anio: '' };
  servicio: string = '301013';
  nombreServicio: string = 'Administración Tecnológica GTI';
  centroCostos: string = '301008';
  
  // Activo fijo
  numeroActivoFijo: string = '';
  descripcionBien: string = '';
  
  // Motivos de baja (checkboxes izquierda) - Chatarra precargado
  motivoChatarra: boolean = true;
  motivoDonacion: boolean = false;
  motivoRobo: boolean = false;
  motivoPerdida: boolean = false;
  
  // Justificaciones (checkboxes derecha)
  justInformeTecnico: boolean = false;
  justResolucionDirectorio: boolean = false;
  justDenunciaPolicial: boolean = false;
  justNotaExplicacion: boolean = false;
  
  // Fecha firma responsable
  fechaFirma = { dia: '', mes: '', anio: '' };

  // Observaciones opcionales (esto es lo que se guarda en el cementerio)
  observaciones: string = '';

  constructor(public activeModal: NgbActiveModal) {}

  ngOnInit(): void {
    // Pre-llenar con datos del equipo
    if (this.datos) {
      // Número de activo fijo queda vacío para llenarlo manualmente
      this.numeroActivoFijo = '';
      // Descripción: "Equipo Numero [nombre]"
      this.descripcionBien = 'Equipo Numero ' + this.datos.nombreEquipo;
    }
    
    // Pre-llenar fecha actual
    const hoy = new Date();
    this.fechaContable = {
      dia: hoy.getDate().toString().padStart(2, '0'),
      mes: (hoy.getMonth() + 1).toString().padStart(2, '0'),
      anio: hoy.getFullYear().toString()
    };
    this.fechaFirma = { ...this.fechaContable };
  }

  imprimir(): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita las ventanas emergentes para imprimir.');
      return;
    }

    // Generar el HTML con los valores actuales del formulario
    const htmlContent = this.generarHtmlFormulario();

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Esperar a que cargue la imagen del logo
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }

  private generarHtmlFormulario(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Formulario de Baja - F-890</title>
        <style>
          @page { size: A4; margin: 10mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: white; }
          .formulario-container { width: 100%; max-width: 210mm; margin: 0 auto; padding: 15px; border: 2px solid #1a7a8c; }
          .header { display: flex; align-items: flex-start; margin-bottom: 5px; border-bottom: 2px solid #d4a800; padding-bottom: 10px; }
          .logo-container { width: 80px; margin-right: 15px; }
          .logo-container img { width: 100%; height: auto; }
          .header-content { flex: 1; }
          .titulo-principal { font-size: 16px; font-weight: bold; color: #1a7a8c; margin-bottom: 5px; }
          .subtitulo { font-size: 9px; color: #333; }
          .fecha-contable-container { text-align: right; }
          .fecha-contable-label { font-size: 10px; font-weight: bold; margin-bottom: 3px; }
          .fecha-boxes { display: flex; gap: 3px; justify-content: flex-end; }
          .fecha-box { width: 35px; height: 22px; border: 1px solid #333; text-align: center; line-height: 22px; font-size: 11px; }
          .fecha-box-year { width: 50px; }
          .seccion { margin: 12px 0; }
          .seccion-titulo { font-weight: bold; font-size: 11px; margin-bottom: 8px; text-align: center; background: #f5f5f5; padding: 5px; border: 1px solid #ccc; }
          .row-campos { display: flex; gap: 15px; margin-bottom: 10px; }
          .campo { display: flex; flex-direction: column; }
          .campo-label { font-size: 9px; font-weight: bold; margin-bottom: 3px; }
          .campo-value { border: 1px solid #333; border-bottom: 2px solid #d4a800; padding: 5px 8px; min-height: 24px; font-size: 11px; background: white; }
          .campo-flex-1 { flex: 1; }
          .campo-flex-2 { flex: 2; }
          .campo-flex-3 { flex: 3; }
          .tabla-activos { width: 100%; border-collapse: collapse; margin: 10px 0; }
          .tabla-activos th, .tabla-activos td { border: 1px solid #333; padding: 6px; text-align: left; font-size: 11px; }
          .tabla-activos th { background: #f0f0f0; font-weight: bold; }
          .tabla-activos td { border-bottom: 2px solid #d4a800; }
          .motivos-container { display: flex; gap: 30px; margin: 10px 0; }
          .motivos-columna { flex: 1; }
          .motivos-columna.justificaciones { flex: 2; }
          .motivo-item { display: flex; align-items: center; gap: 10px; margin: 8px 0; font-size: 11px; }
          .motivo-item-linea { display: flex; align-items: center; gap: 10px; margin: 8px 0; font-size: 11px; }
          .motivo-texto { min-width: 170px; }
          .linea-firma-pequena { flex: 1; border-bottom: 1px solid #333; min-width: 50px; height: 16px; }
          .checkbox-box { width: 18px; height: 18px; border: 1px solid #333; display: inline-flex; align-items: center; justify-content: center; background: white; font-weight: bold; }
          .firma-container { margin: 20px 0; text-align: center; }
          .firma-label { font-size: 11px; font-weight: bold; margin-bottom: 5px; }
          .firma-linea { border-bottom: 1px solid #333; height: 50px; margin: 10px auto; max-width: 350px; }
          .fecha-firma-row { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
          .footer-codigo { text-align: right; font-size: 9px; margin-top: 15px; color: #666; }
          .seccion-contabilidad { border: 1px solid #333; padding: 15px; margin-top: 20px; }
          .recibido-row { display: flex; gap: 20px; margin: 12px 0; align-items: flex-start; }
          .recibido-izquierda { min-width: 140px; }
          .recibido-label-text { font-size: 11px; font-weight: bold; display: block; margin-bottom: 8px; }
          .cuadrados-boxes { display: flex; gap: 5px; }
          .cuadrado-box { width: 22px; height: 20px; border: 1px solid #333; border-bottom: 2px solid #d4a800; }
          .recibido-firma-container { flex: 1; }
          .firma-label-small { font-size: 10px; font-weight: bold; margin-bottom: 5px; }
          .recibido-firma { border-bottom: 1px solid #333; min-height: 35px; }
        </style>
      </head>
      <body>
        <div class="formulario-container">
          <!-- HEADER -->
          <div class="header">
            <div class="logo-container">
              <img src="assets/images/logo-ose.png" alt="Logo OSE">
            </div>
            <div class="header-content">
              <div class="titulo-principal">BAJA DE BIENES DE<br>PROPIEDAD, PLANTA Y EQUIPO</div>
              <div class="subtitulo">
                <strong>GERENCIA FINANCIERO Y CONTABLE</strong><br>
                CONTABILIDAD DEL ACTIVO FIJO Y COSTOS
              </div>
            </div>
            <div class="fecha-contable-container">
              <div class="fecha-contable-label">FECHA CONTABLE</div>
              <div class="fecha-boxes">
                <div class="fecha-box">${this.fechaContable.dia}</div>
                <div class="fecha-box">${this.fechaContable.mes}</div>
                <div class="fecha-box fecha-box-year">${this.fechaContable.anio}</div>
              </div>
            </div>
          </div>

          <!-- SECCIÓN SERVICIO -->
          <div class="seccion">
            <div class="row-campos">
              <div class="campo campo-flex-1">
                <div class="campo-label">SERVICIO</div>
                <div class="campo-value">${this.servicio}</div>
              </div>
              <div class="campo campo-flex-3">
                <div class="campo-label">NOMBRE DEL SERVICIO</div>
                <div class="campo-value">${this.nombreServicio}</div>
              </div>
              <div class="campo campo-flex-1">
                <div class="campo-label">CENTRO DE COSTOS</div>
                <div class="campo-value">${this.centroCostos}</div>
              </div>
            </div>
          </div>

          <!-- SECCIÓN ACTIVO FIJO -->
          <div class="seccion">
            <div class="seccion-titulo">ACTIVO FIJO A DAR DE BAJA</div>
            <table class="tabla-activos">
              <thead>
                <tr>
                  <th style="width: 150px;">Nº DE ACTIVO FIJO</th>
                  <th>DESCRIPCIÓN DEL BIEN</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${this.numeroActivoFijo}</td>
                  <td>${this.descripcionBien}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- SECCIÓN MOTIVOS -->
          <div class="seccion">
            <div class="seccion-titulo">TILDAR EL MOTIVO DE LA BAJA, Y SI SE ADJUNTA JUSTIFICACIÓN</div>
            <div class="motivos-container">
              <div class="motivos-columna">
                <div class="motivo-item">
                  <div class="checkbox-box">${this.motivoChatarra ? '✓' : ''}</div>
                  <span>CHATARRA</span>
                </div>
                <div class="motivo-item">
                  <div class="checkbox-box">${this.motivoDonacion ? '✓' : ''}</div>
                  <span>DONACIÓN</span>
                </div>
                <div class="motivo-item">
                  <div class="checkbox-box">${this.motivoRobo ? '✓' : ''}</div>
                  <span>ROBO</span>
                </div>
                <div class="motivo-item">
                  <div class="checkbox-box">${this.motivoPerdida ? '✓' : ''}</div>
                  <span>PÉRDIDA</span>
                </div>
              </div>
              <div class="motivos-columna justificaciones">
                <div class="motivo-item-linea">
                  <div class="checkbox-box">${this.justInformeTecnico ? '✓' : ''}</div>
                  <span class="motivo-texto">INFORME TÉCNICO</span>
                  <div class="linea-firma-pequena"></div>
                </div>
                <div class="motivo-item-linea">
                  <div class="checkbox-box">${this.justResolucionDirectorio ? '✓' : ''}</div>
                  <span class="motivo-texto">RESOLUCIÓN DE DIRECTORIO</span>
                  <div class="linea-firma-pequena"></div>
                </div>
                <div class="motivo-item-linea">
                  <div class="checkbox-box">${this.justDenunciaPolicial ? '✓' : ''}</div>
                  <span class="motivo-texto">DENUNCIA POLICIAL</span>
                  <div class="linea-firma-pequena"></div>
                </div>
                <div class="motivo-item-linea">
                  <div class="checkbox-box">${this.justNotaExplicacion ? '✓' : ''}</div>
                  <span class="motivo-texto">NOTA CON EXPLICACIÓN</span>
                  <div class="linea-firma-pequena"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- SECCIÓN FIRMA RESPONSABLE -->
          <div class="seccion">
            <div class="firma-container">
              <div class="firma-label">FIRMA RESPONSABLE</div>
              <div class="fecha-firma-row">
                <span>FECHA</span>
                <div class="fecha-box">${this.fechaFirma.dia}</div>
                <div class="fecha-box">${this.fechaFirma.mes}</div>
                <div class="fecha-box fecha-box-year">${this.fechaFirma.anio}</div>
              </div>
              <div class="firma-linea"></div>
            </div>
            <div class="firma-container">
              <div class="firma-label">CONTRAFIRMA</div>
              <div class="firma-linea"></div>
            </div>
          </div>

          <!-- SECCIÓN CONTABILIDAD -->
          <div class="seccion-contabilidad">
            <div class="seccion-titulo">CONTABILIDAD DEL ACTIVO FIJO Y COSTOS</div>
            <div class="recibido-row">
              <div class="recibido-izquierda">
                <span class="recibido-label-text">RECIBIDO</span>
                <div class="cuadrados-boxes">
                  <div class="cuadrado-box"></div>
                  <div class="cuadrado-box"></div>
                  <div class="cuadrado-box"></div>
                </div>
              </div>
              <div class="recibido-firma-container">
                <div class="firma-label-small">FIRMA RESPONSABLE</div>
                <div class="recibido-firma"></div>
              </div>
            </div>
            <div class="recibido-row">
              <div class="recibido-izquierda">
                <span class="recibido-label-text">PROCESADO SISTEMA</span>
                <div class="cuadrados-boxes">
                  <div class="cuadrado-box"></div>
                  <div class="cuadrado-box"></div>
                  <div class="cuadrado-box"></div>
                </div>
              </div>
              <div class="recibido-firma-container">
                <div class="firma-label-small">FIRMA RESPONSABLE</div>
                <div class="recibido-firma"></div>
              </div>
            </div>
          </div>

          <!-- CÓDIGO DEL FORMULARIO -->
          <div class="footer-codigo">F-890 Y G.D.</div>
        </div>
      </body>
      </html>
    `;
  }

  cerrar(): void {
    this.activeModal.dismiss();
  }

  confirmarYCerrar(): void {
    // Devolver los datos del formulario para procesar la baja
    const datosFormulario = {
      fechaContable: this.fechaContable,
      servicio: this.servicio,
      nombreServicio: this.nombreServicio,
      centroCostos: this.centroCostos,
      numeroActivoFijo: this.numeroActivoFijo,
      descripcionBien: this.descripcionBien,
      motivos: {
        chatarra: this.motivoChatarra,
        donacion: this.motivoDonacion,
        robo: this.motivoRobo,
        perdida: this.motivoPerdida
      },
      justificaciones: {
        informeTecnico: this.justInformeTecnico,
        resolucionDirectorio: this.justResolucionDirectorio,
        denunciaPolicial: this.justDenunciaPolicial,
        notaExplicacion: this.justNotaExplicacion
      },
      fechaFirma: this.fechaFirma,
      observaciones: this.observaciones.trim()
    };
    
    this.activeModal.close(datosFormulario);
  }
}

