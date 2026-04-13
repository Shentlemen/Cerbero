import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, ElementRef, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { AlmacenConfig } from '../../interfaces/almacen-config.interface';

export interface CajaInfo {
  estanteria: string;
  nivel: number;
  posicion: number;
  seccion: string;
  contenido?: any[];
}

export interface StockItem {
  estanteria: string;
  estante: string;
  seccion?: string;
  cantidad?: number;
  [key: string]: any;
}

export interface EstanteriaLayout {
  estanteriaId: string;
  offsetX: number;
  offsetZ: number;
  rotationY: number;
}

@Component({
  selector: 'app-almacen-3d',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './almacen-3d.component.html',
  styleUrls: ['./almacen-3d.component.css']
})
export class Almacen3DComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('renderCanvas', { static: true }) renderCanvas!: ElementRef<HTMLCanvasElement>;
  
  @Input() almacenId: string = 'ALM02';
  @Input() almacenNombre: string = '';
  @Input() estanteriaId: string = 'A1';
  @Input() niveles: number = 3;
  @Input() cajasporNivel: number = 4;
  @Input() config: AlmacenConfig | null = null; // Si null → vista "sin estructura"
  @Input() stockData: StockItem[] = []; // Datos de stock para filtrar cajas
  @Input() estanteriasLayout: EstanteriaLayout[] = [];
  
  @Output() cajaSeleccionada = new EventEmitter<CajaInfo>();
  @Output() estanteriasLayoutChange = new EventEmitter<EstanteriaLayout[]>();
  
  private engine!: BABYLON.Engine;
  private scene!: BABYLON.Scene;
  private camera!: BABYLON.ArcRotateCamera;
  private cajasMap: Map<BABYLON.Mesh, CajaInfo> = new Map();
  private etiquetasEstanterias: Map<string, BABYLON.Mesh> = new Map();
  private resizeObserver?: ResizeObserver;
  private windowResizeListener?: () => void;
  private layoutEstanterias: { offsetX: number; offsetZ: number; estanteriaId: string }[] = [];
  private sinEstructura: boolean = false;
  private seccionesNombres: string[] = ['a', 'b', 'c'];
  private sceneReady: boolean = false;
  
  // Colores para los niveles
  private nivelesColores = [
    new BABYLON.Color3(0.8, 0.6, 0.4),  // Marrón claro
    new BABYLON.Color3(0.7, 0.5, 0.3),  // Marrón medio
    new BABYLON.Color3(0.6, 0.4, 0.2),  // Marrón oscuro
  ];

  ngOnInit(): void {
    // Esperar un poco para que el DOM esté completamente listo
    setTimeout(() => {
      this.initBabylon();
      this.setupResizeHandlers();
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    const configChanged = changes['config'] && !changes['config'].firstChange;
    const almacenIdChanged = changes['almacenId'] && !changes['almacenId'].firstChange;
    const stockDataChanged = changes['stockData'] && !changes['stockData'].firstChange;
    const layoutChanged = changes['estanteriasLayout'] && !changes['estanteriasLayout'].firstChange;

    // Si cambia config o almacenId → reconstruir escena completa
    if ((configChanged || almacenIdChanged || layoutChanged) && this.engine) {
      this.destroyScene();
      setTimeout(() => this.initBabylon(), 0);
      return;
    }

    // Si solo cambian los datos de stock
    if (stockDataChanged && this.scene) {
      if (this.sinEstructura) {
        this.actualizarItemsVistaSinEstructura();
      } else {
        this.cajasMap.forEach((_, mesh) => mesh.dispose());
        this.cajasMap.clear();
        this.crearSoloCajasEnTodasLasEstanterias();
      }
    }
  }

  private destroyScene(): void {
    this.sceneReady = false;
    this.etiquetasEstanterias.forEach((m) => m.dispose());
    this.etiquetasEstanterias.clear();
    this.cajasMap.forEach((_, mesh) => mesh.dispose());
    this.cajasMap.clear();
    this.layoutEstanterias = [];
    if (this.scene) {
      this.scene.dispose();
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
    
    if (this.windowResizeListener) {
      window.removeEventListener('resize', this.windowResizeListener);
      this.windowResizeListener = undefined;
    }
    
    // Limpiar etiquetas de estanterías
    this.etiquetasEstanterias.forEach((mesh) => {
      mesh.dispose();
    });
    this.etiquetasEstanterias.clear();
    
    // Limpiar cajas
    this.cajasMap.forEach((info, mesh) => {
      mesh.dispose();
    });
    this.cajasMap.clear();
    
    if (this.scene) {
      this.scene.dispose();
    }
    if (this.engine) {
      this.engine.dispose();
    }
  }

  private initBabylon(): void {
    const canvas = this.renderCanvas.nativeElement;
    const isRebuild = !!this.engine;

    if (!this.engine) {
      this.engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true
      });
      this.setupResizeHandlers();
    }

    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.15, 1);

    this.camera = new BABYLON.ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 3,
      25,
      new BABYLON.Vector3(0, 2, 0),
      this.scene
    );
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 10;
    this.camera.upperRadiusLimit = 50;
    this.camera.wheelPrecision = 20;

    const hemisphericLight = new BABYLON.HemisphericLight(
      'hemiLight',
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    hemisphericLight.intensity = 0.6;

    const directionalLight = new BABYLON.DirectionalLight(
      'dirLight',
      new BABYLON.Vector3(-1, -2, -1),
      this.scene
    );
    directionalLight.intensity = 0.8;
    directionalLight.position = new BABYLON.Vector3(5, 10, 5);

    this.crearPiso();

    if (!this.config) {
      this.sinEstructura = true;
      this.crearVistaSinEstructura();
    } else {
      this.sinEstructura = false;
      this.crearEstructuraDesdeConfig();
    }

    this.configurarPicking();
    if (!isRebuild) {
      this.fixMouseCoordinates();
    }

    this.sceneReady = true;
    if (!isRebuild) {
      this.engine.runRenderLoop(() => {
        if (this.sceneReady && this.scene) this.scene.render();
      });
    }
  }

  /** Estructura dinámica según AlmacenConfig */
  private crearEstructuraDesdeConfig(): void {
    const cfg = this.config!;
    const numEstanterias = cfg.cantidadEstanterias || 6;
    const niveles = cfg.cantidadEstantesPorEstanteria || 3;
    this.seccionesNombres = (cfg.divisionesEstante || 'A,B,C').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (this.seccionesNombres.length === 0) this.seccionesNombres = ['a', 'b', 'c'];
    this.niveles = niveles;

    const espacioEntreEstanterias = 7;
    const espacioEntreFilas = 8;
    const profundidadEstanteria = 1.5;
    const anchoEstanteria = 18;

    const numCols = Math.ceil(Math.sqrt(numEstanterias));
    const numFilas = Math.ceil(numEstanterias / numCols);
    const anchoTotal = numFilas * anchoEstanteria + (numFilas - 1) * espacioEntreFilas;
    const profTotal = numCols * profundidadEstanteria + (numCols - 1) * espacioEntreEstanterias;
    const offsetInicialX = -anchoTotal / 2 + anchoEstanteria / 2;
    const offsetInicialZ = -profTotal / 2 + profundidadEstanteria / 2;

    this.layoutEstanterias = [];
    const layoutMap = new Map((this.estanteriasLayout || []).map(l => [l.estanteriaId, l]));
    let idx = 0;
    for (let fila = 0; fila < numFilas && idx < numEstanterias; fila++) {
      const offsetX = offsetInicialX + fila * (anchoEstanteria + espacioEntreFilas);
      for (let col = 0; col < numCols && idx < numEstanterias; col++) {
        const offsetZ = offsetInicialZ + col * (profundidadEstanteria + espacioEntreEstanterias);
        const estanteriaId = `E${idx + 1}`;
        const custom = layoutMap.get(estanteriaId);
        const finalX = custom?.offsetX ?? offsetX;
        const finalZ = custom?.offsetZ ?? offsetZ;
        this.layoutEstanterias.push({ offsetX: finalX, offsetZ: finalZ, estanteriaId });
        this.crearEstanteria(finalX, finalZ, estanteriaId, custom?.rotationY ?? 0);
        idx++;
      }
    }
  }

  /** Vista alternativa: montaña de cajas desordenada. Click en cualquier caja abre modal con todo el contenido */
  private crearVistaSinEstructura(): void {
    const items = this.stockData || [];
    const cajaInfoMontana: CajaInfo = {
      estanteria: 'Montaña',
      nivel: 1,
      posicion: 1,
      seccion: '-',
      contenido: []
    };

    const cardboardTexturePath = 'assets/textures/cardboard.jpg';
    const baseSide = 7;
    let numCajas = 0;
    for (let l = 0; baseSide - 2 * l >= 1; l++) {
      const s = baseSide - 2 * l;
      numCajas += s * s;
    }
    const baseY = 0.05;
    const boxSize = 1.7;
    const spacing = 1.9;
    const jitter = () => (Math.random() - 0.5) * 0.4;
    const rotJitter = () => (Math.random() - 0.5) * 0.4;

    let idx = 0;
    const boxHeight = boxSize * 0.7;
    const layerHeight = boxHeight * 1.15;
    for (let layer = 0; baseSide - 2 * layer >= 1; layer++) {
      const side = baseSide - 2 * layer;
      const layerSpacing = spacing * (1 + layer * 0.02);
      const layerBaseY = baseY + layer * layerHeight;
      for (let row = 0; row < side; row++) {
        for (let col = 0; col < side; col++) {
          const centerOffset = (side - 1) / 2;
          const baseX = (col - centerOffset) * layerSpacing + jitter();
          const baseZ = (row - centerOffset) * layerSpacing + jitter();
          const y = layerBaseY + Math.random() * 0.1;
          const cube = BABYLON.MeshBuilder.CreateBox(`item_${idx}`, {
            width: boxSize * (0.9 + Math.random() * 0.2),
            height: boxSize * 0.7,
            depth: boxSize * (0.8 + Math.random() * 0.2)
          }, this.scene);
          cube.position = new BABYLON.Vector3(baseX, y + boxSize * 0.35, baseZ);
          cube.rotation.y = rotJitter();
          cube.rotation.x = (Math.random() - 0.5) * 0.12;
          cube.rotation.z = (Math.random() - 0.5) * 0.12;
          const boxMat = new BABYLON.StandardMaterial(`itemMat_${idx}`, this.scene);
          boxMat.diffuseColor = new BABYLON.Color3(0.82 + Math.random() * 0.1, 0.78 + Math.random() * 0.1, 0.68 + Math.random() * 0.12);
          try {
            const tex = new BABYLON.Texture(cardboardTexturePath, this.scene);
            boxMat.diffuseTexture = tex;
          } catch (_) {}
          cube.material = boxMat;
          this.cajasMap.set(cube, cajaInfoMontana);
          cube.actionManager = new BABYLON.ActionManager(this.scene);
          cube.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
              document.body.style.cursor = 'pointer';
            })
          );
          cube.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
              document.body.style.cursor = 'default';
            })
          );
          cube.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => this.onCajaClick(cube))
          );
          idx++;
        }
      }
    }

    if (items.length === 0) {
      const label = BABYLON.MeshBuilder.CreatePlane('labelEmpty', { width: 4, height: 1 }, this.scene);
      label.position = new BABYLON.Vector3(0, 6, 0);
      label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      const dt = new BABYLON.DynamicTexture('labelTex', { width: 256, height: 64 }, this.scene);
      const ctx = dt.getContext() as CanvasRenderingContext2D;
      ctx.fillStyle = '#888';
      ctx.font = '22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Almacén vacío', 128, 32);
      dt.update();
      const lm = new BABYLON.StandardMaterial('labelMat', this.scene);
      lm.diffuseTexture = dt;
      lm.emissiveTexture = dt;
      label.material = lm;
      this.etiquetasEstanterias.set('empty', label);
    }
  }

  private actualizarItemsVistaSinEstructura(): void {
    this.cajasMap.forEach((_, mesh) => mesh.dispose());
    this.cajasMap.clear();
    this.etiquetasEstanterias.forEach((m) => m.dispose());
    this.etiquetasEstanterias.clear();
    ['labelEmpty'].forEach(name => {
      const m = this.scene.getMeshByName(name);
      if (m) m.dispose();
    });
    this.scene.meshes.filter(m => m.name.startsWith('item_')).forEach(m => m.dispose());
    this.crearVistaSinEstructura();
  }

  private setupResizeHandlers(): void {
    const canvas = this.renderCanvas.nativeElement;
    if (!canvas) return;
    
    const container = canvas.parentElement;
    if (!container) return;
    
    // ResizeObserver para detectar cambios en el tamaño del contenedor
    // Esto es crucial cuando el componente se oculta y se vuelve a mostrar
    this.resizeObserver = new ResizeObserver(() => {
      if (this.engine) {
        // Usar requestAnimationFrame para asegurar que el resize se haga en el momento correcto
        requestAnimationFrame(() => {
          this.engine.resize();
        });
      }
    });
    
    this.resizeObserver.observe(container);
    
    // Listener de window resize como fallback
    this.windowResizeListener = () => {
      if (this.engine) {
        requestAnimationFrame(() => {
          this.engine.resize();
        });
      }
    };
    
    window.addEventListener('resize', this.windowResizeListener);
    
    // Forzar un resize inicial después de un pequeño delay para asegurar que el canvas tenga el tamaño correcto
    setTimeout(() => {
      if (this.engine) {
        this.engine.resize();
      }
    }, 100);
  }

  private fixMouseCoordinates(): void {
    console.log('🔧 fixMouseCoordinates: Iniciando corrección de coordenadas...');
    
    // Esperar a que el canvas esté completamente renderizado
    setTimeout(() => {
      const canvas = this.renderCanvas.nativeElement;
      if (!canvas) {
        console.error('❌ fixMouseCoordinates: Canvas no encontrado');
        return;
      }
      
      console.log('✅ fixMouseCoordinates: Canvas encontrado, agregando listeners');
      // Ya no necesitamos zoomFactor porque el canvas-container tiene zoom: 1.25
      
      // Interceptar clicks y usar scene.pick() directamente
      // Ahora que el canvas-container tiene zoom: 1.25, compensa el zoom del body
      // Las coordenadas deberían estar correctas sin ajustes adicionales
      const handleClick = (e: MouseEvent) => {
        e.stopPropagation(); // Detener propagación para manejar manualmente
        e.preventDefault(); // Prevenir comportamiento por defecto
        
        const rect = canvas.getBoundingClientRect();
        
        // Calcular coordenadas relativas al canvas
        const relativeX = e.clientX - rect.left;
        const relativeY = e.clientY - rect.top;
        
        // Con zoom 1.25 en el contenedor, las coordenadas deberían estar correctas
        // Pero verificamos si hay diferencia entre canvas.width y rect.width
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const displayWidth = rect.width;
        const displayHeight = rect.height;
        
        // Solo ajustar si hay diferencia (por si acaso)
        const scaleX = canvasWidth / displayWidth;
        const scaleY = canvasHeight / displayHeight;
        
        const canvasX = relativeX * scaleX;
        const canvasY = relativeY * scaleY;
        
        console.log(`🖱️ Click: Visual(${relativeX.toFixed(1)}, ${relativeY.toFixed(1)}) → Canvas(${canvasX.toFixed(1)}, ${canvasY.toFixed(1)}) [Scale: ${scaleX.toFixed(2)}]`);
        
        // Usar scene.pick() con coordenadas
        const pickResult = this.scene.pick(canvasX, canvasY);
        
        if (pickResult && pickResult.hit && pickResult.pickedMesh) {
          const pickedMesh = pickResult.pickedMesh;
          console.log('🎯 Mesh encontrado:', pickedMesh.name);
          
          // Verificar si es una caja o un hijo de una caja (ej. la cinta)
          // Buscar en el mapa: primero el mesh directo, luego subir por la jerarquía de padres
          let foundCaja: BABYLON.Mesh | undefined;
          let meshToCheck: BABYLON.Node | null = pickedMesh;
          while (meshToCheck) {
            if (this.cajasMap.has(meshToCheck as BABYLON.Mesh)) {
              foundCaja = meshToCheck as BABYLON.Mesh;
              break;
            }
            meshToCheck = meshToCheck.parent;
          }
          
          if (foundCaja) {
            console.log('📦 Caja detectada!');
            this.onCajaClick(foundCaja);
          }
        } else {
          console.log('❌ No se encontró mesh en esa posición');
        }
      };
      
      // Interceptar eventos del mouse para ajustar coordenadas de la cámara
      // Con zoom 1.25 en el contenedor, las coordenadas deberían estar correctas
      const adjustMouseEvent = (e: MouseEvent | PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        const relativeX = (e as MouseEvent).clientX - rect.left;
        const relativeY = (e as MouseEvent).clientY - rect.top;
        
        // Calcular escala por si hay diferencia
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const canvasX = relativeX * scaleX;
        const canvasY = relativeY * scaleY;
        
        // Modificar el evento para que la cámara use las coordenadas correctas
        try {
          Object.defineProperty(e, 'offsetX', { 
            value: canvasX, 
            writable: true,
            configurable: true 
          });
          Object.defineProperty(e, 'offsetY', { 
            value: canvasY, 
            writable: true,
            configurable: true 
          });
        } catch (err) {
          // Ignorar errores
        }
      };
      
      // Agregar listener de click para manejar picking manualmente
      canvas.addEventListener('click', handleClick, true);
      
      // Agregar listeners para ajustar coordenadas de la cámara
      canvas.addEventListener('mousedown', adjustMouseEvent, true);
      canvas.addEventListener('mousemove', adjustMouseEvent, true);
      canvas.addEventListener('mouseup', adjustMouseEvent, true);
      canvas.addEventListener('pointerdown', adjustMouseEvent, true);
      canvas.addEventListener('pointermove', adjustMouseEvent, true);
      canvas.addEventListener('pointerup', adjustMouseEvent, true);
      
      console.log('✅ fixMouseCoordinates: Listeners agregados correctamente');
    }, 500);
  }

  private crearPiso(): void {
    // Tamaño del piso ajustado al espacio ocupado por las estanterías
    // Ancho: 2 filas (18 cada una) + 1 espacio (15) = 51, más un pequeño margen
    // Alto: 3 estanterías en profundidad (1.5 cada una) + 2 espacios (10 cada uno) = ~23, con margen mínimo
    const ground = BABYLON.MeshBuilder.CreateGround('ground', {
      width: 58,
      height: 25,
      subdivisions: 58
    }, this.scene);

    const groundMaterial = new BABYLON.StandardMaterial('groundMat', this.scene);
    
    // Color base de madera (marrón cálido)
    groundMaterial.diffuseColor = new BABYLON.Color3(0.75, 0.55, 0.38);
    groundMaterial.specularColor = new BABYLON.Color3(0.4, 0.3, 0.2);
    groundMaterial.specularPower = 32;
    
    // Agregar un poco de emisión para que se vea incluso en áreas oscuras
    groundMaterial.emissiveColor = new BABYLON.Color3(0.12, 0.08, 0.05);
    
    // Cargar textura de madera desde archivo
    const woodTexturePath = 'assets/textures/wood_table_diff_4k.jpg';
    const woodTexture = new BABYLON.Texture(woodTexturePath, this.scene);
    woodTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    woodTexture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    
    // Configurar escala para repetir la textura
    try {
      (woodTexture as any).uScale = 4.0; // Repetir la textura horizontalmente
      (woodTexture as any).vScale = 4.0; // Repetir la textura verticalmente
    } catch (e) {
      // Si no se puede configurar la escala, continuar sin ella
    }
    
    groundMaterial.diffuseTexture = woodTexture;
    
    ground.material = groundMaterial;
    ground.receiveShadows = false;
    ground.position.y = 0;
  }

  private crearEstanteria(offsetX: number = 0, offsetZ: number = 0, estanteriaId: string = 'E1', rotationY: number = 0): void {
    // Material metálico para la estructura
    const metalMaterial = new BABYLON.StandardMaterial(`metalMat_${offsetX}_${offsetZ}`, this.scene);
    metalMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.45);
    metalMaterial.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
    metalMaterial.specularPower = 64;
    
    // Cargar textura de metal desde archivo
    const metalTexturePath = 'assets/textures/metal_plate_diff_4k.jpg';
    const metalTexture = new BABYLON.Texture(metalTexturePath, this.scene);
    metalTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    metalTexture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    
    // Configurar escala para repetir la textura (ajustar según necesidad)
    try {
      (metalTexture as any).uScale = 8.0; // Repetir la textura horizontalmente
      (metalTexture as any).vScale = 8.0; // Repetir la textura verticalmente
    } catch (e) {
      // Si no se puede configurar la escala, continuar sin ella
    }
    
    metalMaterial.diffuseTexture = metalTexture;

    // Dimensiones de la estantería
    const anchoEstanteria = 18;
    const profundidadEstanteria = 1.5;
    const alturaTotal = 5;
    const alturaNivel = alturaTotal / this.niveles;
    const grosorTubo = 0.08;

    // Postes verticales (4 esquinas)
    const posiciones = [
      [-anchoEstanteria/2, -profundidadEstanteria/2],
      [anchoEstanteria/2, -profundidadEstanteria/2],
      [-anchoEstanteria/2, profundidadEstanteria/2],
      [anchoEstanteria/2, profundidadEstanteria/2]
    ];

    posiciones.forEach((pos, i) => {
      const poste = BABYLON.MeshBuilder.CreateBox(`poste_${offsetX}_${offsetZ}_${i}`, {
        width: grosorTubo,
        height: alturaTotal,
        depth: grosorTubo
      }, this.scene);
      const rotatedX = pos[0] * Math.cos(rotationY) - pos[1] * Math.sin(rotationY);
      const rotatedZ = pos[0] * Math.sin(rotationY) + pos[1] * Math.cos(rotationY);
      poste.position = new BABYLON.Vector3(rotatedX + offsetX, alturaTotal/2, rotatedZ + offsetZ);
      poste.material = metalMaterial;
    });

    // Estantes (superficies horizontales)
    for (let nivel = 0; nivel <= this.niveles; nivel++) {
      const estante = BABYLON.MeshBuilder.CreateBox(`estante_${offsetX}_${offsetZ}_${nivel}`, {
        width: anchoEstanteria,
        height: 0.05,
        depth: profundidadEstanteria
      }, this.scene);
      estante.position = new BABYLON.Vector3(offsetX, nivel * alturaNivel, offsetZ);
      estante.rotation.y = rotationY;
      estante.material = metalMaterial;

      // Barras laterales
      const barraFrontal = BABYLON.MeshBuilder.CreateBox(`barraFrontal_${offsetX}_${offsetZ}_${nivel}`, {
        width: anchoEstanteria,
        height: grosorTubo,
        depth: grosorTubo
      }, this.scene);
      barraFrontal.position = new BABYLON.Vector3(offsetX, nivel * alturaNivel, offsetZ - profundidadEstanteria/2);
      barraFrontal.rotation.y = rotationY;
      barraFrontal.material = metalMaterial;

      const barraTrasera = BABYLON.MeshBuilder.CreateBox(`barraTrasera_${offsetX}_${offsetZ}_${nivel}`, {
        width: anchoEstanteria,
        height: grosorTubo,
        depth: grosorTubo
      }, this.scene);
      barraTrasera.position = new BABYLON.Vector3(offsetX, nivel * alturaNivel, offsetZ + profundidadEstanteria/2);
      barraTrasera.rotation.y = rotationY;
      barraTrasera.material = metalMaterial;
    }

    // Barras verticales divisorias (según secciones de config)
    const secciones = Math.max(1, this.seccionesNombres.length);
    const anchoSeccion = anchoEstanteria / secciones;
    
    for (let i = 1; i < secciones; i++) {
      const localX = -anchoEstanteria/2 + i * anchoSeccion;
      const localFrontZ = -profundidadEstanteria/2;
      const localBackZ = profundidadEstanteria/2;
      const frontX = localX * Math.cos(rotationY) - localFrontZ * Math.sin(rotationY);
      const frontZ = localX * Math.sin(rotationY) + localFrontZ * Math.cos(rotationY);
      const backX = localX * Math.cos(rotationY) - localBackZ * Math.sin(rotationY);
      const backZ = localX * Math.sin(rotationY) + localBackZ * Math.cos(rotationY);
      
      // Barra vertical frontal
      const barraDivisoriaFrontal = BABYLON.MeshBuilder.CreateBox(`barraDivisoriaFrontal_${offsetX}_${offsetZ}_${i}`, {
        width: grosorTubo,
        height: alturaTotal,
        depth: grosorTubo
      }, this.scene);
      barraDivisoriaFrontal.position = new BABYLON.Vector3(frontX + offsetX, alturaTotal/2, frontZ + offsetZ);
      barraDivisoriaFrontal.rotation.y = rotationY;
      barraDivisoriaFrontal.material = metalMaterial;
      
      // Barra vertical trasera
      const barraDivisoriaTrasera = BABYLON.MeshBuilder.CreateBox(`barraDivisoriaTrasera_${offsetX}_${offsetZ}_${i}`, {
        width: grosorTubo,
        height: alturaTotal,
        depth: grosorTubo
      }, this.scene);
      barraDivisoriaTrasera.position = new BABYLON.Vector3(backX + offsetX, alturaTotal/2, backZ + offsetZ);
      barraDivisoriaTrasera.rotation.y = rotationY;
      barraDivisoriaTrasera.material = metalMaterial;
      
      // Conectar frontal y trasera con barras horizontales en cada nivel
      for (let nivel = 0; nivel <= this.niveles; nivel++) {
        const barraConexion = BABYLON.MeshBuilder.CreateBox(`barraConexion_${offsetX}_${offsetZ}_${i}_${nivel}`, {
          width: grosorTubo,
          height: grosorTubo,
          depth: profundidadEstanteria
        }, this.scene);
        const connX = localX * Math.cos(rotationY) - 0 * Math.sin(rotationY);
        const connZ = localX * Math.sin(rotationY) + 0 * Math.cos(rotationY);
        barraConexion.position = new BABYLON.Vector3(connX + offsetX, nivel * alturaNivel, connZ + offsetZ);
        barraConexion.rotation.y = rotationY;
        barraConexion.material = metalMaterial;
      }
    }
    
    // Crear etiqueta con el número de estantería
    this.crearEtiquetaEstanteria(offsetX, offsetZ, estanteriaId, alturaTotal);
    
    // Crear las cajas para esta estantería
    this.crearCajas(offsetX, offsetZ, estanteriaId, rotationY);
  }

  /** Recrea solo las cajas según layoutEstanterias (cuando stockData cambia) */
  private crearSoloCajasEnTodasLasEstanterias(): void {
    this.layoutEstanterias.forEach(({ offsetX, offsetZ, estanteriaId }) => {
      this.crearCajas(offsetX, offsetZ, estanteriaId);
    });
  }

  private crearEtiquetaEstanteria(offsetX: number, offsetZ: number, estanteriaId: string, alturaEstanteria: number): void {
    // Crear un plano para la etiqueta
    const labelPlane = BABYLON.MeshBuilder.CreatePlane(`label_${estanteriaId}`, {
      width: 2,
      height: 0.6
    }, this.scene);
    
    // Posicionar la etiqueta arriba de la estantería, centrada
    labelPlane.position = new BABYLON.Vector3(offsetX, alturaEstanteria + 0.4, offsetZ);
    
    // Hacer que la etiqueta siempre mire hacia la cámara
    labelPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    
    // Crear textura dinámica para el texto
    const labelTexture = new BABYLON.DynamicTexture(`labelTexture_${estanteriaId}`, {
      width: 256,
      height: 64
    }, this.scene);
    
    // Obtener el contexto del canvas
    const ctx = labelTexture.getContext() as CanvasRenderingContext2D;
    
    // Limpiar y configurar el contexto
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = '#4fc3f7'; // Color azul
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(estanteriaId, 128, 32);
    
    // Actualizar la textura
    labelTexture.update();
    
    // Crear material para la etiqueta
    const labelMaterial = new BABYLON.StandardMaterial(`labelMat_${estanteriaId}`, this.scene);
    labelMaterial.diffuseTexture = labelTexture;
    labelMaterial.emissiveTexture = labelTexture;
    labelMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.6, 0.9); // Azul brillante
    labelMaterial.backFaceCulling = false;
    labelMaterial.useAlphaFromDiffuseTexture = true;
    
    // Aplicar el material
    labelPlane.material = labelMaterial;
    
    // Guardar la etiqueta en el mapa para poder limpiarla después
    this.etiquetasEstanterias.set(estanteriaId, labelPlane);
  }

  private crearCajas(offsetX: number = 0, offsetZ: number = 0, estanteriaId: string = 'E1', rotationY: number = 0): void {
    const anchoEstanteria = 18;
    const profundidadEstanteria = 1.5;
    const alturaTotal = 5;
    const alturaNivel = alturaTotal / this.niveles;
    
    const secciones = Math.max(1, this.seccionesNombres.length);
    const cajasPorSeccion = 2;
    const anchoSeccion = anchoEstanteria / secciones;
    const margenSeccion = 0.15; // Margen en cada lado de la sección
    const anchoDisponible = anchoSeccion - (2 * margenSeccion);
    const espacioEntreCajas = 0.1; // Espacio entre las 2 cajas
    const anchoCaja = (anchoDisponible - espacioEntreCajas) / cajasPorSeccion;
    const altoCaja = alturaNivel * 0.7;
    const profundoCaja = profundidadEstanteria * 0.8;

    for (let nivel = 0; nivel < this.niveles; nivel++) {
      const estanteNum = nivel + 1; // Estante 1, 2, 3
      for (let seccion = 0; seccion < secciones; seccion++) {
        const seccionNombre = this.seccionesNombres[seccion];
        
        // Verificar si hay stock en esta estantería/estante/sección
        const tieneStock = this.tieneStockEnUbicacion(estanteriaId, estanteNum.toString(), seccionNombre);
        
        // Solo crear cajas si hay stock
        if (!tieneStock) {
          continue;
        }
        
        // Obtener items de stock para esta ubicación
        const itemsStock = this.getItemsStockEnUbicacion(estanteriaId, estanteNum.toString(), seccionNombre);
        
        for (let posEnSeccion = 0; posEnSeccion < cajasPorSeccion; posEnSeccion++) {
          // Calcular posición X dentro de la sección
          const inicioSeccion = -anchoEstanteria/2 + seccion * anchoSeccion;
          const xPosEnSeccion = inicioSeccion + margenSeccion + anchoCaja/2 + posEnSeccion * (anchoCaja + espacioEntreCajas);
          const yPos = nivel * alturaNivel + 0.05 + altoCaja/2;
          
          const caja = BABYLON.MeshBuilder.CreateBox(`caja_${offsetX}_${offsetZ}_${nivel}_${seccion}_${posEnSeccion}`, {
            width: anchoCaja * 0.85,
            height: altoCaja,
            depth: profundoCaja
          }, this.scene);

          const rotX = xPosEnSeccion * Math.cos(rotationY) - 0 * Math.sin(rotationY);
          const rotZ = xPosEnSeccion * Math.sin(rotationY) + 0 * Math.cos(rotationY);
          caja.position = new BABYLON.Vector3(rotX + offsetX, yPos, rotZ + offsetZ);
          caja.rotation.y = rotationY;

          // Material de caja de cartón
          const cajaMaterial = new BABYLON.StandardMaterial(`cajaMat_${offsetX}_${offsetZ}_${nivel}_${seccion}_${posEnSeccion}`, this.scene);
          cajaMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9); // Color base claro
          cajaMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
          
          // Cargar textura de cartón desde archivo
          const cardboardTexturePath = 'assets/textures/cardboard.jpg';
          const cardboardTexture = new BABYLON.Texture(cardboardTexturePath, this.scene);
          cardboardTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
          cardboardTexture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
          
          // Configurar escala para repetir la textura
          try {
            (cardboardTexture as any).uScale = 2.0; // Repetir la textura horizontalmente
            (cardboardTexture as any).vScale = 2.0; // Repetir la textura verticalmente
          } catch (e) {
            // Si no se puede configurar la escala, continuar sin ella
          }
          
          cajaMaterial.diffuseTexture = cardboardTexture;
          
          caja.material = cajaMaterial;

          // Crear bordes de la caja
          this.crearBordesCaja(caja, anchoCaja * 0.85, altoCaja, profundoCaja);

          // Guardar info de la caja
          const cajaInfo: CajaInfo = {
            estanteria: estanteriaId,
            nivel: nivel + 1,
            posicion: seccion + 1, // Posición es la sección (1, 2, 3)
            seccion: seccionNombre,
            contenido: itemsStock || []
          };
          this.cajasMap.set(caja, cajaInfo);

          // Hacer la caja interactiva
          caja.actionManager = new BABYLON.ActionManager(this.scene);
          
          // Highlight al pasar el mouse
          caja.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(
              BABYLON.ActionManager.OnPointerOverTrigger,
              () => {
                (caja.material as BABYLON.StandardMaterial).emissiveColor = new BABYLON.Color3(0.2, 0.15, 0.1);
                document.body.style.cursor = 'pointer';
              }
            )
          );

          caja.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(
              BABYLON.ActionManager.OnPointerOutTrigger,
              () => {
                (caja.material as BABYLON.StandardMaterial).emissiveColor = new BABYLON.Color3(0, 0, 0);
                document.body.style.cursor = 'default';
              }
            )
          );

          // Click en la caja
          caja.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(
              BABYLON.ActionManager.OnPickTrigger,
              () => {
                this.onCajaClick(caja);
              }
            )
          );
        }
      }
    }
  }

  private crearBordesCaja(caja: BABYLON.Mesh, ancho: number, alto: number, profundo: number): void {
    const bordeColor = new BABYLON.Color3(0.4, 0.3, 0.2);
    const bordeMaterial = new BABYLON.StandardMaterial('bordeMat', this.scene);
    bordeMaterial.diffuseColor = bordeColor;
    
    // Cinta superior
    const cintaSuperior = BABYLON.MeshBuilder.CreateBox('cinta', {
      width: ancho * 0.15,
      height: alto + 0.02,
      depth: profundo + 0.02
    }, this.scene);
    cintaSuperior.position = caja.position.clone();
    cintaSuperior.material = bordeMaterial;
    cintaSuperior.parent = caja;
    cintaSuperior.position = BABYLON.Vector3.Zero();

    // Hover en la cinta: resaltar la caja padre y mostrar cursor pointer
    cintaSuperior.actionManager = new BABYLON.ActionManager(this.scene);
    cintaSuperior.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, () => {
        if (caja.material instanceof BABYLON.StandardMaterial) {
          caja.material.emissiveColor = new BABYLON.Color3(0.2, 0.15, 0.1);
        }
        document.body.style.cursor = 'pointer';
      })
    );
    cintaSuperior.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, () => {
        if (caja.material instanceof BABYLON.StandardMaterial) {
          caja.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
        }
        document.body.style.cursor = 'default';
      })
    );
  }

  private crearEtiquetas(): void {
    // Crear un plano con textura dinámica para el título
    const labelPlane = BABYLON.MeshBuilder.CreatePlane('label', {
      width: 3,
      height: 0.8
    }, this.scene);
    labelPlane.position = new BABYLON.Vector3(0, 5.5, 0);
    labelPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const labelTexture = new BABYLON.DynamicTexture('labelTexture', {
      width: 512,
      height: 128
    }, this.scene);
    
    const labelMaterial = new BABYLON.StandardMaterial('labelMat', this.scene);
    labelMaterial.diffuseTexture = labelTexture;
    labelMaterial.emissiveTexture = labelTexture;
    labelMaterial.backFaceCulling = false;
    labelMaterial.useAlphaFromDiffuseTexture = true;
    labelPlane.material = labelMaterial;

    // Obtener el contexto y castearlo al tipo correcto
    const ctx = labelTexture.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 512, 128);
    
    ctx.font = 'bold 60px Arial';
    ctx.fillStyle = '#4fc3f7';
    ctx.textAlign = 'center';
    ctx.fillText(this.almacenId, 256, 80);
    
    labelTexture.update();
  }

  private configurarPicking(): void {
    // El picking ya está configurado en los ActionManagers de cada caja
  }

  private onCajaClick(caja: BABYLON.Mesh): void {
    const info = this.cajasMap.get(caja);
    if (info) {
      if (info.estanteria === 'Montaña') {
        const infoConContenido: CajaInfo = {
          ...info,
          contenido: [...(this.stockData || [])]
        };
        this.cajaSeleccionada.emit(infoConContenido);
      } else {
        this.cajaSeleccionada.emit(info);
      }
    }
  }

  /**
   * Verifica si hay stock en una ubicación específica (estantería/estante/sección)
   * REQUIERE que el item tenga sección para mostrar cajas
   */
  private tieneStockEnUbicacion(estanteria: string, estante: string, seccion: string): boolean {
    if (!this.stockData || this.stockData.length === 0) {
      console.log(`❌ No hay stockData para verificar ${estanteria}/${estante}/${seccion}`);
      return false;
    }
    
    const resultado = this.stockData.some(item => {
      const itemEstanteria = item.estanteria?.toString().toUpperCase().trim();
      const itemEstante = item.estante?.toString().trim();
      const itemSeccion = item.seccion?.toString().toLowerCase().trim();
      
      // REQUERIR que el item tenga sección - si no tiene sección, no se muestra
      if (!itemSeccion || itemSeccion === '') {
        return false;
      }
      
      // Verificar que coincida estantería, estante Y sección
      const coincide = itemEstanteria === estanteria.toUpperCase() &&
             itemEstante === estante &&
             itemSeccion === seccion.toLowerCase();
      if (coincide) {
        console.log(`✅ Stock encontrado en ${estanteria}/${estante}/${seccion}:`, item);
      }
      return coincide;
    });
    
    if (!resultado) {
      console.log(`❌ No hay stock en ${estanteria}/${estante}/${seccion}. StockData disponible:`, 
        this.stockData.map(item => ({
          estanteria: item.estanteria,
          estante: item.estante,
          seccion: item.seccion
        }))
      );
    }
    
    return resultado;
  }

  /**
   * Obtiene los items de stock en una ubicación específica
   * REQUIERE que el item tenga sección para incluirlo
   */
  private getItemsStockEnUbicacion(estanteria: string, estante: string, seccion: string): any[] {
    if (!this.stockData || this.stockData.length === 0) {
      return [];
    }
    
    return this.stockData.filter(item => {
      const itemEstanteria = item.estanteria?.toString().toUpperCase().trim();
      const itemEstante = item.estante?.toString().trim();
      const itemSeccion = item.seccion?.toString().toLowerCase().trim();
      
      // REQUERIR que el item tenga sección - si no tiene sección, no se incluye
      if (!itemSeccion || itemSeccion === '') {
        return false;
      }
      
      // Verificar que coincida estantería, estante Y sección
      return itemEstanteria === estanteria.toUpperCase() &&
             itemEstante === estante &&
             itemSeccion === seccion.toLowerCase();
    });
  }

  // Método público para actualizar contenido de una caja
  // Actualiza todas las cajas de la misma sección (posicion) y nivel
  public actualizarContenidoCaja(nivel: number, posicion: number, contenido: any[]): void {
    this.cajasMap.forEach((info, mesh) => {
      // posicion ahora representa la sección (1, 2, o 3)
      if (info.nivel === nivel && info.posicion === posicion) {
        info.contenido = contenido;
        
        // Ajustar color con tinte sutil si tiene contenido (la textura se mantiene)
        const mat = mesh.material as BABYLON.StandardMaterial;
        if (contenido && contenido.length > 0) {
          mat.diffuseColor = new BABYLON.Color3(0.8, 0.95, 0.8); // Tinte verde sutil si tiene contenido
        } else {
          mat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9); // Color base neutro para cartón
        }
      }
    });
  }

  // Método para resetear la vista de la cámara
  public resetearCamara(): void {
    this.camera.alpha = -Math.PI / 2;
    this.camera.beta = Math.PI / 3;
    this.camera.radius = 15;
  }
}

