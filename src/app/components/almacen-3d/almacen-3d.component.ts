import { Component, OnInit, OnDestroy, ElementRef, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';

export interface CajaInfo {
  estanteria: string;
  nivel: number;
  posicion: number;
  contenido?: any[];
}

@Component({
  selector: 'app-almacen-3d',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './almacen-3d.component.html',
  styleUrls: ['./almacen-3d.component.css']
})
export class Almacen3DComponent implements OnInit, OnDestroy {
  @ViewChild('renderCanvas', { static: true }) renderCanvas!: ElementRef<HTMLCanvasElement>;
  
  @Input() almacenId: string = 'ALM03';
  @Input() estanteriaId: string = 'A1';
  @Input() niveles: number = 3;
  @Input() cajasporNivel: number = 4;
  
  @Output() cajaSeleccionada = new EventEmitter<CajaInfo>();
  
  private engine!: BABYLON.Engine;
  private scene!: BABYLON.Scene;
  private camera!: BABYLON.ArcRotateCamera;
  private cajasMap: Map<BABYLON.Mesh, CajaInfo> = new Map();
  
  // Colores para los niveles
  private nivelesColores = [
    new BABYLON.Color3(0.8, 0.6, 0.4),  // Marrón claro
    new BABYLON.Color3(0.7, 0.5, 0.3),  // Marrón medio
    new BABYLON.Color3(0.6, 0.4, 0.2),  // Marrón oscuro
  ];

  ngOnInit(): void {
    this.initBabylon();
  }

  ngOnDestroy(): void {
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

    // Crear cámara orbital
    this.camera = new BABYLON.ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 3,
      15,
      new BABYLON.Vector3(0, 2, 0),
      this.scene
    );
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 5;
    this.camera.upperRadiusLimit = 30;
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

    // Crear la estantería metálica
    this.crearEstanteria();

    // Crear las cajas
    this.crearCajas();

    // Crear etiquetas
    this.crearEtiquetas();

    // Configurar picking (clicks)
    this.configurarPicking();

    // Iniciar el render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    // Manejar resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  private crearPiso(): void {
    const ground = BABYLON.MeshBuilder.CreateGround('ground', {
      width: 20,
      height: 20
    }, this.scene);

    const groundMaterial = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.35);
    groundMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    ground.material = groundMaterial;
  }

  private crearEstanteria(): void {
    // Material metálico para la estructura
    const metalMaterial = new BABYLON.StandardMaterial('metalMat', this.scene);
    metalMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.45);
    metalMaterial.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
    metalMaterial.specularPower = 64;

    // Dimensiones de la estantería
    const anchoEstanteria = 6;
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
      const poste = BABYLON.MeshBuilder.CreateBox(`poste${i}`, {
        width: grosorTubo,
        height: alturaTotal,
        depth: grosorTubo
      }, this.scene);
      poste.position = new BABYLON.Vector3(pos[0], alturaTotal/2, pos[1]);
      poste.material = metalMaterial;
    });

    // Estantes (superficies horizontales)
    for (let nivel = 0; nivel <= this.niveles; nivel++) {
      const estante = BABYLON.MeshBuilder.CreateBox(`estante${nivel}`, {
        width: anchoEstanteria,
        height: 0.05,
        depth: profundidadEstanteria
      }, this.scene);
      estante.position = new BABYLON.Vector3(0, nivel * alturaNivel, 0);
      estante.material = metalMaterial;

      // Barras laterales
      const barraFrontal = BABYLON.MeshBuilder.CreateBox(`barraFrontal${nivel}`, {
        width: anchoEstanteria,
        height: grosorTubo,
        depth: grosorTubo
      }, this.scene);
      barraFrontal.position = new BABYLON.Vector3(0, nivel * alturaNivel, -profundidadEstanteria/2);
      barraFrontal.material = metalMaterial;

      const barraTrasera = BABYLON.MeshBuilder.CreateBox(`barraTrasera${nivel}`, {
        width: anchoEstanteria,
        height: grosorTubo,
        depth: grosorTubo
      }, this.scene);
      barraTrasera.position = new BABYLON.Vector3(0, nivel * alturaNivel, profundidadEstanteria/2);
      barraTrasera.material = metalMaterial;
    }

    // Barras de refuerzo diagonales en los laterales
    this.crearRefuerzosLaterales(metalMaterial, anchoEstanteria, profundidadEstanteria, alturaTotal);
  }

  private crearRefuerzosLaterales(material: BABYLON.StandardMaterial, ancho: number, profundidad: number, altura: number): void {
    // Barras de refuerzo en X en la parte trasera
    for (let nivel = 0; nivel < this.niveles; nivel++) {
      const alturaInicio = nivel * (altura / this.niveles);
      const alturaNivel = altura / this.niveles;
      
      // Barra diagonal izquierda
      const refuerzoIzq = BABYLON.MeshBuilder.CreateBox(`refuerzoIzq${nivel}`, {
        width: 0.04,
        height: Math.sqrt(alturaNivel * alturaNivel + (ancho/2) * (ancho/2)) * 0.5,
        depth: 0.04
      }, this.scene);
      refuerzoIzq.position = new BABYLON.Vector3(-ancho/4, alturaInicio + alturaNivel/2, profundidad/2);
      refuerzoIzq.rotation.z = Math.PI / 6;
      refuerzoIzq.material = material;
    }
  }

  private crearCajas(): void {
    const anchoEstanteria = 6;
    const profundidadEstanteria = 1.5;
    const alturaTotal = 5;
    const alturaNivel = alturaTotal / this.niveles;
    
    const anchoCaja = (anchoEstanteria - 0.5) / this.cajasporNivel;
    const altoCaja = alturaNivel * 0.7;
    const profundoCaja = profundidadEstanteria * 0.8;

    for (let nivel = 0; nivel < this.niveles; nivel++) {
      for (let pos = 0; pos < this.cajasporNivel; pos++) {
        const caja = BABYLON.MeshBuilder.CreateBox(`caja_${nivel}_${pos}`, {
          width: anchoCaja * 0.85,
          height: altoCaja,
          depth: profundoCaja
        }, this.scene);

        // Posicionar la caja
        const xPos = -anchoEstanteria/2 + anchoCaja/2 + pos * anchoCaja + 0.25;
        const yPos = nivel * alturaNivel + 0.05 + altoCaja/2;
        caja.position = new BABYLON.Vector3(xPos, yPos, 0);

        // Material de caja de cartón
        const cajaMaterial = new BABYLON.StandardMaterial(`cajaMat_${nivel}_${pos}`, this.scene);
        cajaMaterial.diffuseColor = this.nivelesColores[nivel % this.nivelesColores.length];
        cajaMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        
        // Agregar textura de cartón (patrón procedural)
        const noiseTexture = new BABYLON.NoiseProceduralTexture(`noise_${nivel}_${pos}`, 256, this.scene);
        noiseTexture.animationSpeedFactor = 0;
        noiseTexture.persistence = 0.8;
        noiseTexture.brightness = 0.5;
        noiseTexture.octaves = 3;
        cajaMaterial.bumpTexture = noiseTexture;
        cajaMaterial.bumpTexture.level = 0.3;
        
        caja.material = cajaMaterial;

        // Crear bordes de la caja
        this.crearBordesCaja(caja, anchoCaja * 0.85, altoCaja, profundoCaja);

        // Guardar info de la caja
        const cajaInfo: CajaInfo = {
          estanteria: this.estanteriaId,
          nivel: nivel + 1,
          posicion: pos + 1,
          contenido: []
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
    ctx.fillText(`${this.almacenId} - Estantería ${this.estanteriaId}`, 256, 80);
    
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

  // Método público para actualizar contenido de una caja
  public actualizarContenidoCaja(nivel: number, posicion: number, contenido: any[]): void {
    this.cajasMap.forEach((info, mesh) => {
      if (info.nivel === nivel && info.posicion === posicion) {
        info.contenido = contenido;
        
        // Cambiar color si tiene contenido
        const mat = mesh.material as BABYLON.StandardMaterial;
        if (contenido && contenido.length > 0) {
          mat.diffuseColor = new BABYLON.Color3(0.3, 0.6, 0.3); // Verde si tiene contenido
        } else {
          mat.diffuseColor = this.nivelesColores[(nivel - 1) % this.nivelesColores.length];
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

