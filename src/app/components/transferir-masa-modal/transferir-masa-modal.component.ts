import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AlmacenService, Almacen } from '../../services/almacen.service';
import { AlmacenConfigService } from '../../services/almacen-config.service';
import {
  AlmacenConfig,
  defEstanteria,
  estanteriasOrdenadas,
} from '../../interfaces/almacen-config.interface';
import {
  findAlmacenCementerio,
  findAlmacenLaboratorio,
  findAlmacenOficinaLaboratorio,
  OBS_OFICINA_LABORATORIO
} from '../../utils/almacen-especial';

export interface EquipoMasaItem {
  id: number;
  name?: string;
  ipAddr?: string;
  userid?: string;
  biosType?: string;
}

@Component({
  selector: 'app-transferir-masa-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './transferir-masa-modal.component.html',
  styleUrls: ['./transferir-masa-modal.component.css']
})
export class TransferirMasaModalComponent implements OnInit {
  equipos: EquipoMasaItem[] = [];
  busqueda = '';
  selectedIds: number[] = [];
  titulo = 'Transferir en masa';
  tituloLista = 'Equipos activos';
  excluirDestinos: string[] = [];

  almacenes: Almacen[] = [];
  almacenCementerio: Almacen | null = null;
  almacenLaboratorio: Almacen | null = null;
  almacenOficina: Almacen | null = null;
  almacenesRegulares: Almacen[] = [];
  transferForm: FormGroup;

  almacenConfig: AlmacenConfig | null = null;
  estanteriasDisponibles: string[] = [];
  estantesDisponibles: string[] = [];
  seccionesDisponibles: string[] = [];
  cargandoConfig = false;

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

  ngOnInit(): void {
    this.cargarAlmacenes();
  }

  get tokensBusqueda(): string[] {
    const vistos = new Set<string>();
    const tokens: string[] = [];
    for (const bruto of (this.busqueda || '').split(/[\s,;]+/)) {
      const token = bruto.trim();
      if (!token) {
        continue;
      }
      const clave = token.toLowerCase();
      if (vistos.has(clave)) {
        continue;
      }
      vistos.add(clave);
      tokens.push(token);
    }
    return tokens;
  }

  private coincideConToken(equipo: EquipoMasaItem, token: string, soloIdentificador = false): boolean {
    const t = token.toLowerCase();
    const name = (equipo.name || '').toLowerCase();
    const id = String(equipo.id ?? '');
    if (id === t || name === t || name.includes(t)) {
      return true;
    }
    if (soloIdentificador) {
      return false;
    }
    const ip = (equipo.ipAddr || '').toLowerCase();
    const usuario = (equipo.userid || '').toLowerCase();
    return ip.includes(t) || usuario.includes(t);
  }

  get equiposFiltrados(): EquipoMasaItem[] {
    const tokens = this.tokensBusqueda;
    const list = this.equipos || [];
    if (!tokens.length) {
      return list;
    }
    const soloIdentificador = tokens.length >= 2;
    return list.filter((e) => tokens.some((token) => this.coincideConToken(e, token, soloIdentificador)));
  }

  get tokensSinCoincidencia(): string[] {
    const tokens = this.tokensBusqueda;
    if (!tokens.length) {
      return [];
    }
    const list = this.equipos || [];
    const soloIdentificador = tokens.length >= 2;
    return tokens.filter((token) => !list.some((e) => this.coincideConToken(e, token, soloIdentificador)));
  }

  trackByToken(_: number, token: string): string {
    return token;
  }

  get seleccionados(): EquipoMasaItem[] {
    const ids = new Set(this.selectedIds);
    return (this.equipos || []).filter((e) => ids.has(e.id));
  }

  isSelected(id: number): boolean {
    return this.selectedIds.includes(id);
  }

  trackByEquipoId(_: number, equipo: EquipoMasaItem): number {
    return equipo.id;
  }

  toggleEquipo(equipo: EquipoMasaItem, checked: boolean): void {
    if (!equipo?.id) {
      return;
    }
    if (checked) {
      if (!this.selectedIds.includes(equipo.id)) {
        this.selectedIds = [...this.selectedIds, equipo.id];
      }
    } else {
      this.selectedIds = this.selectedIds.filter((id) => id !== equipo.id);
    }
  }

  onCheckboxChange(equipo: EquipoMasaItem, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.toggleEquipo(equipo, !!input?.checked);
  }

  quitarSeleccionado(id: number): void {
    this.selectedIds = this.selectedIds.filter((x) => x !== id);
  }

  get todosFiltradosSeleccionados(): boolean {
    const ids = this.equiposFiltrados.map((e) => e.id).filter((id) => id != null);
    return ids.length > 0 && ids.every((id) => this.selectedIds.includes(id));
  }

  seleccionarTodoFiltrado(): void {
    const ids = this.equiposFiltrados.map((e) => e.id).filter((id) => id != null);
    if (!ids.length) {
      return;
    }
    if (this.todosFiltradosSeleccionados) {
      const quitar = new Set(ids);
      this.selectedIds = this.selectedIds.filter((id) => !quitar.has(id));
      return;
    }
    const actuales = new Set(this.selectedIds);
    this.selectedIds = [...this.selectedIds, ...ids.filter((id) => !actuales.has(id))];
  }

  excluyeDestino(tipo: string): boolean {
    return (this.excluirDestinos || []).includes(tipo);
  }

  cargarAlmacenes(): void {
    this.almacenService.getAllAlmacenes().subscribe({
      next: (almacenes: Almacen[]) => {
        this.almacenes = almacenes;
        this.almacenCementerio = findAlmacenCementerio(almacenes) || null;
        this.almacenLaboratorio = findAlmacenLaboratorio(almacenes) || null;
        this.almacenOficina = findAlmacenOficinaLaboratorio(almacenes) || null;
        const idsEspeciales = [
          this.almacenCementerio?.id,
          this.almacenLaboratorio?.id,
          this.almacenOficina?.id
        ].filter((id) => id !== undefined && id !== null);
        this.almacenesRegulares = almacenes.filter((a) => !idsEspeciales.includes(a.id));
      },
      error: (error) => {
        console.error('Error al cargar almacenes:', error);
      }
    });
  }

  onAlmacenChange(): void {
    const almacenId = this.transferForm.get('almacenId')?.value;
    this.transferForm.patchValue({ estanteria: '', estante: '', seccion: '' }, { emitEvent: false });
    this.almacenConfig = null;
    this.estanteriasDisponibles = [];
    this.estantesDisponibles = [];
    this.seccionesDisponibles = [];

    this.transferForm.get('estanteria')?.clearValidators();
    this.transferForm.get('estante')?.clearValidators();
    this.transferForm.get('seccion')?.clearValidators();
    this.transferForm.get('observaciones')?.clearValidators();

    if (almacenId === 'oficina_laboratorio') {
      this.transferForm.get('observaciones')?.setValue(OBS_OFICINA_LABORATORIO);
    } else if (this.transferForm.get('observaciones')?.value === OBS_OFICINA_LABORATORIO) {
      this.transferForm.get('observaciones')?.setValue('');
    }

    if (this.esAlmacenRegular()) {
      this.cargarConfiguracionAlmacen(Number(almacenId));
    } else if (this.esAlmacenLaboratorio() && this.almacenLaboratorio) {
      this.cargarConfiguracionAlmacen(this.almacenLaboratorio.id);
    }

    this.transferForm.get('estanteria')?.updateValueAndValidity();
    this.transferForm.get('estante')?.updateValueAndValidity();
    this.transferForm.get('seccion')?.updateValueAndValidity();
    this.transferForm.get('observaciones')?.updateValueAndValidity();
  }

  cargarConfiguracionAlmacen(almacenId: number): void {
    this.cargandoConfig = true;
    this.almacenConfigService.getConfigByAlmacenId(almacenId).subscribe({
      next: (config: AlmacenConfig | null) => {
        this.cargandoConfig = false;
        if (config) {
          this.almacenConfig = config;
          this.estanteriasDisponibles = estanteriasOrdenadas(config).map((d) => d.codigo);
          this.transferForm.get('seccion')?.clearValidators();
          this.aplicarEstantesySeccionSegunEstanteria();
          this.transferForm.get('estanteria')?.setValidators([Validators.required]);
          this.transferForm.get('estante')?.setValidators([Validators.required]);
        } else {
          this.almacenConfig = null;
          if (this.esAlmacenRegular()) {
            this.transferForm.get('estanteria')?.setValidators([Validators.required]);
            this.transferForm.get('estante')?.setValidators([Validators.required]);
          }
        }
        this.transferForm.get('estanteria')?.updateValueAndValidity();
        this.transferForm.get('estante')?.updateValueAndValidity();
        this.transferForm.get('seccion')?.updateValueAndValidity();
      },
      error: () => {
        this.cargandoConfig = false;
        this.almacenConfig = null;
        this.transferForm.get('estanteria')?.clearValidators();
        this.transferForm.get('estante')?.clearValidators();
        this.transferForm.get('seccion')?.clearValidators();
        this.transferForm.get('estanteria')?.updateValueAndValidity();
        this.transferForm.get('estante')?.updateValueAndValidity();
        this.transferForm.get('seccion')?.updateValueAndValidity();
      }
    });
  }

  aplicarEstantesySeccionSegunEstanteria(): void {
    this.estantesDisponibles = [];
    this.seccionesDisponibles = [];
    if (!this.almacenConfig) {
      return;
    }
    const codSel = this.transferForm.get('estanteria')?.value;
    if (!codSel) {
      this.transferForm.get('seccion')?.clearValidators();
      return;
    }
    const def = defEstanteria(this.almacenConfig, String(codSel));
    if (!def) {
      this.transferForm.get('seccion')?.clearValidators();
      return;
    }
    for (let i = 1; i <= def.cantidadEstantes; i++) {
      this.estantesDisponibles.push(String(i));
    }
    this.seccionesDisponibles = (def.divisionesEstante || '')
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d);
    this.transferForm.get('seccion')?.clearValidators();
    if (this.seccionesDisponibles.length > 0) {
      this.transferForm.get('seccion')?.setValidators([Validators.required]);
    }
  }

  onEstanteriaUbicacionChange(): void {
    this.transferForm.patchValue({ estante: '', seccion: '' }, { emitEvent: false });
    this.aplicarEstantesySeccionSegunEstanteria();
    this.transferForm.get('estante')?.updateValueAndValidity();
    this.transferForm.get('seccion')?.updateValueAndValidity();
  }

  esAlmacenRegular(): boolean {
    const almacenId = this.transferForm.get('almacenId')?.value;
    if (!almacenId || almacenId === 'cementerio' || almacenId === 'laboratorio' || almacenId === 'oficina_laboratorio') {
      return false;
    }
    return !isNaN(Number(almacenId));
  }

  esAlmacenLaboratorio(): boolean {
    return this.transferForm.get('almacenId')?.value === 'laboratorio';
  }

  esAlmacenEspecial(): boolean {
    const almacenId = this.transferForm.get('almacenId')?.value;
    return almacenId === 'cementerio' || almacenId === 'laboratorio' || almacenId === 'oficina_laboratorio';
  }

  tieneCamposUbicacion(): boolean {
    return this.esAlmacenRegular() || this.esAlmacenLaboratorio();
  }

  puedeEnviar(): boolean {
    return this.transferForm.valid && this.selectedIds.length > 0;
  }

  confirmar(): void {
    if (!this.puedeEnviar()) {
      this.transferForm.markAllAsTouched();
      return;
    }
    const formData = this.transferForm.value;
    let tipoAlmacen: string;
    let almacenIdFinal: number | null = null;

    if (formData.almacenId === 'cementerio' && this.almacenCementerio) {
      almacenIdFinal = this.almacenCementerio.id;
      tipoAlmacen = 'cementerio';
    } else if (formData.almacenId === 'laboratorio' && this.almacenLaboratorio) {
      almacenIdFinal = this.almacenLaboratorio.id;
      tipoAlmacen = 'laboratorio';
    } else if (formData.almacenId === 'oficina_laboratorio' && this.almacenOficina) {
      almacenIdFinal = this.almacenOficina.id;
      tipoAlmacen = 'oficina_laboratorio';
    } else {
      almacenIdFinal = typeof formData.almacenId === 'string' ? parseInt(formData.almacenId, 10) : formData.almacenId;
      tipoAlmacen = 'regular';
    }

    const transferData: any = {
      hardwareIds: [...this.selectedIds],
      almacenId: almacenIdFinal,
      tipoAlmacen,
      observaciones: formData.observaciones || ''
    };

    if ((tipoAlmacen === 'regular' || tipoAlmacen === 'laboratorio') && this.almacenConfig) {
      transferData.estanteria = formData.estanteria || '';
      transferData.estante = formData.estante || '';
      transferData.seccion = formData.seccion != null ? formData.seccion : '';
    }

    this.activeModal.close(transferData);
  }
}
