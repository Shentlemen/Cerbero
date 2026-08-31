import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import Konva from 'konva';
import { ThemeService } from '../../services/theme.service';
import {
  AlmacenPlantaObjeto,
  AlmacenPlantaOcupacion,
  AlmacenPlantaTipo,
  PLANTA_TAMANO_DEFAULT,
  PlantaPendingPlacement,
  colorFillDeObjeto,
  colorTextoSobre,
  ocupacionDe,
} from '../../interfaces/almacen-planta.interface';

const CELL = 28;

interface PlantaBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface PlantaKonvaNode {
  findAncestor: (selector: string, includeSelf?: boolean) => unknown;
  getClassName?: () => string;
  getParent?: () => PlantaKonvaNode | null;
  name?: () => string;
}

interface PlantaKonvaEvt<E = Event> {
  evt: E;
  cancelBubble: boolean;
  target: PlantaKonvaNode;
}

@Component({
  selector: 'app-almacen-planta-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './almacen-planta-canvas.component.html',
  styleUrls: ['./almacen-planta-canvas.component.css'],
})
export class AlmacenPlantaCanvasComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('wrap', { static: true }) wrapRef!: ElementRef<HTMLDivElement>;

  @Input() mode: 'edit' | 'view' = 'view';
  @Input() gridCols = 40;
  @Input() gridRows = 30;
  @Input() objetos: AlmacenPlantaObjeto[] = [];
  @Input() ocupacion: Record<string, AlmacenPlantaOcupacion> = {};
  @Input() pending: PlantaPendingPlacement | null = null;
  @Input() selectedCodigo: string | null = null;

  @Output() objetosChange = new EventEmitter<AlmacenPlantaObjeto[]>();
  @Output() objectClick = new EventEmitter<AlmacenPlantaObjeto>();
  @Output() selectionChange = new EventEmitter<AlmacenPlantaObjeto | null>();
  @Output() pendingConsumed = new EventEmitter<void>();

  private readonly theme = inject(ThemeService);
  private stage: InstanceType<typeof Konva.Stage> | null = null;
  private gridLayer: InstanceType<typeof Konva.Layer> | null = null;
  private objectLayer: InstanceType<typeof Konva.Layer> | null = null;
  private uiLayer: InstanceType<typeof Konva.Layer> | null = null;
  private transformer: InstanceType<typeof Konva.Transformer> | null = null;
  private ghost: InstanceType<typeof Konva.Rect> | null = null;
  private resizeObs?: ResizeObserver;
  private selectedKey: string | null = null;
  private ready = false;

  constructor() {
    effect(() => {
      this.theme.isDark();
      if (this.ready) {
        this.redrawAll();
      }
    });
  }

  ngAfterViewInit(): void {
    this.initStage();
    this.ready = true;
    this.redrawAll();
    this.fitToView();
    this.resizeObs = new ResizeObserver(() => this.resizeStage());
    this.resizeObs.observe(this.wrapRef.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.ready) {
      return;
    }
    if (changes['gridCols'] || changes['gridRows'] || changes['objetos'] || changes['ocupacion'] || changes['selectedCodigo'] || changes['mode'] || changes['pending']) {
      this.redrawAll();
    }
    if (changes['pending']) {
      this.updateGhost();
    }
    if (this.mode === 'view' && (changes['objetos'] || changes['gridCols'] || changes['gridRows'] || changes['mode'])) {
      this.fitToView();
    }
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    this.stage?.destroy();
    this.stage = null;
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (!this.ready) {
      return;
    }
    if (ev.key === 'Escape') {
      this.clearSelection();
      if (this.pending) {
        this.pendingConsumed.emit();
      }
      return;
    }
    if (this.mode !== 'edit') {
      return;
    }
    const target = ev.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.selectedKey) {
      this.removeSelected();
      return;
    }
    if ((ev.key === 'r' || ev.key === 'R') && this.selectedKey) {
      ev.preventDefault();
      this.rotateSelected90();
    }
  }

  rotateSelected90(): void {
    if (this.mode !== 'edit' || !this.selectedKey) {
      return;
    }
    const objetos = this.objetos.map(o => {
      if (this.keyOf(o) !== this.selectedKey) {
        return o;
      }
      const ancho = Math.max(1, o.alto);
      const alto = Math.max(1, o.ancho);
      const x = Math.max(0, Math.min(o.x, this.gridCols - ancho));
      const y = Math.max(0, Math.min(o.y, this.gridRows - alto));
      return { ...o, ancho, alto, x, y };
    });
    this.objetosChange.emit(objetos);
  }

  zoomBy(factor: number): void {
    if (!this.stage) {
      return;
    }
    const oldScale = this.stage.scaleX();
    const next = Math.min(2.6, Math.max(0.3, oldScale * factor));
    const center = { x: this.stage.width() / 2, y: this.stage.height() / 2 };
    this.zoomAt(center, next);
  }

  /** En vista: encuadra lo diseñado. En edición: muestra toda la grilla. */
  fitToView(): void {
    if (this.mode === 'view' && this.objetos.length > 0) {
      this.fitToContent();
      return;
    }
    this.fitToGrid();
  }

  private fitToGrid(): void {
    if (!this.stage) {
      return;
    }
    const pad = 16;
    const contentW = this.gridCols * CELL;
    const contentH = this.gridRows * CELL;
    const scale = Math.min(
      (this.stage.width() - pad * 2) / contentW,
      (this.stage.height() - pad * 2) / contentH
    );
    const clamped = Math.min(1.4, Math.max(0.25, scale));
    this.stage.scale({ x: clamped, y: clamped });
    this.stage.position({ x: pad, y: pad });
    this.stage.batchDraw();
  }

  private contentBounds(): { x: number; y: number; w: number; h: number } | null {
    if (!this.objetos.length) {
      return null;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const o of this.objetos) {
      minX = Math.min(minX, o.x);
      minY = Math.min(minY, o.y);
      maxX = Math.max(maxX, o.x + o.ancho);
      maxY = Math.max(maxY, o.y + o.alto);
    }
    const w = maxX - minX;
    const h = maxY - minY;
    if (w <= 0 || h <= 0) {
      return null;
    }
    return { x: minX, y: minY, w, h };
  }

  private fitToContent(): void {
    if (!this.stage) {
      return;
    }
    const bounds = this.contentBounds();
    if (!bounds) {
      this.fitToGrid();
      return;
    }
    const pad = 28;
    const contentW = bounds.w * CELL;
    const contentH = bounds.h * CELL;
    const stageW = this.stage.width();
    const stageH = this.stage.height();
    const scale = Math.min(
      (stageW - pad * 2) / contentW,
      (stageH - pad * 2) / contentH
    );
    const clamped = Math.min(3.2, Math.max(0.2, scale));
    this.stage.scale({ x: clamped, y: clamped });
    this.stage.position({
      x: (stageW - contentW * clamped) / 2 - bounds.x * CELL * clamped,
      y: (stageH - contentH * clamped) / 2 - bounds.y * CELL * clamped,
    });
    this.stage.batchDraw();
  }

  onDragOver(ev: DragEvent): void {
    if (this.mode !== 'edit') {
      return;
    }
    ev.preventDefault();
    if (ev.dataTransfer) {
      ev.dataTransfer.dropEffect = 'copy';
    }
  }

  onDrop(ev: DragEvent): void {
    if (this.mode !== 'edit' || !this.stage) {
      return;
    }
    ev.preventDefault();
    const raw = ev.dataTransfer?.getData('application/x-cerbero-planta');
    if (!raw) {
      return;
    }
    try {
      const pending = JSON.parse(raw) as PlantaPendingPlacement;
      const cell = this.pointerToCellFromClient(ev.clientX, ev.clientY);
      if (cell) {
        this.placeAt(cell.x, cell.y, pending);
      }
    } catch {
      /* ignore malformed drag payload */
    }
  }

  private initStage(): void {
    const el = this.hostRef.nativeElement;
    const wrap = this.wrapRef.nativeElement;
    this.stage = new Konva.Stage({
      container: el,
      width: Math.max(320, wrap.clientWidth || 640),
      height: Math.max(280, wrap.clientHeight || 420),
      draggable: false,
    });
    this.gridLayer = new Konva.Layer({ listening: false });
    this.objectLayer = new Konva.Layer();
    this.uiLayer = new Konva.Layer();
    this.stage.add(this.gridLayer);
    this.stage.add(this.objectLayer);
    this.stage.add(this.uiLayer);

    this.transformer = new Konva.Transformer({
      rotateEnabled: true,
      rotateAnchorOffset: 28,
      rotationSnaps: [0, 90, 180, 270],
      rotationSnapTolerance: 50,
      keepRatio: false,
      flipEnabled: false,
      enabledAnchors: [
        'top-left', 'top-right', 'bottom-left', 'bottom-right',
        'middle-left', 'middle-right', 'top-center', 'bottom-center',
      ],
      boundBoxFunc: (oldBox: PlantaBox, newBox: PlantaBox): PlantaBox => {
        if (newBox.width < CELL || newBox.height < CELL) {
          return oldBox;
        }
        return newBox;
      },
      ignoreStroke: true,
      anchorSize: 11,
      anchorStroke: '#3498db',
      anchorFill: '#fff',
      borderStroke: '#3498db',
    });
    this.uiLayer.add(this.transformer);
    this.transformer.visible(false);

    this.ghost = new Konva.Rect({
      visible: false,
      listening: false,
      dash: [6, 4],
      strokeWidth: 1.5,
    });
    this.uiLayer.add(this.ghost);

    this.stage.on('wheel', (e: PlantaKonvaEvt<WheelEvent>) => {
      e.evt.preventDefault();
      if (!this.stage) {
        return;
      }
      const oldScale = this.stage.scaleX();
      const pointer = this.stage.getPointerPosition();
      if (!pointer) {
        return;
      }
      const scaleBy = 1.08;
      const next = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
      this.zoomAt(pointer, Math.min(2.6, Math.max(0.3, next)));
    });

    this.stage.on('mousedown', (e: PlantaKonvaEvt<MouseEvent>) => {
      if (!this.stage) {
        return;
      }
      const onObj = this.hitIsObject(e.target);
      const onTransformer = this.hitIsTransformer(e.target);
      // Los handles no son .planta-obj: sin esto el mousedown deselecciona
      // y pone el stage en drag (pan) en vez de redimensionar/rotar.
      this.stage.draggable(!onObj && !onTransformer && e.evt.button !== 2);
      if (!onObj && !onTransformer && this.mode === 'edit' && !this.pending) {
        this.clearSelection();
      }
    });
    this.stage.on('mouseup', () => {
      this.stage?.draggable(false);
    });

    this.stage.on('mousemove', () => this.updateGhost());
    this.stage.on('click tap', (e: PlantaKonvaEvt<MouseEvent | TouchEvent>) => this.onStageClick(e));
  }

  private onStageClick(e: PlantaKonvaEvt<MouseEvent | TouchEvent>): void {
    if (!this.stage || this.mode !== 'edit' || !this.pending) {
      return;
    }
    if (this.hitIsObject(e.target) || this.hitIsTransformer(e.target)) {
      return;
    }
    const cell = this.pointerToCell();
    if (cell) {
      this.placeAt(cell.x, cell.y, this.pending);
    }
  }

  private placeAt(x: number, y: number, pending: PlantaPendingPlacement): void {
    const size = PLANTA_TAMANO_DEFAULT[pending.tipo];
    const ancho = Math.min(size.ancho, this.gridCols);
    const alto = Math.min(size.alto, this.gridRows);
    const clampedX = Math.max(0, Math.min(x, this.gridCols - ancho));
    const clampedY = Math.max(0, Math.min(y, this.gridRows - alto));
    const next: AlmacenPlantaObjeto = {
      tipo: pending.tipo,
      estanteriaCodigo: pending.tipo === 'ESTANTERIA' ? pending.estanteriaCodigo ?? null : null,
      etiqueta: pending.etiqueta,
      x: clampedX,
      y: clampedY,
      ancho,
      alto,
      color: pending.tipo === 'ESTANTERIA'
        ? colorFillDeObjeto({ tipo: 'ESTANTERIA', estanteriaCodigo: pending.estanteriaCodigo })
        : null,
      clientKey: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    const objetos = [...this.objetos, next];
    this.objetosChange.emit(objetos);
    this.pendingConsumed.emit();
    this.selectedKey = next.clientKey ?? null;
    this.selectionChange.emit(next);
  }

  private removeSelected(): void {
    if (!this.selectedKey) {
      return;
    }
    const objetos = this.objetos.filter(o => this.keyOf(o) !== this.selectedKey);
    this.selectedKey = null;
    this.selectionChange.emit(null);
    this.objetosChange.emit(objetos);
  }

  private clearSelection(): void {
    this.selectedKey = null;
    this.transformer?.nodes([]);
    this.transformer?.visible(false);
    this.uiLayer?.batchDraw();
    this.selectionChange.emit(null);
  }

  private redrawAll(): void {
    if (!this.stage || !this.gridLayer || !this.objectLayer) {
      return;
    }
    this.drawGrid();
    this.drawObjects();
    this.stage.batchDraw();
  }

  private drawGrid(): void {
    if (!this.gridLayer) {
      return;
    }
    this.gridLayer.destroyChildren();
    const colors = this.colors();
    const w = this.gridCols * CELL;
    const h = this.gridRows * CELL;
    this.gridLayer.add(new Konva.Rect({
      x: 0,
      y: 0,
      width: w,
      height: h,
      fill: colors.gridFill,
      listening: false,
    }));
    for (let c = 0; c <= this.gridCols; c++) {
      this.gridLayer.add(new Konva.Line({
        points: [c * CELL, 0, c * CELL, h],
        stroke: colors.gridLine,
        strokeWidth: c % 5 === 0 ? 1.1 : 0.5,
        listening: false,
      }));
    }
    for (let r = 0; r <= this.gridRows; r++) {
      this.gridLayer.add(new Konva.Line({
        points: [0, r * CELL, w, r * CELL],
        stroke: colors.gridLine,
        strokeWidth: r % 5 === 0 ? 1.1 : 0.5,
        listening: false,
      }));
    }
  }

  private drawObjects(): void {
    if (!this.objectLayer || !this.transformer) {
      return;
    }
    this.objectLayer.destroyChildren();
    const colors = this.colors();
    let selectedNode: InstanceType<typeof Konva.Group> | null = null;

    for (const obj of this.objetosEnOrdenDeDibujo()) {
      const key = this.keyOf(obj);
      const occupied = obj.tipo === 'ESTANTERIA'
        && ocupacionDe(this.ocupacion, obj.estanteriaCodigo).unidades > 0;
      const pal = this.colorFor(obj.tipo, colors);
      const fill = colorFillDeObjeto(obj) || pal.fill;
      const textColor = colorFillDeObjeto(obj) ? colorTextoSobre(fill) : pal.text;
      const highlighted = this.mode === 'view'
        && obj.tipo === 'ESTANTERIA'
        && this.selectedCodigo
        && this.norm(obj.estanteriaCodigo) === this.norm(this.selectedCodigo);

      const group = new Konva.Group({
        x: obj.x * CELL,
        y: obj.y * CELL,
        draggable: this.mode === 'edit' && !this.pending,
        name: 'planta-obj',
        id: key,
      });
      group.setAttr('objKey', key);

      const body = new Konva.Rect({
        width: obj.ancho * CELL,
        height: obj.alto * CELL,
        fill,
        stroke: highlighted ? colors.accent : pal.stroke,
        strokeWidth: highlighted ? 3 : occupied ? 2.4 : 1.5,
        cornerRadius: 5,
        name: 'body',
      });
      const label = new Konva.Text({
        text: (obj.etiqueta || obj.estanteriaCodigo || obj.tipo).toString(),
        width: obj.ancho * CELL,
        height: obj.alto * CELL,
        align: 'center',
        verticalAlign: 'middle',
        fontSize: Math.max(11, Math.min(16, Math.min(obj.ancho, obj.alto) * 6)),
        fontStyle: '700',
        fill: textColor,
        listening: false,
        padding: 2,
      });
      group.add(body);
      group.add(label);
      if (occupied) {
        group.add(new Konva.Circle({
          x: obj.ancho * CELL - 8,
          y: 8,
          radius: 4.5,
          fill: '#16a34a',
          stroke: '#fff',
          strokeWidth: 1,
          listening: false,
        }));
      }

      group.on('click tap', (ev: PlantaKonvaEvt) => {
        ev.cancelBubble = true;
        if (this.mode === 'edit' && this.pending) {
          const cell = this.pointerToCell();
          if (cell) {
            this.placeAt(cell.x, cell.y, this.pending);
          }
          return;
        }
        this.objectClick.emit(obj);
        if (this.mode === 'edit') {
          this.selectGroup(group, obj);
        }
      });

      if (this.mode === 'edit') {
        group.on('dragend', () => {
          this.snapGroup(group, obj);
          this.emitFromLayer();
        });
        group.on('transformend', () => {
          this.applyTransform(group, obj);
          this.emitFromLayer();
        });
      }

      this.objectLayer.add(group);
      if (this.mode === 'edit' && this.selectedKey === key) {
        selectedNode = group;
      }
    }

    if (this.mode === 'edit' && selectedNode && !this.pending) {
      this.transformer.nodes([selectedNode]);
      this.transformer.visible(true);
    } else {
      this.transformer.nodes([]);
      this.transformer.visible(false);
    }
    this.updateGhost();
  }

  private selectGroup(group: InstanceType<typeof Konva.Group>, obj: AlmacenPlantaObjeto): void {
    this.selectedKey = this.keyOf(obj);
    this.transformer?.nodes([group]);
    this.transformer?.visible(true);
    this.uiLayer?.batchDraw();
    this.selectionChange.emit(obj);
  }

  private snapGroup(group: InstanceType<typeof Konva.Group>, obj: AlmacenPlantaObjeto): void {
    const cellX = Math.round(group.x() / CELL);
    const cellY = Math.round(group.y() / CELL);
    const x = Math.max(0, Math.min(cellX, this.gridCols - obj.ancho));
    const y = Math.max(0, Math.min(cellY, this.gridRows - obj.alto));
    group.position({ x: x * CELL, y: y * CELL });
    obj.x = x;
    obj.y = y;
  }

  private applyTransform(group: InstanceType<typeof Konva.Group>, obj: AlmacenPlantaObjeto): void {
    const layer = this.objectLayer;
    const body = group.findOne('.body');
    if (!layer || !body) {
      return;
    }
    const box = group.getClientRect({ skipShadow: true, skipStroke: true, relativeTo: layer });
    group.scale({ x: 1, y: 1 });
    group.rotation(0);
    group.offset({ x: 0, y: 0 });
    let ancho = Math.max(1, Math.round(box.width / CELL));
    let alto = Math.max(1, Math.round(box.height / CELL));
    let x = Math.round(box.x / CELL);
    let y = Math.round(box.y / CELL);
    x = Math.max(0, Math.min(x, this.gridCols - 1));
    y = Math.max(0, Math.min(y, this.gridRows - 1));
    ancho = Math.min(ancho, this.gridCols - x);
    alto = Math.min(alto, this.gridRows - y);
    body.size({ width: ancho * CELL, height: alto * CELL });
    const text = group.findOne('Text');
    if (text) {
      text.size({ width: ancho * CELL, height: alto * CELL });
    }
    group.position({ x: x * CELL, y: y * CELL });
    obj.x = x;
    obj.y = y;
    obj.ancho = ancho;
    obj.alto = alto;
  }

  private hitIsObject(target: PlantaKonvaNode): boolean {
    return !!target.findAncestor('.planta-obj', true);
  }

  private hitIsTransformer(target: PlantaKonvaNode): boolean {
    let current: PlantaKonvaNode | null | undefined = target;
    for (let i = 0; i < 8 && current; i++) {
      if (current.getClassName?.() === 'Transformer') {
        return true;
      }
      current = current.getParent?.() ?? null;
    }
    const name = target.name?.() ?? '';
    return name.includes('_anchor') || name.includes('rotater');
  }

  private emitFromLayer(): void {
    if (!this.objectLayer) {
      return;
    }
    const byKey = new Map(this.objetos.map(o => [this.keyOf(o), { ...o }]));
    for (const node of this.objectLayer.find('.planta-obj')) {
      const group = node as InstanceType<typeof Konva.Group>;
      const key = String(group.getAttr('objKey') || group.id());
      const obj = byKey.get(key);
      if (!obj) {
        continue;
      }
      obj.x = Math.round(group.x() / CELL);
      obj.y = Math.round(group.y() / CELL);
      const body = group.findOne('.body');
      if (body) {
        obj.ancho = Math.max(1, Math.round(body.width() / CELL));
        obj.alto = Math.max(1, Math.round(body.height() / CELL));
      }
    }
    this.objetosChange.emit([...byKey.values()]);
  }

  private updateGhost(): void {
    if (!this.ghost || !this.stage) {
      return;
    }
    if (this.mode !== 'edit' || !this.pending) {
      this.ghost.visible(false);
      this.uiLayer?.batchDraw();
      return;
    }
    const cell = this.pointerToCell();
    if (!cell) {
      this.ghost.visible(false);
      this.uiLayer?.batchDraw();
      return;
    }
    const size = PLANTA_TAMANO_DEFAULT[this.pending.tipo];
    const colors = this.colors();
    const pal = this.colorFor(this.pending.tipo, colors);
    const fill = this.pending.tipo === 'ESTANTERIA'
      ? (colorFillDeObjeto({ tipo: 'ESTANTERIA', estanteriaCodigo: this.pending.estanteriaCodigo }) || pal.fill)
      : pal.fill;
    this.ghost.setAttrs({
      x: cell.x * CELL,
      y: cell.y * CELL,
      width: size.ancho * CELL,
      height: size.alto * CELL,
      fill,
      stroke: pal.stroke,
      opacity: 0.45,
      visible: true,
    });
    this.uiLayer?.batchDraw();
  }

  private pointerToCell(): { x: number; y: number } | null {
    if (!this.stage) {
      return null;
    }
    const p = this.stage.getPointerPosition();
    if (!p) {
      return null;
    }
    return this.stagePointToCell(p.x, p.y);
  }

  private pointerToCellFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!this.stage) {
      return null;
    }
    const rect = this.stage.container().getBoundingClientRect();
    return this.stagePointToCell(clientX - rect.left, clientY - rect.top);
  }

  private stagePointToCell(sx: number, sy: number): { x: number; y: number } | null {
    if (!this.stage) {
      return null;
    }
    const t = this.stage.getAbsoluteTransform().copy().invert();
    const pt = t.point({ x: sx, y: sy });
    const x = Math.floor(pt.x / CELL);
    const y = Math.floor(pt.y / CELL);
    if (x < 0 || y < 0 || x >= this.gridCols || y >= this.gridRows) {
      return null;
    }
    return { x, y };
  }

  private zoomAt(pointer: { x: number; y: number }, newScale: number): void {
    if (!this.stage) {
      return;
    }
    const oldScale = this.stage.scaleX();
    const mousePointTo = {
      x: (pointer.x - this.stage.x()) / oldScale,
      y: (pointer.y - this.stage.y()) / oldScale,
    };
    this.stage.scale({ x: newScale, y: newScale });
    this.stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
    this.stage.batchDraw();
  }

  private resizeStage(): void {
    if (!this.stage) {
      return;
    }
    const wrap = this.wrapRef.nativeElement;
    this.stage.size({
      width: Math.max(320, wrap.clientWidth),
      height: Math.max(280, wrap.clientHeight),
    });
    if (this.mode === 'view') {
      this.fitToView();
      return;
    }
    this.stage.batchDraw();
  }

  private objetosEnOrdenDeDibujo(): AlmacenPlantaObjeto[] {
    const z = (tipo: AlmacenPlantaTipo): number => {
      if (tipo === 'HABITACION') return 0;
      if (tipo === 'PASILLO' || tipo === 'STAGING') return 1;
      if (tipo === 'MUELLE' || tipo === 'OFICINA') return 2;
      return 3;
    };
    return [...this.objetos].sort((a, b) => z(a.tipo) - z(b.tipo));
  }

  private keyOf(o: AlmacenPlantaObjeto): string {
    return o.clientKey || (o.id != null ? `id-${o.id}` : `tmp-${o.tipo}-${o.x}-${o.y}`);
  }

  private norm(v: string | null | undefined): string {
    return (v ?? '').trim().toUpperCase();
  }

  private colorFor(
    tipo: AlmacenPlantaTipo,
    c: ReturnType<AlmacenPlantaCanvasComponent['colors']>
  ): { fill: string; stroke: string; text: string } {
    if (tipo === 'ESTANTERIA') return c.estanteriaEmpty;
    if (tipo === 'PASILLO') return c.pasillo;
    if (tipo === 'MUELLE') return c.muelle;
    if (tipo === 'OFICINA') return c.oficina;
    if (tipo === 'HABITACION') return c.habitacion;
    return c.staging;
  }

  private colors() {
    const dark = this.theme.isDark();
    if (dark) {
      return {
        gridFill: '#0f172a',
        gridLine: '#1e293b',
        accent: '#38bdf8',
        estanteriaEmpty: { fill: '#334155', stroke: '#64748b', text: '#e2e8f0' },
        estanteriaFull: { fill: '#1d6b62', stroke: '#5aa89a', text: '#ecfdf8' },
        pasillo: { fill: '#1e293b', stroke: '#475569', text: '#94a3b8' },
        muelle: { fill: '#7c4a12', stroke: '#d68910', text: '#fde68a' },
        oficina: { fill: '#312e81', stroke: '#818cf8', text: '#e0e7ff' },
        habitacion: { fill: '#1e3a4c', stroke: '#38bdf8', text: '#bae6fd' },
        staging: { fill: '#713f12', stroke: '#c4a06a', text: '#fef3c7' },
      };
    }
    return {
      gridFill: '#f8fafc',
      gridLine: '#e2e8f0',
      accent: '#3498db',
      estanteriaEmpty: { fill: '#cbd5e1', stroke: '#64748b', text: '#1e2937' },
      estanteriaFull: { fill: '#5aa89a', stroke: '#3d7a70', text: '#ffffff' },
      pasillo: { fill: '#e2e8f0', stroke: '#94a3b8', text: '#475569' },
      muelle: { fill: '#f0c078', stroke: '#d68910', text: '#3f2a0a' },
      oficina: { fill: '#c7d2fe', stroke: '#6366f1', text: '#1e1b4b' },
      habitacion: { fill: '#e8f4fc', stroke: '#3498db', text: '#1e4a6b' },
      staging: { fill: '#e8d4a8', stroke: '#c4a06a', text: '#3f2f12' },
    };
  }
}
