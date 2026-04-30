import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { AlmacenConfigService } from '../../services/almacen-config.service';
import { AlmacenConfig } from '../../interfaces/almacen-config.interface';

@Component({
  selector: 'app-transferir-equipo-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="modal-body transferir-modal-body">
      <div class="transferir-box-header">
        <h4 class="modal-title d-flex align-items-center gap-2 mb-0">
          <i class="fas fa-exchange-alt text-dark"></i>
          Transferir Equipo
        </h4>
        <button type="button" class="btn-close" (click)="activeModal.dismiss()"></button>
      </div>

      <div class="equipo-info mb-3 p-3 bg-light rounded">
        <h6 class="mb-1"><strong>{{ item?.name || item?.item?.nombreItem || 'Equipo' }}</strong></h6>
        <small class="text-muted">{{ getTipoEquipo() }}</small>
      </div>

      <form [formGroup]="transferForm" (ngSubmit)="confirmarTransferencia()">
        <div class="mb-3">
          <label class="form-label">Almacén Destino *</label>
          <select 
            class="form-select" 
            formControlName="almacenId"
            (change)="onAlmacenChange()">
            <option value="">Seleccione un almacén...</option>
            <optgroup label="Almacenes Especiales">
              <option [value]="'cementerio'" *ngIf="almacenCementerio">
                Cementerio ({{ almacenCementerio.numero }} - {{ almacenCementerio.nombre }})
              </option>
              <option [value]="'laboratorio'" *ngIf="almacenLaboratorio">
                Almacén Lab ({{ almacenLaboratorio.numero }} - {{ almacenLaboratorio.nombre }})
              </option>
            </optgroup>
            <optgroup label="Almacenes Regulares" *ngIf="almacenesRegulares.length > 0">
              <option *ngFor="let almacen of almacenesRegulares" [value]="almacen.id">
                {{ almacen.numero }} - {{ almacen.nombre }}
              </option>
            </optgroup>
          </select>
          <div *ngIf="transferForm.get('almacenId')?.invalid && transferForm.get('almacenId')?.touched" 
               class="text-danger mt-1 small">
            <i class="fas fa-exclamation-circle me-1"></i>
            Debe seleccionar un almacén destino
          </div>
        </div>

        <!-- Campos de ubicación (estantería, estante, sección) según AlmacenConfig -->
        <div *ngIf="tieneCamposUbicacion()" class="mb-3">
          <div *ngIf="cargandoConfig" class="text-center py-3">
            <div class="spinner-border spinner-border-sm text-primary" role="status">
              <span class="visually-hidden">Cargando configuración...</span>
            </div>
            <small class="d-block mt-2 text-muted">Cargando configuración del almacén...</small>
          </div>
          
          <div *ngIf="!cargandoConfig && almacenConfig" class="row g-3">
            <div [class.col-md-4]="seccionesDisponibles.length > 0" [class.col-md-6]="seccionesDisponibles.length === 0">
              <label class="form-label">Estantería *</label>
              <select 
                class="form-select" 
                formControlName="estanteria">
                <option value="">Seleccione estantería...</option>
                <option *ngFor="let estanteria of estanteriasDisponibles" [value]="estanteria">
                  {{ estanteria }}
                </option>
              </select>
              <div *ngIf="transferForm.get('estanteria')?.invalid && transferForm.get('estanteria')?.touched" 
                   class="text-danger mt-1 small">
                <i class="fas fa-exclamation-circle me-1"></i>
                La estantería es requerida
              </div>
            </div>
            
            <div [class.col-md-4]="seccionesDisponibles.length > 0" [class.col-md-6]="seccionesDisponibles.length === 0">
              <label class="form-label">Estante *</label>
              <select 
                class="form-select" 
                formControlName="estante">
                <option value="">Seleccione estante...</option>
                <option *ngFor="let estante of estantesDisponibles" [value]="estante">
                  Estante {{ estante }}
                </option>
              </select>
              <div *ngIf="transferForm.get('estante')?.invalid && transferForm.get('estante')?.touched" 
                   class="text-danger mt-1 small">
                <i class="fas fa-exclamation-circle me-1"></i>
                El estante es requerido
              </div>
            </div>
            
            <div class="col-md-4" *ngIf="seccionesDisponibles.length > 0">
              <label class="form-label">Sección *</label>
              <select 
                class="form-select" 
                formControlName="seccion">
                <option value="">Seleccione sección...</option>
                <option *ngFor="let seccion of seccionesDisponibles" [value]="seccion">
                  Sección {{ seccion }}
                </option>
              </select>
              <div *ngIf="transferForm.get('seccion')?.invalid && transferForm.get('seccion')?.touched" 
                   class="text-danger mt-1 small">
                <i class="fas fa-exclamation-circle me-1"></i>
                La sección es requerida
              </div>
            </div>
          </div>
          
          <div *ngIf="!cargandoConfig && (esAlmacenRegular() || esAlmacenLaboratorio()) && !almacenConfig" class="alert alert-warning mt-2">
            <i class="fas fa-exclamation-triangle me-2"></i>
            Configure este almacén en <strong>Almacén Config</strong> para indicar estantería y estante.
          </div>
        </div>

        <!-- Campo de observaciones (solo para cementerio y laboratorio) -->
        <div *ngIf="esAlmacenEspecial()" class="mb-3">
          <label class="form-label">Observaciones</label>
          <textarea 
            class="form-control" 
            formControlName="observaciones"
            rows="3"
            placeholder="Ingrese observaciones sobre la transferencia..."
            maxlength="500"></textarea>
          <small class="text-muted">
            {{ transferForm.get('observaciones')?.value?.length || 0 }}/500 caracteres
          </small>
        </div>

        <div class="d-flex justify-content-end gap-2 mt-4">
          <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()">
            <i class="fas fa-times me-1"></i>
            Cancelar
          </button>
          <button 
            type="submit" 
            class="btn btn-transferir" 
            [disabled]="!transferForm.valid || procesando">
            <i class="fas" [ngClass]="procesando ? 'fa-spinner fa-spin' : 'fa-exchange-alt'"></i>
            {{ procesando ? 'Transferiendo...' : 'Transferir' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    :host ::ng-deep .modal-content {
      border-radius: 12px;
      overflow: hidden;
    }
    .transferir-modal-body {
      padding: 1.25rem;
      background: #fff;
      border-radius: 12px;
    }
    .transferir-box-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 10px;
      padding: 0.9rem 1rem;
      margin-bottom: 1rem;
    }
    .btn-close {
      background-color: #ffffff;
      border: 1px solid #ced4da;
      border-radius: 6px;
      padding: 0.35rem;
      opacity: 0.5;
      box-shadow: none;
    }
    .btn-close:hover {
      border-color: #adb5bd;
      opacity: 0.75;
    }
    .btn-close:focus,
    .btn-close:focus-visible {
      box-shadow: none;
      outline: none;
    }
    .modal-title {
      color: #2c3e50;
      font-weight: 600;
    }
    .form-control, .form-select {
      border-radius: 8px;
      border: 1px solid #ced4da;
      padding: 0.75rem;
    }
    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      transition: all 0.3s ease;
    }
    .btn-transferir {
      background: #212529;
      border: none;
      color: #fff;
    }
    .btn-transferir:disabled {
      background: #E2E8F0;
      color: #94A3B8;
    }
    .btn-transferir:not(:disabled):hover {
      background: #000;
      color: #fff;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }
    .btn-secondary {
      background: #6c757d;
      border: none;
    }
    .btn-secondary:hover {
      background: #5a6268;
    }
    .equipo-info {
      border-left: 4px solid #0d6efd;
    }
  `]
})
export class TransferirEquipoModalComponent implements OnInit {
  item: any;
  almacenes: Almacen[] = [];
  almacenCementerio: Almacen | null = null;
  almacenLaboratorio: Almacen | null = null;
  almacenesRegulares: Almacen[] = [];
  transferForm: FormGroup;
  procesando: boolean = false;
  
  // Configuración del almacén seleccionado
  almacenConfig: AlmacenConfig | null = null;
  estanteriasDisponibles: string[] = [];
  estantesDisponibles: string[] = [];
  seccionesDisponibles: string[] = [];
  cargandoConfig: boolean = false;

  constructor(
    public activeModal: NgbActiveModal,
    private formBuilder: FormBuilder,
    private almacenService: AlmacenService,
    private almacenConfigService: AlmacenConfigService
  ) {
    this.transferForm = this.formBuilder.group({
      almacenId: ['', Validators.required],
      estanteria: [''],
      estante: [''],
      seccion: [''],
      observaciones: ['']
    });
  }

  ngOnInit() {
    this.cargarAlmacenes();
  }

  cargarAlmacenes() {
    this.almacenService.getAllAlmacenes().subscribe({
      next: (almacenes: Almacen[]) => {
        this.almacenes = almacenes;
        
        // Identificar almacenes especiales
        this.almacenCementerio = almacenes.find(a => 
          a.numero?.toLowerCase().trim() === 'alm01' || 
          a.numero?.toLowerCase().trim() === 'alm 01' ||
          a.nombre?.toLowerCase().includes('subsuelo')
        ) || null;

        this.almacenLaboratorio = almacenes.find(a => 
          a.numero?.toLowerCase().trim() === 'alm05' || 
          a.numero?.toLowerCase().trim() === 'alm 05' ||
          a.nombre?.toLowerCase().includes('pañol 3')
        ) || null;

        // Filtrar almacenes regulares (excluyendo cementerio y laboratorio)
        const idsEspeciales = [
          this.almacenCementerio?.id,
          this.almacenLaboratorio?.id
        ].filter(id => id !== undefined && id !== null);

        this.almacenesRegulares = almacenes.filter(a => 
          !idsEspeciales.includes(a.id)
        );
      },
      error: (error) => {
        console.error('Error al cargar almacenes:', error);
      }
    });
  }

  onAlmacenChange() {
    const almacenId = this.transferForm.get('almacenId')?.value;
    
    // Limpiar valores anteriores
    this.transferForm.get('estanteria')?.setValue('');
    this.transferForm.get('estante')?.setValue('');
    this.transferForm.get('seccion')?.setValue('');
    this.almacenConfig = null;
    this.estanteriasDisponibles = [];
    this.estantesDisponibles = [];
    this.seccionesDisponibles = [];
    
    const esCementerio = almacenId === 'cementerio';
    const esLaboratorio = almacenId === 'laboratorio';
    const esRegular = !esCementerio && !esLaboratorio && almacenId && !isNaN(Number(almacenId));
    
    // Cargar AlmacenConfig para almacenes que pueden tener ubicación (regular y laboratorio)
    // Los validadores se configuran en cargarConfiguracionAlmacen según si hay config o no
    this.transferForm.get('estanteria')?.clearValidators();
    this.transferForm.get('estante')?.clearValidators();
    this.transferForm.get('seccion')?.clearValidators();
    
    if (esRegular) {
      this.cargarConfiguracionAlmacen(Number(almacenId));
    } else if (esLaboratorio && this.almacenLaboratorio) {
      this.cargarConfiguracionAlmacen(this.almacenLaboratorio.id);
    } else {
      this.transferForm.get('observaciones')?.clearValidators();
    }
    
    this.transferForm.get('estanteria')?.updateValueAndValidity();
    this.transferForm.get('estante')?.updateValueAndValidity();
    this.transferForm.get('seccion')?.updateValueAndValidity();
    this.transferForm.get('observaciones')?.updateValueAndValidity();
  }

  cargarConfiguracionAlmacen(almacenId: number) {
    this.cargandoConfig = true;
    this.almacenConfigService.getConfigByAlmacenId(almacenId).subscribe({
      next: (config: AlmacenConfig | null) => {
        this.cargandoConfig = false;
        if (config) {
          this.almacenConfig = config;
          
          // Estanterías desde config (E1, E2, ...)
          this.estanteriasDisponibles = [];
          for (let i = 1; i <= config.cantidadEstanterias; i++) {
            this.estanteriasDisponibles.push(`E${i}`);
          }
          
          // Estantes desde config (1, 2, 3, ...)
          this.estantesDisponibles = [];
          for (let i = 1; i <= config.cantidadEstantesPorEstanteria; i++) {
            this.estantesDisponibles.push(i.toString());
          }
          
          // Secciones desde config (divisionesEstante); si vacío, no hay sección
          this.seccionesDisponibles = [];
          if (config.divisionesEstante && config.divisionesEstante.trim()) {
            this.seccionesDisponibles = config.divisionesEstante.split(',').map(d => d.trim()).filter(d => d);
          }
          
          this.transferForm.get('seccion')?.clearValidators();
          if (this.seccionesDisponibles.length > 0) {
            this.transferForm.get('seccion')?.setValidators([Validators.required]);
          }
          // Requerir estantería y estante cuando hay config
          this.transferForm.get('estanteria')?.setValidators([Validators.required]);
          this.transferForm.get('estante')?.setValidators([Validators.required]);
        } else {
          this.almacenConfig = null;
          this.estanteriasDisponibles = [];
          this.estantesDisponibles = [];
          this.seccionesDisponibles = [];
          this.transferForm.get('seccion')?.clearValidators();
          // Laboratorio sin config: no requerir ubicación (solo observaciones)
          // Regular sin config: requerir ubicación pero no hay opciones → usuario debe crear config
          if (this.esAlmacenRegular()) {
            this.transferForm.get('estanteria')?.setValidators([Validators.required]);
            this.transferForm.get('estante')?.setValidators([Validators.required]);
          }
        }
        this.transferForm.get('estanteria')?.updateValueAndValidity();
        this.transferForm.get('estante')?.updateValueAndValidity();
        this.transferForm.get('seccion')?.updateValueAndValidity();
      },
      error: (error) => {
        console.error('Error al cargar configuración del almacén:', error);
        this.cargandoConfig = false;
        this.almacenConfig = null;
        this.estanteriasDisponibles = [];
        this.estantesDisponibles = [];
        this.seccionesDisponibles = [];
        this.transferForm.get('estanteria')?.clearValidators();
        this.transferForm.get('estante')?.clearValidators();
        this.transferForm.get('seccion')?.clearValidators();
        this.transferForm.get('estanteria')?.updateValueAndValidity();
        this.transferForm.get('estante')?.updateValueAndValidity();
        this.transferForm.get('seccion')?.updateValueAndValidity();
      }
    });
  }

  esAlmacenRegular(): boolean {
    const almacenId = this.transferForm.get('almacenId')?.value;
    if (!almacenId || almacenId === 'cementerio' || almacenId === 'laboratorio') {
      return false;
    }
    return !isNaN(Number(almacenId));
  }

  esAlmacenLaboratorio(): boolean {
    return this.transferForm.get('almacenId')?.value === 'laboratorio';
  }

  /** Muestra campos de ubicación cuando el almacén seleccionado puede tener AlmacenConfig (regular o laboratorio) */
  tieneCamposUbicacion(): boolean {
    return this.esAlmacenRegular() || this.esAlmacenLaboratorio();
  }

  esAlmacenEspecial(): boolean {
    const almacenId = this.transferForm.get('almacenId')?.value;
    return almacenId === 'cementerio' || almacenId === 'laboratorio';
  }

  getTipoEquipo(): string {
    if (this.item?.tipo) {
      return this.item.tipo === 'EQUIPO' ? 'Equipo' : 'Dispositivo';
    }
    if (this.item?.tipoEquipo) {
      return this.item.tipoEquipo === 'EQUIPO' ? 'Equipo' : 'Dispositivo';
    }
    return 'Equipo';
  }

  confirmarTransferencia() {
    if (this.transferForm.valid) {
      const formData = this.transferForm.value;
      
      // Determinar tipo de almacén PRIMERO
      let tipoAlmacen: string;
      let almacenIdFinal: any;
      
      if (formData.almacenId === 'cementerio' && this.almacenCementerio) {
        almacenIdFinal = this.almacenCementerio.id;
        tipoAlmacen = 'cementerio';
      } else if (formData.almacenId === 'laboratorio' && this.almacenLaboratorio) {
        almacenIdFinal = this.almacenLaboratorio.id;
        tipoAlmacen = 'laboratorio';
      } else {
        // Convertir almacenId a número si es string
        almacenIdFinal = typeof formData.almacenId === 'string' ? parseInt(formData.almacenId, 10) : formData.almacenId;
        tipoAlmacen = 'regular';
      }
      
      // Preparar datos de transferencia
      const transferData: any = {
        almacenId: almacenIdFinal,
        tipoAlmacen: tipoAlmacen,
        observaciones: formData.observaciones || ''
      };

      // Incluir estantería, estante y sección cuando hay AlmacenConfig (regular o laboratorio)
      if ((tipoAlmacen === 'regular' || tipoAlmacen === 'laboratorio') && this.almacenConfig) {
        transferData.estanteria = formData.estanteria || '';
        transferData.estante = formData.estante || '';
        transferData.seccion = formData.seccion != null ? formData.seccion : '';
      }

      this.activeModal.close(transferData);
    }
  }
}


