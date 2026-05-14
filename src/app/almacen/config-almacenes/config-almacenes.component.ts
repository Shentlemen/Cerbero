import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { NgbModal, NgbModalRef, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { AlmacenConfigService } from '../../services/almacen-config.service';
import { AlmacenConfig, AlmacenEstanteriaDef, estanteriasOrdenadas } from '../../interfaces/almacen-config.interface';
import { PermissionsService } from '../../services/permissions.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationContainerComponent } from '../../components/notification-container/notification-container.component';
import { TourRegistryService, TourDefinition } from '../../services/tour-registry.service';
import { GuidedTourHostService, GuidedTourStepDef } from '../../services/guided-tour-host.service';
import type { Driver, DriveStep } from 'driver.js';
import { driver } from 'driver.js';

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

  private tourCleanup?: () => void;
  private tourCrearConfig?: Driver;
  private tourDemoConfigModalRef?: NgbModalRef;
  /** Activo durante el tour DEMO del modal de crear configuración. */
  tourDemoActivo = false;
  @ViewChild('configModal') configModalTpl?: TemplateRef<unknown>;

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
    private tourRegistry: TourRegistryService,
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
    const tours: TourDefinition[] = [
      {
        id: 'config-almacenes-overview',
        title: 'Tour de configuración de almacenes',
        icon: 'fa-route',
        steps: [
          { selector: '#tour-config-almacenes-title', title: 'Configuración de almacenes', description: 'Aquí definís estanterías, cantidad de estantes y sectores por almacén. Esa estructura alimenta validaciones y la vista 3D.', side: 'bottom' },
          { selector: '#tour-config-almacenes-actions', title: 'Alta', description: 'Creá una configuración nueva o abrí el modal desde cada tarjeta para editar.', side: 'bottom' },
          { selector: '#tour-config-almacenes-cards', title: 'Listado', description: 'Cada almacén muestra resumen de estanterías o un aviso si aún no está configurado.', side: 'top' },
          { selector: '.btn-eliminar-config', title: 'Eliminar configuración',
            description: '<strong>Borra la configuración</strong> del almacén (estanterías, estantes y sectores). El almacén sigue existiendo, pero pierde la estructura interna hasta que vuelvas a configurarlo. Pide confirmación antes de aplicar.', side: 'top' }
        ]
      },
      {
        id: 'config-almacenes-crear-detalle',
        title: 'Cómo crear una configuración',
        icon: 'fa-cogs',
        run: () => this.runTourCrearConfig(),
      }
    ];
    this.tourCleanup = this.tourRegistry.register('config-almacenes', tours);
  }

  ngOnDestroy(): void {
    this.tourCleanup?.();
    this.tourCleanup = undefined;
    this.tourCrearConfig?.destroy();
    this.tourCrearConfig = undefined;
    this.tourDemoConfigModalRef?.dismiss();
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
    if (this.tourDemoActivo) {
      this.tourDemoConfigModalRef?.dismiss();
      return;
    }
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

  /**
   * Lanza el tour DEMO del modal "Nueva Configuración de Almacén":
   * pre-llena el formulario con datos plausibles, bloquea el guardado
   * y recorre cada sección.
   */
  private runTourCrearConfig(): void {
    if (!this.configModalTpl) {
      return;
    }
    this.tourCrearConfig?.destroy();
    this.tourCrearConfig = undefined;

    this.prepararConfigDemo();
    const modalRef = this.modalService.open(this.configModalTpl, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      windowClass: 'config-almacen-modal-window'
    });
    this.tourDemoConfigModalRef = modalRef;
    modalRef.result
      .then(() => this.finalizarTourCrearConfig())
      .catch(() => this.finalizarTourCrearConfig());

    const pasos: GuidedTourStepDef[] = [
      { selector: '#tour-config-modal-almacen', title: 'Almacén (obligatorio)',
        description: 'Elegí el <strong>almacén</strong> al que vas a definirle la estructura. En edición este selector queda bloqueado.', side: 'right' },
      { selector: '#tour-config-modal-nombre', title: 'Nombre personalizado',
        description: 'Opcional. Sirve para <strong>renombrar visualmente</strong> la configuración (por ejemplo, "Depósito Norte – Planta 2"). Si lo dejás vacío, se usa el nombre del almacén.', side: 'left' },
      { selector: '#tour-config-modal-estanterias-title', title: 'Estanterías',
        description: 'Acá definís cada <strong>estantería</strong> que tendrá el almacén. Una fila = una estantería. Cada estantería puede tener cantidades de estantes y sectores distintos.', side: 'bottom' },
      { selector: '#tour-config-modal-fila-codigo', title: 'Código',
        description: 'Identificador corto de la estantería (ej.: <em>E1</em>, <em>A</em>, <em>NORTE-3</em>). No puede repetirse dentro del mismo almacén.', side: 'right' },
      { selector: '#tour-config-modal-fila-estantes', title: 'Estantes',
        description: 'Cantidad de <strong>estantes (niveles)</strong> que tiene esta estantería. Mínimo 1.', side: 'top' },
      { selector: '#tour-config-modal-fila-sectores', title: 'Sectores',
        description: 'Lista de <strong>sectores</strong> separados por coma (ej.: <em>A,B,C</em>). Cada estante se subdivide en estos sectores para ubicar el stock con precisión.', side: 'top' },
      { selector: '#tour-config-modal-fila-quitar', title: 'Quitar fila',
        description: 'Elimina esta estantería del formulario. Si quitás todas, vuelve a aparecer una vacía: el form siempre exige al menos una.', side: 'left' },
      { selector: '#tour-config-modal-agregar-fila', title: 'Agregar fila',
        description: 'Suma una nueva estantería al formulario. El código se autopropone como <em>E + número</em>, pero lo podés cambiar libremente.', side: 'top' },
      { selector: '#tour-config-modal-varias-card', title: 'Agregar varias iguales',
        description: 'Atajo para cargar <strong>en lote</strong> estanterías con la misma forma. Ahorra mucho tiempo cuando el almacén tiene decenas de estanterías idénticas.', side: 'top' },
      { selector: '#tour-config-modal-varias-cantidad', title: 'Cantidad',
        description: 'Cuántas <strong>estanterías nuevas</strong> querés generar de una sola vez (hasta 200).', side: 'right' },
      { selector: '#tour-config-modal-varias-inicial', title: 'Nº inicial',
        description: 'A partir de qué <strong>número</strong> arranca el código autogenerado. Ej.: con cantidad 3 y nº inicial 10, se crean <em>E10, E11, E12</em>.', side: 'top' },
      { selector: '#tour-config-modal-varias-estantes', title: 'Estantes c/u',
        description: 'Cantidad de estantes que tendrá <strong>cada una</strong> de las estanterías que vas a generar.', side: 'top' },
      { selector: '#tour-config-modal-varias-sectores', title: 'Sectores',
        description: 'Los sectores (separados por coma) que se asignan a <strong>todas</strong> las estanterías nuevas en este lote.', side: 'top' },
      { selector: '#tour-config-modal-varias-add', title: 'Añadir lote',
        description: 'Inserta el lote completo al final de la lista de estanterías. Después podés ajustar individualmente cualquier fila.', side: 'left' },
      { selector: '#tour-config-modal-save', title: 'Guardar',
        description: 'En uso normal, guarda la configuración (la valida primero, mostrando errores en el cuadro inferior si los hay). Acá está <strong>bloqueado</strong> para no crear datos reales. Al apretar <strong>Finalizar</strong> se cierra el tour y el modal demo.', side: 'left' }
    ];

    this.esperarSelectores(
      ['#tour-config-modal-almacen', '#tour-config-modal-fila-codigo', '#tour-config-modal-save'],
      3000
    ).then(() => {
      const driveSteps = this.guidedTourHost.buildSteps(pasos);
      if (driveSteps.length === 0) {
        return;
      }
      const inst: Driver = driver({
        showProgress: true,
        nextBtnText: 'Siguiente',
        prevBtnText: 'Anterior',
        doneBtnText: 'Finalizar',
        allowClose: true,
        overlayOpacity: 0.55,
        stagePadding: 6,
        steps: driveSteps as DriveStep[],
        onDestroyed: () => {
          this.tourCrearConfig = undefined;
          this.tourDemoConfigModalRef?.dismiss();
        }
      });
      inst.drive();
      this.tourCrearConfig = inst;
    });
  }

  /**
   * Llena el formulario con datos plausibles para el tour demo.
   * Se elige el primer almacén disponible (el selector del form lo permite).
   */
  private prepararConfigDemo(): void {
    this.tourDemoActivo = true;
    this.modoEdicionConfig = false;
    this.configSeleccionada = null;
    this.configModalValidacion = null;

    const almacenDemo = this.almacenes[0];
    this.almacenConfigForm.reset({
      almacenId: almacenDemo?.id ?? '',
      nombre: 'Configuración DEMO',
    });
    this.resetEstanteriasRowsFromConfig(undefined);
    // Pre-cargamos valores tipográficos en la primera fila para que se entiendan los campos.
    const primera = this.estanteriasRows.at(0) as FormGroup | undefined;
    primera?.patchValue({ codigo: 'E1', cantidadEstantes: 4, divisionesEstante: 'A,B,C' });
    // Valores plausibles del bloque "agregar varias iguales".
    this.variasCantidad = 3;
    this.variasNumeroInicial = 2;
    this.variasEstantes = 4;
    this.variasDivisiones = 'A,B,C';
  }

  /** Limpia estado de demo cuando se cierra el modal o termina el tour. */
  private finalizarTourCrearConfig(): void {
    this.tourCrearConfig?.destroy();
    this.tourCrearConfig = undefined;
    this.tourDemoConfigModalRef = undefined;
    this.tourDemoActivo = false;
    this.configModalValidacion = null;
  }

  /** Polling de selectores DOM con timeout. */
  private esperarSelectores(selectores: string[], timeoutMs = 2500, intervalMs = 60): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const todos = selectores.every((sel) => !!document.querySelector(sel));
        if (todos || Date.now() - start >= timeoutMs) {
          resolve();
          return;
        }
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  eliminarConfig(config: AlmacenConfig): void {
    if (this.tourDemoActivo) {
      return;
    }
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

}
