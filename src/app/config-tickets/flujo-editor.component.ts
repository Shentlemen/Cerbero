import { AfterViewChecked, AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EFConnectableSide,
  FCanvasComponent,
  FConnectionMarkerArrow,
  FCreateConnectionEvent,
  FFlowModule,
  FMoveNodesEvent,
  FReassignConnectionEvent
} from '@foblex/flow';
import {
  FlujoAristaDTO,
  FlujoDefinicionDTO,
  FlujoNodoDTO,
  TicketTipoDTO,
  TicketTipoService
} from '../services/ticket-tipo.service';
import { TicketAreaDTO, TicketAreaService } from '../services/ticket-area.service';
import { NotificationService } from '../services/notification.service';
import { TicketEstado } from '../services/tickets.service';

type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null;

@Component({
  selector: 'app-flujo-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, FFlowModule, FConnectionMarkerArrow],
  templateUrl: './flujo-editor.component.html',
  styleUrl: './flujo-editor.component.css'
})
export class FlujoEditorComponent implements OnInit, OnChanges, AfterViewChecked, AfterViewInit, OnDestroy {
  @Input({ required: true }) tipo!: TicketTipoDTO;
  @Output() publicado = new EventEmitter<TicketTipoDTO>();
  @ViewChild('edgeLabelInput') edgeLabelInput?: ElementRef<HTMLInputElement>;
  @ViewChild(FCanvasComponent) private canvas?: FCanvasComponent;
  @ViewChild('canvasWrap') private canvasWrap?: ElementRef<HTMLElement>;

  /** El slot aparece/desaparece con *ngIf del workspace: re-enganchar ResizeObserver. */
  @ViewChild('canvasSlot')
  set canvasSlotRef(ref: ElementRef<HTMLElement> | undefined) {
    this.slotResizeObserver?.disconnect();
    this.slotResizeObserver = undefined;
    this.canvasSlotEl = ref?.nativeElement ?? null;
    if (!this.canvasSlotEl || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.slotResizeObserver = new ResizeObserver(() => this.compensarZoomYRedibujar());
    this.slotResizeObserver.observe(this.canvasSlotEl);
    this.compensarZoomYRedibujar();
  }

  nodes: FlujoNodoDTO[] = [];
  edges: FlujoAristaDTO[] = [];
  areas: TicketAreaDTO[] = [];
  loading = false;
  saving = false;
  publishing = false;
  selection: Selection = null;
  private focusEdgeLabelPending = false;
  private slotResizeObserver?: ResizeObserver;
  private canvasSlotEl: HTMLElement | null = null;
  private syncPending = false;

  readonly estadosTransicion: TicketEstado[] = [
    'NUEVO',
    'EN_REVISION',
    'EN_GESTION',
    'DERIVADO',
    'RESUELTO',
    'CERRADO',
    'REABIERTO'
  ];
  readonly estadosFin: TicketEstado[] = ['RESUELTO', 'CERRADO'];
  readonly connectableSide = EFConnectableSide;
  /** Destino elegido en el panel para crear una flecha sin arrastrar. */
  conectarHaciaId = '';


  constructor(
    private ticketTipoService: TicketTipoService,
    private ticketAreaService: TicketAreaService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.ticketAreaService.refreshAreasActivas().subscribe({
      next: (areas) => (this.areas = areas),
      error: () => (this.areas = [])
    });
  }

  ngAfterViewInit(): void {
    this.compensarZoomYRedibujar();
  }

  ngOnDestroy(): void {
    this.slotResizeObserver?.disconnect();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tipo'] && this.tipo && !this.tipo.esComun) {
      this.cargarBorrador();
    }
  }

  get selectedNode(): FlujoNodoDTO | null {
    if (!this.selection || this.selection.kind !== 'node') {
      return null;
    }
    return this.nodes.find((n) => n.id === this.selection!.id) || null;
  }

  get selectedEdge(): FlujoAristaDTO | null {
    if (!this.selection || this.selection.kind !== 'edge') {
      return null;
    }
    return this.edges.find((e) => e.id === this.selection!.id) || null;
  }

  cargarBorrador(): void {
    this.loading = true;
    this.selection = null;
    this.ticketTipoService.obtenerBorrador(this.tipo.id).subscribe({
      next: (def) => {
        this.aplicarDefinicion(def);
        this.loading = false;
      },
      error: (err: Error) => {
        this.loading = false;
        this.notificationService.showError('Error', err.message);
      }
    });
  }

  private aplicarDefinicion(def: FlujoDefinicionDTO): void {
    this.nodes = (def.nodes || []).map((n) => ({ ...n }));
    this.edges = (def.edges || []).map((e) => ({ ...e }));
  }

  private toDefinicion(): FlujoDefinicionDTO {
    return {
      nodes: this.nodes.map((n) => ({ ...n })),
      edges: this.edges.map((e) => ({ ...e }))
    };
  }

  connectorIn(nodeId: string): string {
    return `${nodeId}__in`;
  }

  connectorOut(nodeId: string): string {
    return `${nodeId}__out`;
  }

  nodeById(id: string): FlujoNodoDTO | undefined {
    return this.nodes.find((n) => n.id === id);
  }

  selectNode(id: string, event?: Event): void {
    event?.stopPropagation();
    this.selection = { kind: 'node', id };
    this.conectarHaciaId = '';
  }

  selectEdge(id: string, event?: Event): void {
    event?.stopPropagation();
    this.selection = { kind: 'edge', id };
    this.focusEdgeLabelPending = true;
  }

  ngAfterViewChecked(): void {
    if (!this.focusEdgeLabelPending || !this.edgeLabelInput) {
      return;
    }
    this.focusEdgeLabelPending = false;
    const el = this.edgeLabelInput.nativeElement;
    el.focus();
    el.select();
  }

  clearSelection(): void {
    this.selection = null;
  }

  onFlowLoaded(): void {
    this.compensarZoomYRedibujar();
  }

  /**
   * Compensa body zoom (0.8) solo en el canvas de Foblex:
   * mide el slot y setea width/height/zoom en px para llenar el 100% visual
   * y alinear mouse/links. No toca el zoom global de header/menú.
   */
  private compensarZoomYRedibujar(): void {
    if (this.syncPending) {
      return;
    }
    this.syncPending = true;
    requestAnimationFrame(() => {
      this.syncPending = false;
      const slot = this.canvasSlotEl;
      const wrap = this.canvasWrap?.nativeElement;
      if (!slot || !wrap) {
        return;
      }

      const sw = slot.clientWidth;
      const sh = slot.clientHeight;
      if (sw <= 0 || sh <= 0) {
        return;
      }

      const bodyZoom = this.leerZoomBody();
      const inv = bodyZoom > 0 && Math.abs(bodyZoom - 1) > 0.001 ? 1 / bodyZoom : 1;

      wrap.style.zoom = String(inv);
      wrap.style.width = `${sw / inv}px`;
      wrap.style.height = `${sh / inv}px`;

      requestAnimationFrame(() => this.canvas?.redraw());
    });
  }

  private leerZoomBody(): number {
    const raw = getComputedStyle(document.body).zoom;
    if (raw && raw !== 'normal') {
      if (raw.endsWith('%')) {
        const pct = parseFloat(raw);
        if (Number.isFinite(pct) && pct > 0) {
          return pct / 100;
        }
      }
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n > 0) {
        return n;
      }
    }
    const cssVar = getComputedStyle(document.documentElement)
      .getPropertyValue('--app-global-zoom')
      .trim();
    const fromVar = parseFloat(cssVar);
    return Number.isFinite(fromVar) && fromVar > 0 ? fromVar : 1;
  }

  onMoveNodes(event: FMoveNodesEvent): void {
    const moved = event.nodes?.length ? event.nodes : event.fNodes;
    for (const item of moved || []) {
      const node = this.nodes.find((n) => n.id === item.id);
      if (node && item.position) {
        node.x = item.position.x;
        node.y = item.position.y;
      }
    }
  }

  onCreateConnection(event: FCreateConnectionEvent): void {
    const outputId = event.sourceId || event.fOutputId;
    const inputId = event.targetId || event.fInputId;
    if (!inputId || !outputId) {
      return;
    }
    const source = this.nodeIdFromConnector(outputId);
    const target = this.nodeIdFromConnector(inputId);
    this.crearTransicion(source, target);
  }

  /**
   * Foblex solo mueve la preview al soltar; hay que persistir source/target en el modelo
   * o la flecha vuelve al destino anterior.
   */
  onReassignConnection(event: FReassignConnectionEvent): void {
    const nextSourceConnector = event.nextSourceId ?? event.newSourceId;
    const nextTargetConnector = event.nextTargetId ?? event.newTargetId;
    if (!nextSourceConnector && !nextTargetConnector) {
      return;
    }

    const edge =
      this.edges.find((e) => e.id === event.connectionId) ||
      this.edges.find(
        (e) =>
          this.connectorOut(e.source) === (event.previousSourceId || event.oldSourceId) &&
          this.connectorIn(e.target) === (event.previousTargetId || event.oldTargetId)
      );
    if (!edge) {
      return;
    }

    const newSource = nextSourceConnector
      ? this.nodeIdFromConnector(nextSourceConnector)
      : edge.source;
    const newTarget = nextTargetConnector
      ? this.nodeIdFromConnector(nextTargetConnector)
      : edge.target;

    if (!this.puedeSerTransicion(newSource, newTarget, edge.id)) {
      return;
    }

    edge.source = newSource;
    edge.target = newTarget;
    this.edges = [...this.edges];
    this.selection = { kind: 'edge', id: edge.id };
  }

  private nodeIdFromConnector(connectorId: string): string {
    return (connectorId || '').replace(/__(in|out)$/i, '');
  }

  /** Crea flecha source → target (desde drag o desde el panel). */
  crearTransicion(source: string, target: string): boolean {
    if (!this.puedeSerTransicion(source, target)) {
      return false;
    }
    const edge: FlujoAristaDTO = {
      id: `e_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      source,
      target,
      label: 'Continuar',
      notaPlantilla: ''
    };
    this.edges = [...this.edges, edge];
    this.selection = { kind: 'edge', id: edge.id };
    this.conectarHaciaId = '';
    return true;
  }

  private puedeSerTransicion(source: string, target: string, edgeIdIgnorar?: string): boolean {
    if (!source || !target || source === target) {
      return false;
    }
    if (this.edges.some((e) => e.id !== edgeIdIgnorar && e.source === source && e.target === target)) {
      this.notificationService.showError('Flujo', 'Esa transición ya existe.');
      return false;
    }
    const targetNode = this.nodeById(target);
    if (targetNode && targetNode.kind === 'inicio') {
      this.notificationService.showError('Flujo', 'No se puede conectar hacia el nodo Inicio.');
      return false;
    }
    const sourceNode = this.nodeById(source);
    if (sourceNode && sourceNode.kind === 'fin') {
      this.notificationService.showError('Flujo', 'El nodo Fin no puede tener salidas.');
      return false;
    }
    return true;
  }

  destinosPosiblesDesde(nodeId: string): FlujoNodoDTO[] {
    return this.nodes.filter((n) => n.id !== nodeId && n.kind !== 'inicio');
  }

  cambiarDestinoEdge(edgeId: string, nuevoTarget: string): void {
    const edge = this.edges.find((e) => e.id === edgeId);
    if (!edge || edge.target === nuevoTarget) {
      return;
    }
    if (!this.puedeSerTransicion(edge.source, nuevoTarget, edge.id)) {
      return;
    }
    edge.target = nuevoTarget;
    this.edges = [...this.edges];
  }

  agregarTransicionDesdePanel(): void {
    const node = this.selectedNode;
    if (!node || !this.conectarHaciaId) {
      return;
    }
    this.crearTransicion(node.id, this.conectarHaciaId);
  }

  agregarEtapa(): void {
    const id = `etapa_${Date.now()}`;
    const node: FlujoNodoDTO = {
      id,
      kind: 'etapa',
      label: 'Etapa',
      x: 280 + this.nodes.length * 12,
      y: 120 + (this.nodes.length % 4) * 40,
      bandeja: this.areas[0]?.codigo || '',
      estado: 'DERIVADO'
    };
    this.nodes = [...this.nodes, node];
    this.selection = { kind: 'node', id };
    this.conectarHaciaId = '';
  }

  agregarFin(): void {
    const id = `fin_${Date.now()}`;
    const node: FlujoNodoDTO = {
      id,
      kind: 'fin',
      label: 'Fin',
      x: 560 + this.nodes.length * 8,
      y: 200,
      estadoFinal: 'RESUELTO'
    };
    this.nodes = [...this.nodes, node];
    this.selection = { kind: 'node', id };
  }

  eliminarSeleccion(): void {
    if (!this.selection) {
      return;
    }
    if (this.selection.kind === 'node') {
      const node = this.nodeById(this.selection.id);
      if (!node) {
        return;
      }
      if (node.kind === 'inicio') {
        this.notificationService.showError('Flujo', 'El nodo Inicio no se puede eliminar.');
        return;
      }
      const id = node.id;
      this.nodes = this.nodes.filter((n) => n.id !== id);
      this.edges = this.edges.filter((e) => e.source !== id && e.target !== id);
    } else {
      this.edges = this.edges.filter((e) => e.id !== this.selection!.id);
    }
    this.selection = null;
  }

  guardarBorrador(): void {
    this.saving = true;
    this.ticketTipoService.guardarBorrador(this.tipo.id, this.toDefinicion()).subscribe({
      next: () => {
        this.saving = false;
        this.notificationService.showSuccessMessage('Borrador guardado.');
      },
      error: (err: Error) => {
        this.saving = false;
        this.notificationService.showError('Error', err.message);
      }
    });
  }

  publicar(): void {
    const problema = this.validarAntesDePublicar();
    if (problema) {
      this.notificationService.showError('No se pudo publicar', problema);
      return;
    }
    this.publishing = true;
    this.ticketTipoService.guardarBorrador(this.tipo.id, this.toDefinicion()).subscribe({
      next: () => {
        this.ticketTipoService.publicar(this.tipo.id).subscribe({
          next: (tipo) => {
            this.publishing = false;
            this.notificationService.showSuccessMessage(
              `Flujo publicado (v${tipo.versionPublicada ?? ''}).`
            );
            this.publicado.emit(tipo);
          },
          error: (err: Error) => {
            this.publishing = false;
            this.notificationService.showError('No se pudo publicar', err.message);
          }
        });
      },
      error: (err: Error) => {
        this.publishing = false;
        this.notificationService.showError('Error', err.message);
      }
    });
  }

  /** Validación rápida en cliente para mensajes claros antes del POST. */
  private validarAntesDePublicar(): string | null {
    const inicio = this.nodes.find((n) => n.kind === 'inicio');
    if (!inicio) {
      return 'Falta el nodo Inicio.';
    }
    if (!inicio.bandeja) {
      return 'Seleccioná la bandeja del nodo Inicio (panel derecho).';
    }
    const fines = this.nodes.filter((n) => n.kind === 'fin');
    if (fines.length === 0) {
      return 'Agregá al menos un nodo Fin.';
    }
    for (const n of this.nodes) {
      if ((n.kind === 'inicio' || n.kind === 'etapa') && !n.bandeja) {
        return `Seleccioná la bandeja del nodo "${n.label || n.id}" (panel derecho).`;
      }
      if (n.kind === 'etapa' && !n.estado) {
        n.estado = 'DERIVADO';
      }
      if (n.kind === 'fin' && n.estadoFinal !== 'RESUELTO' && n.estadoFinal !== 'CERRADO') {
        n.estadoFinal = 'RESUELTO';
      }
    }
    if (!this.edges.length) {
      return 'Inicio y Fin todavía no están conectados. Creá al menos una flecha entre nodos (desde el punto azul derecho hacia el verde izquierdo).';
    }
    if (!this.edges.some((e) => e.source === inicio.id)) {
      return 'El nodo Inicio no tiene ninguna flecha de salida. Conectalo a una etapa o al nodo Fin.';
    }

    const alcanzables = this.nodosAlcanzablesDesde(inicio.id);
    const finesAlcanzables = fines.filter((f) => alcanzables.has(f.id));
    if (finesAlcanzables.length === 0) {
      return 'No hay un camino desde Inicio hasta un nodo Fin. Conectá los nodos con flechas hasta llegar a Fin (Inicio y Fin no pueden quedar sueltos).';
    }
    const finesSueltos = fines.filter((f) => !alcanzables.has(f.id));
    if (finesSueltos.length > 0) {
      const nombres = finesSueltos.map((f) => `"${f.label || f.id}"`).join(', ');
      return `Estos nodos Fin no se pueden alcanzar desde Inicio: ${nombres}. Conectalos al flujo o eliminalos.`;
    }

    for (const e of this.edges) {
      if (!e.label?.trim()) {
        e.label = 'Continuar';
      }
    }
    return null;
  }

  /** Ids alcanzables desde un nodo siguiendo las flechas del diagrama. */
  private nodosAlcanzablesDesde(origenId: string): Set<string> {
    const salidas = new Map<string, string[]>();
    for (const e of this.edges) {
      if (!e.source || !e.target) {
        continue;
      }
      const list = salidas.get(e.source) || [];
      list.push(e.target);
      salidas.set(e.source, list);
    }
    const visitados = new Set<string>([origenId]);
    const cola: string[] = [origenId];
    while (cola.length) {
      const actual = cola.shift()!;
      for (const dest of salidas.get(actual) || []) {
        if (!visitados.has(dest)) {
          visitados.add(dest);
          cola.push(dest);
        }
      }
    }
    return visitados;
  }

  kindLabel(kind: string): string {
    switch ((kind || '').toLowerCase()) {
      case 'inicio':
        return 'Inicio';
      case 'etapa':
        return 'Etapa';
      case 'fin':
        return 'Fin';
      default:
        return kind;
    }
  }

  areaNombre(codigo?: string | null): string {
    if (!codigo) {
      return 'Sin bandeja';
    }
    const found = this.areas.find((a) => a.codigo === codigo);
    return found ? found.nombre : codigo;
  }

  trackNode(_: number, node: FlujoNodoDTO): string {
    return node.id;
  }

  trackEdge(_: number, edge: FlujoAristaDTO): string {
    return edge.id;
  }
}
