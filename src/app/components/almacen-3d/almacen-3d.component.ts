import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, ElementRef, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';

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

@Component({
  selector: 'app-almacen-3d',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './almacen-3d.component.html',
  styleUrls: ['./almacen-3d.component.css']
})
export class Almacen3DComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('renderCanvas', { static: true }) renderCanvas!: ElementRef<HTMLCanvasElement>;
  
  @Input() almacenId: string = 'ALM03';
  @Input() estanteriaId: string = 'A1';
  @Input() niveles: number = 3;
  @Input() cajasporNivel: number = 4;
  @Input() stockData: StockItem[] = []; // Datos de stock para filtrar cajas
  
  @Output() cajaSeleccionada = new EventEmitter<CajaInfo>();
  
  private engine!: BABYLON.Engine;
  private scene!: BABYLON.Scene;
  private camera!: BABYLON.ArcRotateCamera;
  private cajasMap: Map<BABYLON.Mesh, CajaInfo> = new Map();
  private etiquetasEstanterias: Map<string, BABYLON.Mesh> = new Map(); // Mapa para rastrear etiquetas de estanterías
  private resizeObserver?: ResizeObserver;
  private windowResizeListener?: () => void;
  
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
    // Si cambian los datos de stock, necesitamos recrear las cajas
    if (changes['stockData'] && this.scene) {
      console.log('🔄 Cambios en stockData detectados:', {
        firstChange: changes['stockData'].firstChange,
        previousValue: changes['stockData'].previousValue?.length || 0,
        currentValue: changes['stockData'].currentValue?.length || 0,
        stockData: this.stockData
      });
      
      // Limpiar cajas existentes
      this.cajasMap.forEach((info, mesh) => {
        mesh.dispose();
      });
      this.cajasMap.clear();
      
      // Limpiar etiquetas de estanterías existentes
      this.etiquetasEstanterias.forEach((mesh) => {
        mesh.dispose();
      });
      this.etiquetasEstanterias.clear();
      
      // Recrear las cajas con los nuevos datos
      const numFilas = 2;
      const anchoEstanteria = 18;
      const espacioEntreFilas = 15;
      const profundidadEstanteria = 1.5;
      const espacioEntreEstanterias = 10;
      const anchoTotalFilas = numFilas * anchoEstanteria + (numFilas - 1) * espacioEntreFilas;
      const offsetInicialX = -anchoTotalFilas / 2 + anchoEstanteria / 2;
      
      let estanteriaNum = 1;
      for (let fila = 0; fila < numFilas; fila++) {
        const offsetX = offsetInicialX + fila * (anchoEstanteria + espacioEntreFilas);
        this.crearEstanteria(offsetX, -profundidadEstanteria - espacioEntreEstanterias / 2, `E${estanteriaNum++}`);
        this.crearEstanteria(offsetX, 0, `E${estanteriaNum++}`);
        this.crearEstanteria(offsetX, profundidadEstanteria + espacioEntreEstanterias / 2, `E${estanteriaNum++}`);
      }
      
      console.log('✅ Cajas recreadas. Total cajas:', this.cajasMap.size);
    }
  }

  ngOnDestroy(): void {
    // Limpiar listeners de resize
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
    
    // Crear el engine
    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });

    // Crear la escena
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.15, 1);

    // Crear cámara orbital - ajustada para ver las 3 estanterías
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

    // Luces
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

    // Crear el piso
    this.crearPiso();

    // Crear 2 filas de estanterías, cada una con 3 estanterías a lo ancho (eje Z)
    const espacioEntreEstanterias = 10; // Espacio entre estanterías en profundidad (eje Z)
    const espacioEntreFilas = 15; // Espacio entre filas a lo largo (eje X) - reducido
    const profundidadEstanteria = 1.5;
    const anchoEstanteria = 18;
    const numFilas = 2;
    
    // Calcular el ancho total ocupado por las filas
    const anchoTotalFilas = numFilas * anchoEstanteria + (numFilas - 1) * espacioEntreFilas;
    
    // Calcular el offset inicial para centrar las filas
    const offsetInicialX = -anchoTotalFilas / 2 + anchoEstanteria / 2;
    
    // Crear 2 filas de estanterías (6 estanterías en total: E1-E6)
    // Fila 0: E1 (frontal), E2 (central), E3 (trasera)
    // Fila 1: E4 (frontal), E5 (central), E6 (trasera)
    let estanteriaNum = 1;
    for (let fila = 0; fila < numFilas; fila++) {
      const offsetX = offsetInicialX + fila * (anchoEstanteria + espacioEntreFilas);
      
      // Crear estantería frontal (más cercana a la cámara)
      this.crearEstanteria(offsetX, -profundidadEstanteria - espacioEntreEstanterias / 2, `E${estanteriaNum++}`);
      
      // Crear estantería central
      this.crearEstanteria(offsetX, 0, `E${estanteriaNum++}`);
      
      // Crear estantería trasera (más lejana de la cámara)
      this.crearEstanteria(offsetX, profundidadEstanteria + espacioEntreEstanterias / 2, `E${estanteriaNum++}`);
    }

    // Configurar picking (clicks)
    this.configurarPicking();

    // Corregir coordenadas del mouse para compensar el zoom del body
    this.fixMouseCoordinates();

    // Iniciar el render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    // El resize se maneja en setupResizeHandlers()
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
          
          // Verificar si es una caja - buscar en el mapa
          // Como cajasMap usa Mesh, necesitamos buscar el mesh correcto
          let foundCaja: BABYLON.Mesh | undefined;
          this.cajasMap.forEach((info, mesh) => {
            if (mesh === pickedMesh) {
              foundCaja = mesh;
            }
          });
          
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

  private crearEstanteria(offsetX: number = 0, offsetZ: number = 0, estanteriaId: string = 'E1'): void {
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
      poste.position = new BABYLON.Vector3(pos[0] + offsetX, alturaTotal/2, pos[1] + offsetZ);
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
      estante.material = metalMaterial;

      // Barras laterales
      const barraFrontal = BABYLON.MeshBuilder.CreateBox(`barraFrontal_${offsetX}_${offsetZ}_${nivel}`, {
        width: anchoEstanteria,
        height: grosorTubo,
        depth: grosorTubo
      }, this.scene);
      barraFrontal.position = new BABYLON.Vector3(offsetX, nivel * alturaNivel, offsetZ - profundidadEstanteria/2);
      barraFrontal.material = metalMaterial;

      const barraTrasera = BABYLON.MeshBuilder.CreateBox(`barraTrasera_${offsetX}_${offsetZ}_${nivel}`, {
        width: anchoEstanteria,
        height: grosorTubo,
        depth: grosorTubo
      }, this.scene);
      barraTrasera.position = new BABYLON.Vector3(offsetX, nivel * alturaNivel, offsetZ + profundidadEstanteria/2);
      barraTrasera.material = metalMaterial;
    }

    // Barras verticales divisorias (dividen en 3 secciones)
    const secciones = 3;
    const anchoSeccion = anchoEstanteria / secciones;
    
    for (let i = 1; i < secciones; i++) {
      const xPos = offsetX + (-anchoEstanteria/2 + i * anchoSeccion);
      
      // Barra vertical frontal
      const barraDivisoriaFrontal = BABYLON.MeshBuilder.CreateBox(`barraDivisoriaFrontal_${offsetX}_${offsetZ}_${i}`, {
        width: grosorTubo,
        height: alturaTotal,
        depth: grosorTubo
      }, this.scene);
      barraDivisoriaFrontal.position = new BABYLON.Vector3(xPos, alturaTotal/2, offsetZ - profundidadEstanteria/2);
      barraDivisoriaFrontal.material = metalMaterial;
      
      // Barra vertical trasera
      const barraDivisoriaTrasera = BABYLON.MeshBuilder.CreateBox(`barraDivisoriaTrasera_${offsetX}_${offsetZ}_${i}`, {
        width: grosorTubo,
        height: alturaTotal,
        depth: grosorTubo
      }, this.scene);
      barraDivisoriaTrasera.position = new BABYLON.Vector3(xPos, alturaTotal/2, offsetZ + profundidadEstanteria/2);
      barraDivisoriaTrasera.material = metalMaterial;
      
      // Conectar frontal y trasera con barras horizontales en cada nivel
      for (let nivel = 0; nivel <= this.niveles; nivel++) {
        const barraConexion = BABYLON.MeshBuilder.CreateBox(`barraConexion_${offsetX}_${offsetZ}_${i}_${nivel}`, {
          width: grosorTubo,
          height: grosorTubo,
          depth: profundidadEstanteria
        }, this.scene);
        barraConexion.position = new BABYLON.Vector3(xPos, nivel * alturaNivel, offsetZ);
        barraConexion.material = metalMaterial;
      }
    }
    
    // Crear etiqueta con el número de estantería
    this.crearEtiquetaEstanteria(offsetX, offsetZ, estanteriaId, alturaTotal);
    
    // Crear las cajas para esta estantería
    this.crearCajas(offsetX, offsetZ, estanteriaId);
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

  private crearCajas(offsetX: number = 0, offsetZ: number = 0, estanteriaId: string = 'E1'): void {
    const anchoEstanteria = 18;
    const profundidadEstanteria = 1.5;
    const alturaTotal = 5;
    const alturaNivel = alturaTotal / this.niveles;
    
    // 3 secciones (a, b, c), 2 cajas por sección
    const secciones = 3;
    const seccionesNombres = ['a', 'b', 'c'];
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
        const seccionNombre = seccionesNombres[seccion];
        
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

          caja.position = new BABYLON.Vector3(xPosEnSeccion + offsetX, yPos, offsetZ);

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
      console.log('Caja seleccionada:', info);
      this.cajaSeleccionada.emit(info);
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

