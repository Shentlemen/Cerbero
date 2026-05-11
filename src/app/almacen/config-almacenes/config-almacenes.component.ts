import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { AlmacenConfigService } from '../../services/almacen-config.service';
import { AlmacenConfig, AlmacenEstanteriaDef, estanteriasOrdenadas } from '../../interfaces/almacen-config.interface';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';
import { GuidedTourHostService } from '../../services/guided-tour-host.service';
import type { Driver } from 'driver.js';

@Component({
  selector: 'app-config-almacenes',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule, NotificationContainerComponent],
  templateUrl: './config-almacenes.component.html',
  styleUrls: ['./config-almacenes.component.css']
})
export class ConfigAlmacenesComponent implements OnInit, OnDestroy {
  almacenes: Almacen[] = [];
  configs: AlmacenConfig[] = [];
  almacenConfigForm: FormGroup;
  modoEdicionConfig: boolean = false;
  configSeleccionada: AlmacenConfig | null = null;
  loadingConfigs: boolean = false;

  private pageTour?: Driver;

  /** Validación y errores API en el modal nueva/editar configuración (pie del modal). */
  configModalValidacion: { titulo: string; lineas: string[]; esError: boolean } | null = null;

  /** Auxiliar: dar de alta varias estanterías con la misma forma */
  variasCantidad: number = 2;
  variasNumeroInicial: number = 1;
  variasEstantes: number = 3;
  variasDivisiones: string = 'A,B,C';

  constructor(
    private almacenService: AlmacenService,
    private almacenConfigService: AlmacenConfigService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    public permissionsService: PermissionsService,
    private notificationService: NotificationService,
    private guidedTourHost: GuidedTourHostService
  ) {
    this.almacenConfigForm = this.fb.group({
      almacenId: ['', Validators.required],
      nombre: [''],
      estanteriasRows: this.fb.array([]),
    });

    this.almacenConfigForm.valueChanges.subscribe(() => this.limpiarFeedbackConfigModal());
    this.estanteriasRows.valueChanges.subscribe(() => this.limpiarFeedbackConfigModal());
  }

  limpiarFeedbackConfigModal(): void {
    this.configModalValidacion = null;
  }

  private mensajeErrorHttp(error: unknown): string {
    const e = error as { error?: string | { message?: string }; message?: string };
    const body = e?.error;
    if (typeof body === 'string') {
      return body;
    }
    if (body && typeof body === 'object' && typeof body.message === 'string') {
      return body.message;
    }
    if (typeof e?.message === 'string') {
      return e.message;
    }
    return 'Ocurrió un error inesperado.';
  }

  private armarLineasValidacionConfigAlmacen(): string[] {
    const lineas: string[] = [];
    const aid = this.almacenConfigForm.get('almacenId');
    if (aid?.invalid) {
      lineas.push('Seleccioná un almacén.');
    }
    this.estanteriasRows.controls.forEach((ctrl, i) => {
      const g = ctrl as FormGroup;
      const cod = g.get('codigo');
      const est = g.get('cantidadEstantes');
      const div = g.get('divisionesEstante');
      const n = i + 1;
      if (cod?.hasError('required')) {
        lineas.push(`Fila ${n}: el código de estantería es obligatorio.`);
      }
      if (cod?.hasError('maxlength')) {
        lineas.push(`Fila ${n}: el código no puede superar 32 caracteres.`);
      }
      if (est?.hasError('required')) {
        lineas.push(`Fila ${n}: la cantidad de estantes es obligatoria.`);
      }
      if (est?.hasError('min')) {
        lineas.push(`Fila ${n}: la cantidad de estantes debe ser al menos 1.`);
      }
      if (div?.hasError('required')) {
        lineas.push(`Fila ${n}: los sectores son obligatorios.`);
      }
    });
    return lineas;
  }

  get estanteriasRows(): FormArray {
    return this.almacenConfigForm.get('estanteriasRows') as FormArray;
  }

  ngOnInit(): void {
    this.cargarAlmacenesYConfigs();
  }

  ngOnDestroy(): void {
    this.pageTour?.destroy();
  }

  cargarAlmacenesYConfigs(): void {
    this.loadingConfigs = true;
    this.almacenService.getAllAlmacenes().subscribe({
      next: (almacenes) => {
        this.almacenes = almacenes;
        this.cargarConfigs();
      },
      error: () => {
        this.loadingConfigs = false;
        this.notificationService.showError('Error', 'No se pudieron cargar los almacenes');
      }
    });
  }

  cargarConfigs(): void {
    this.almacenConfigService.getAllConfigs().subscribe({
      next: (configs) => {
        this.configs = configs;
        this.loadingConfigs = false;
      },
      error: () => {
        this.loadingConfigs = false;
        this.notificationService.showError('Error', 'No se pudieron cargar las configuraciones');
      }
    });
  }

  private createEstanteriaRowGroup(data?: Partial<AlmacenEstanteriaDef>): FormGroup {
    return this.fb.group({
      codigo: [data?.codigo ?? '', [Validators.required, Validators.maxLength(32)]],
      cantidadEstantes: [
        data?.cantidadEstantes ?? 1,
        [Validators.required, Validators.min(1)],
      ],
      divisionesEstante: [data?.divisionesEstante ?? 'A,B,C', Validators.required],
    });
  }

  resetEstanteriasRowsFromConfig(config?: AlmacenConfig): void {
    while (this.estanteriasRows.length) {
      this.estanteriasRows.removeAt(0);
    }
    if (config) {
      estanteriasOrdenadas(config).forEach((d) => {
        this.estanteriasRows.push(this.createEstanteriaRowGroup(d));
      });
    }
    if (this.estanteriasRows.length === 0) {
      this.estanteriasRows.push(this.createEstanteriaRowGroup({ codigo: 'E1', cantidadEstantes: 1, divisionesEstante: 'A,B,C' }));
    }
  }

  agregarFilaEstanteria(): void {
    const n = this.estanteriasRows.length + 1;
    this.estanteriasRows.push(
      this.createEstanteriaRowGroup({ codigo: `E${n}`, cantidadEstantes: 3, divisionesEstante: 'A,B,C' })
    );
  }

  eliminarFilaEstanteria(index: number): void {
    this.estanteriasRows.removeAt(index);
    if (this.estanteriasRows.length === 0) {
      this.agregarFilaEstanteria();
    }
  }

  agregarVariasEstanteriasIguales(): void {
    const cant = Math.max(1, Math.min(200, Math.floor(Number(this.variasCantidad)) || 1));
    const ini = Math.max(1, Math.floor(Number(this.variasNumeroInicial)) || 1);
    const est = Math.max(1, Math.floor(Number(this.variasEstantes)) || 1);
    const div = (this.variasDivisiones || 'A,B,C').trim();
    for (let k = 0; k < cant; k++) {
      this.estanteriasRows.push(
        this.createEstanteriaRowGroup({
          codigo: `E${ini + k}`,
          cantidadEstantes: est,
          divisionesEstante: div,
        })
      );
    }
  }

  abrirModalConfig(modal: unknown, config?: AlmacenConfig, almacenPreseleccionado?: Almacen): void {
    this.configModalValidacion = null;
    this.modoEdicionConfig = !!config;
    this.configSeleccionada = config || null;

    if (this.modoEdicionConfig && config) {
      this.almacenConfigForm.patchValue({
        almacenId: config.almacen.id,
        nombre: config.nombre || '',
      });
      this.resetEstanteriasRowsFromConfig(config);
    } else {
      const almacenId = almacenPreseleccionado?.id ?? '';
      this.almacenConfigForm.reset({
        almacenId,
        nombre: '',
      });
      this.resetEstanteriasRowsFromConfig(undefined);
    }

    this.modalService.open(modal, {
      size: 'lg',
      backdrop: true,
      windowClass: 'config-almacen-modal-window'
    });
  }

  private codigosDuplicadosEnForm(): boolean {
    const codes = new Set<string>();
    for (let i = 0; i < this.estanteriasRows.length; i++) {
      const raw = String(this.estanteriasRows.at(i).get('codigo')?.value ?? '')
        .trim()
        .toUpperCase();
      if (!raw) continue;
      if (codes.has(raw)) return true;
      codes.add(raw);
    }
    return false;
  }

  guardarConfig(): void {
    if (this.codigosDuplicadosEnForm()) {
      this.configModalValidacion = {
        titulo: 'Revisá los códigos de estantería',
        lineas: ['Hay códigos duplicados en las filas del formulario.'],
        esError: false
      };
      return;
    }

    if (!this.almacenConfigForm.valid) {
      this.almacenConfigForm.markAllAsTouched();
      this.estanteriasRows.controls.forEach((c) => (c as FormGroup).markAllAsTouched());
      const lineas = this.armarLineasValidacionConfigAlmacen();
      this.configModalValidacion = {
        titulo: 'Revisá el formulario antes de guardar',
        lineas: lineas.length > 0 ? lineas : ['Hay campos con datos inválidos.'],
        esError: false
      };
      return;
    }

    const formData = this.almacenConfigForm.value;
    const rows = formData.estanteriasRows as {
      codigo: string;
      cantidadEstantes: number;
      divisionesEstante: string;
    }[];

    const estanterias: AlmacenEstanteriaDef[] = rows.map((r, idx) => ({
      codigo: String(r.codigo).trim(),
      orden: idx + 1,
      cantidadEstantes: parseInt(String(r.cantidadEstantes), 10),
      divisionesEstante: String(r.divisionesEstante ?? '').trim(),
    }));

    if (estanterias.some((e) => !e.codigo || Number.isNaN(e.cantidadEstantes) || e.cantidadEstantes < 1 || !e.divisionesEstante)) {
      this.configModalValidacion = {
        titulo: 'Revisá las estanterías',
        lineas: ['Revisá código, cantidad de estantes y sectores en cada fila.'],
        esError: false
      };
      return;
    }

    const configData = {
      almacenId: parseInt(formData.almacenId, 10),
      nombre: formData.nombre || undefined,
      estanterias,
    };

    if (this.codigosDuplicadosEnLista(estanterias)) {
      this.configModalValidacion = {
        titulo: 'Revisá los códigos de estantería',
        lineas: ['Hay códigos duplicados en la lista enviada.'],
        esError: false
      };
      return;
    }

    this.configModalValidacion = null;

    if (this.modoEdicionConfig && this.configSeleccionada) {
      this.almacenConfigService.updateConfig(this.configSeleccionada.id, configData).subscribe({
        next: () => {
          this.modalService.dismissAll();
          this.cargarConfigs();
        },
        error: (err) => {
          console.error('Error al actualizar configuración:', err);
          const msg = this.mensajeErrorHttp(err);
          this.configModalValidacion = {
            titulo: 'Error al actualizar la configuración',
            lineas: [msg],
            esError: true
          };
          this.notificationService.showError('Error', msg);
        }
      });
    } else {
      this.almacenConfigService.createConfig(configData).subscribe({
        next: () => {
          this.modalService.dismissAll();
          this.cargarConfigs();
        },
        error: (err) => {
          console.error('Error al crear configuración:', err);
          const msg = this.mensajeErrorHttp(err);
          this.configModalValidacion = {
            titulo: 'Error al crear la configuración',
            lineas: [msg],
            esError: true
          };
          this.notificationService.showError('Error', msg);
        }
      });
    }
  }

  codigosDuplicadosEnLista(list: AlmacenEstanteriaDef[]): boolean {
    const codes = new Set<string>();
    for (const e of list) {
      const c = e.codigo.trim().toUpperCase();
      if (codes.has(c)) return true;
      codes.add(c);
    }
    return false;
  }

  eliminarConfig(config: AlmacenConfig): void {
    if (confirm(`¿Está seguro de que desea eliminar la configuración del almacén "${config.almacen.nombre}"?`)) {
      this.almacenConfigService.deleteConfig(config.id).subscribe({
        next: () => {
          this.cargarConfigs();
        },
        error: () => {
          this.notificationService.showError('Error', 'No se pudo eliminar la configuración');
        }
      });
    }
  }

  getConfigForAlmacen(almacenId: number): AlmacenConfig | undefined {
    return this.configs.find(c => c.almacen.id === almacenId);
  }

  getDivisionesArray(divisionesEstante: string): string[] {
    return this.almacenConfigService.getDivisionesArray(divisionesEstante);
  }

  listaEstanteriasResumen(config: AlmacenConfig): AlmacenEstanteriaDef[] {
    return estanteriasOrdenadas(config);
  }

  trackByEstanteria(_i: number, d: AlmacenEstanteriaDef): string {
    return `${d.codigo}-${d.orden}`;
  }

  iniciarTourConfigAlmacenes(): void {
    this.pageTour?.destroy();
    const steps = this.guidedTourHost.buildSteps([
      { selector: '#tour-config-almacenes-title', title: 'Configuración de almacenes', description: 'Aquí definís estanterías, cantidad de estantes y sectores por almacén. Esa estructura alimenta validaciones y la vista 3D.', side: 'bottom' },
      { selector: '#tour-config-almacenes-actions', title: 'Alta', description: 'Creá una configuración nueva o abrí el modal desde cada tarjeta para editar.', side: 'bottom' },
      { selector: '#tour-config-almacenes-cards', title: 'Listado', description: 'Cada almacén muestra resumen de estanterías o un aviso si aún no está configurado.', side: 'top' }
    ]);
    const inst = this.guidedTourHost.startTour(steps);
    if (inst) {
      this.pageTour = inst;
    }
  }
}
