# Modelos 3D

Esta carpeta contiene los archivos de modelos 3D utilizados en la aplicación.

## Estructura

- **Cajas**: Modelos Blender (.blend) y archivos exportados (GLTF, GLB, OBJ, etc.) para las cajas del almacén
- **Estanterías**: Modelos de estanterías si se requieren en el futuro
- **Otros**: Cualquier otro modelo 3D necesario

## Formatos soportados

Babylon.js soporta varios formatos de modelos 3D:

### ⭐ **GLB** (MÁS RECOMENDADO para estanterías)
- ✅ **Un solo archivo**: Incluye modelo + texturas + materiales
- ✅ **Optimizado para web**: Carga rápida, pequeño tamaño
- ✅ **Estándar web**: glTF 2.0, formato moderno
- ✅ **Soporte PBR completo**: Materiales físicamente realistas
- ✅ **Ya usado en el proyecto**: Compatible con el código actual
- 📦 **Ideal para**: Estanterías con texturas embebidas

### GLTF (Alternativa a GLB)
- ✅ Similar a GLB pero formato JSON (legible)
- ⚠️ **Requiere archivos externos** para texturas (.bin, .jpg)
- 📦 **Ideal para**: Si necesitas editar el JSON manualmente

### FBX
- ✅ Formato muy común en la industria
- ⚠️ **Requiere conversión**: Mejor exportar a GLB desde Blender
- ⚠️ Puede perder información de materiales
- 📦 **Ideal para**: Modelos que necesitas importar a Blender primero

### USDZ
- ✅ Formato de Apple (AR/Quick Look)
- ❌ **NO soportado directamente** en Babylon.js
- ⚠️ Requiere conversión previa a GLB
- 📦 **NO recomendado** para este proyecto

### OBJ
- ✅ Formato simple y común
- ⚠️ **Solo geometría**: Sin materiales/texturas complejos
- ⚠️ No soporta animaciones
- 📦 **Ideal para**: Modelos simples sin texturas

## Exportar desde Blender

Si tienes un archivo `.blend`, necesitarás exportarlo a un formato compatible:

1. Abre el archivo `.blend` en Blender
2. Ve a `File > Export > glTF 2.0 (.glb/.gltf)`
3. Recomendado: Exporta como `.glb` (binario, un solo archivo)
4. Guarda el archivo exportado en esta carpeta

## Uso en el código

```typescript
import '@babylonjs/loaders';

// Cargar modelo GLTF/GLB
BABYLON.SceneLoader.ImportMesh(
  '',
  'assets/models/',
  'caja.glb',
  this.scene,
  (meshes) => {
    // Manipular los meshes cargados
  }
);
```

## Notas

- Mantén los archivos organizados en subcarpetas según el tipo de objeto
- Los archivos `.glb` son preferibles sobre `.gltf` ya que incluyen todas las texturas en un solo archivo
- Comprime las texturas si el modelo es muy pesado para mejorar el rendimiento

