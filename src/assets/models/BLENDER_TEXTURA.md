# Cómo Aplicar Textura en Blender y Exportar a GLB

## Pasos para Aplicar la Textura en Blender

### Paso 1: Abrir el archivo
- Abre Blender y carga el archivo `cardboard_box_01_4k.blend`

### Paso 2: Seleccionar el objeto
- Haz clic en la caja en la vista 3D para seleccionarla (debe verse con un borde naranja)

### Paso 3: Abrir el Shader Editor
Hay varias formas de abrir el Shader Editor:

**Opción A - Desde la barra superior:**
1. Mira la barra superior de pestañas (justo debajo de la barra de menú)
2. Busca la pestaña que dice **"Shading"** o **"Shader Editor"**
3. Haz clic en ella

**Opción B - Cambiar el layout:**
1. En la esquina superior izquierda del área de trabajo, verás un menú desplegable (puede decir "Layout", "Modeling", etc.)
2. Haz clic y selecciona **"Shading"**

**Opción C - Dividir la ventana:**
1. Haz clic derecho en el borde de una ventana existente
2. Selecciona "Split Area" o presiona `Shift + Click derecho`
3. En la nueva ventana, haz clic en el icono del editor (esquina superior izquierda de la ventana)
4. Selecciona **"Shader Editor"**

### Paso 4: Crear/Seleccionar Material
- En el Shader Editor, deberías ver nodos conectados (como "Principled BSDF" y "Material Output")
- Si no hay nada, ve al panel derecho donde está el icono de una **esfera** (Material Properties)
- Haz clic en "New" para crear un material nuevo

### Paso 5: Aplicar la Textura

**Tienes dos opciones: configuración básica o avanzada (PBR completo)**

#### Opción A: Configuración Básica (Solo Color)
1. En el **Shader Editor**:
   - Presiona `Shift + A` (o haz clic derecho) para abrir el menú "Add"
   - Ve a `Texture > Image Texture`
   - Se agregará un nodo "Image Texture" al editor

2. **Cargar la imagen:**
   - En el nodo "Image Texture" que acabas de agregar
   - Haz clic en el botón **"Open"** o en el icono de carpeta 📁
   - Busca y selecciona `cardboard_box_01_diff_4k.jpg` (debe estar en la misma carpeta o donde lo guardaste)

3. **Conectar los nodos:**
   - Deberías ver dos nodos: "Principled BSDF" y "Image Texture"
   - Haz clic y arrastra desde el círculo **"Color"** (salida) del nodo "Image Texture"
   - Suéltalo en el círculo **"Base Color"** (entrada) del nodo "Principled BSDF"
   - También puedes conectar "Alpha" a "Alpha" si la textura tiene transparencia

#### Opción B: Configuración Avanzada PBR (Como en la imagen)
Esta configuración incluye múltiples texturas para un resultado más realista.

**Paso 5.1: Crear los nodos de coordenadas**
1. Presiona `Shift + A` y ve a `Input > Texture Coordinate`
   - Aparecerá un nodo "Texture Coordinate"
   - ✅ Asegúrate de que la casilla **"Object"** esté marcada

2. Presiona `Shift + A` y ve a `Vector > Mapping`
   - Aparecerá un nodo "Mapping"
   - Deja el tipo en **"Point"** (por defecto)
   - Deja los valores en Location: (0,0,0), Rotation: (0,0,0), Scale: (1,1,1)

3. **Conectar Texture Coordinate a Mapping:**
   - Arrastra desde la salida **"Object"** del nodo "Texture Coordinate"
   - Suéltalo en la entrada **"Vector"** del nodo "Mapping"

**Paso 5.2: Crear el nodo Base Color (Textura de Color)**
1. Presiona `Shift + A` y ve a `Texture > Image Texture`
   - Se creará un nodo "Image Texture"
   - Haz clic en el botón **"Open"** y carga `cardboard_box_01_diff_4k.jpg`
   - ⚠️ **MUY IMPORTANTE:** En la parte inferior del nodo, cambia **"Color Space"** a **"sRGB"**

2. **Conectar Mapping a Base Color:**
   - Arrastra desde la salida **"Vector"** del nodo "Mapping"
   - Suéltalo en la entrada **"Vector"** del nodo "Image Texture" (Base Color)

3. **Conectar Base Color a Principled BSDF:**
   - Arrastra desde la salida **"Color"** del nodo "Image Texture" (Base Color)
   - Suéltalo en la entrada **"Base Color"** del nodo "Principled BSDF"

**Paso 5.3: Crear el nodo Roughness (Textura de Rugosidad) - Opcional**
1. Presiona `Shift + A` y ve a `Texture > Image Texture`
   - Se creará otro nodo "Image Texture"
   - Haz clic en **"Open"** y carga tu textura de rugosidad (si la tienes)
     - Ejemplo: `cardboard_box_01_roughness_4k.jpg`
   - ⚠️ **MUY IMPORTANTE:** Cambia **"Color Space"** a **"Non-Color"** (no "sRGB")

2. **Conectar Mapping a Roughness:**
   - Arrastra desde la salida **"Vector"** del nodo "Mapping"
   - Suéltalo en la entrada **"Vector"** del segundo nodo "Image Texture" (Roughness)

3. **Conectar Roughness a Principled BSDF:**
   - Arrastra desde la salida **"Color"** del nodo "Image Texture" (Roughness)
   - Suéltalo en la entrada **"Roughness"** del nodo "Principled BSDF"

**Paso 5.4: Crear el nodo Normal Map - Opcional**
1. Presiona `Shift + A` y ve a `Texture > Image Texture`
   - Se creará un tercer nodo "Image Texture"
   - Haz clic en **"Open"** y carga tu mapa normal (si lo tienes)
     - Ejemplo: `cardboard_box_01_normal_4k.jpg`
   - ⚠️ **MUY IMPORTANTE:** Cambia **"Color Space"** a **"Non-Color"**

2. Presiona `Shift + A` y ve a `Vector > Normal Map`
   - Se creará un nodo "Normal Map"
   - Deja el tipo en **"Tangent Space"** (por defecto)
   - Deja la "Strength" en **1.000**

3. **Conectar Mapping a Normal:**
   - Arrastra desde la salida **"Vector"** del nodo "Mapping"
   - Suéltalo en la entrada **"Vector"** del tercer nodo "Image Texture" (Normal)

4. **Conectar Normal a Normal Map:**
   - Arrastra desde la salida **"Color"** del nodo "Image Texture" (Normal)
   - Suéltalo en la entrada **"Color"** del nodo "Normal Map"

5. **Conectar Normal Map a Principled BSDF:**
   - Arrastra desde la salida **"Normal"** del nodo "Normal Map"
   - Suéltalo en la entrada **"Normal"** del nodo "Principled BSDF"

**Resumen de conexiones (como en la imagen):**
```
Texture Coordinate (Object) → Mapping (Vector)
Mapping (Vector) → Base Color (Vector)
Mapping (Vector) → Roughness (Vector)
Mapping (Vector) → Normal (Vector)
Base Color (Color) → Principled BSDF (Base Color)
Roughness (Color) → Principled BSDF (Roughness)
Normal (Color) → Normal Map (Color)
Normal Map (Normal) → Principled BSDF (Normal)
Principled BSDF (BSDF) → Material Output (Surface)
```

**⚠️ NOTA IMPORTANTE sobre Color Space:**
- **sRGB**: Solo para la textura de **Base Color** (el color visible)
- **Non-Color**: Para **Roughness** y **Normal** (mapas técnicos, no colores reales)

### Paso 6: Verificar en la vista 3D
- Cambia a la vista **"Material Preview"** o **"Rendered"** (esquina superior derecha de la vista 3D)
- Deberías ver la textura aplicada a la caja

### Paso 7: Verificar coordenadas UV (opcional)
1. Cambia al modo **"UV Editing"** (pestaña superior)
2. Selecciona la caja y presiona `Tab` para entrar en Edit Mode
3. Presiona `A` para seleccionar todo
4. Presiona `U` y selecciona "Smart UV Project" o "Unwrap" si las UV no están bien
5. En el editor UV (ventana izquierda), deberías ver las UV mapeadas correctamente

### Paso 8: Exportar a GLB
1. Ve a `File > Export > glTF 2.0 (.glb/.gltf)`
2. En la ventana de exportación:
   - Selecciona formato **GLB** (no GLTF)
   - ✅ Marca la casilla **"Export Textures"** (esto es muy importante - incluirá la textura en el GLB)
   - ✅ Marca **"Images"** para asegurar que las imágenes se exporten
   - Opcional: puedes ajustar otras opciones según necesites
3. Navega a la carpeta `Cerbero/src/assets/models/`
4. Guarda como `cardboard_box_01_4k.glb` (puede sobrescribir el existente)
5. Haz clic en "Export glTF 2.0"

## Consejos
- Si no ves el Shader Editor, asegúrate de tener el objeto seleccionado
- La textura debe estar en una ruta accesible cuando la cargues en Blender
- El archivo GLB exportado será más grande porque incluye la textura, pero funcionará perfectamente

## Ventajas de Aplicar la Textura en Blender

- ✅ Las coordenadas UV ya están correctas desde el modelo original
- ✅ La textura queda embebida en el GLB (no necesitas archivos separados)
- ✅ No necesitas código adicional para aplicar texturas
- ✅ Funciona automáticamente cuando cargas el modelo
- ✅ Mantiene todas las propiedades y transformaciones correctas

## Nota

Una vez que exportes el nuevo GLB con la textura incluida, el código actual funcionará automáticamente sin necesidad de reemplazar texturas. El modelo se cargará con la textura ya aplicada correctamente.

## ¿Qué hacer si ves una configuración como en la imagen?

Si estás viendo una configuración de nodos más compleja (con Texture Coordinate, Mapping, múltiples texturas, Normal Map), es porque alguien configuró un material PBR avanzado. Puedes:

1. **Si solo tienes la textura de color (diffuse):**
   - Sigue la **Opción A (Configuración Básica)** arriba
   - O sigue la **Opción B** pero solo configura el nodo "Base Color" y omite Roughness y Normal
   - El modelo funcionará perfectamente solo con la textura de color

2. **Si tienes todas las texturas PBR:**
   - Sigue la **Opción B (Configuración Avanzada PBR)** completa
   - Necesitarás texturas como:
     - `cardboard_box_01_diff_4k.jpg` (Base Color)
     - `cardboard_box_01_roughness_4k.jpg` (Roughness - opcional)
     - `cardboard_box_01_normal_4k.jpg` (Normal Map - opcional)

3. **Si la imagen muestra nodos que no tienes:**
   - Los nodos que NO son esenciales: Texture Coordinate y Mapping (son útiles pero opcionales)
   - Si no los tienes, simplemente conecta directamente el nodo "Image Texture" al "Principled BSDF"
   - La configuración básica funcionará igual de bien

**Recordatorio clave sobre Color Space:**
- Base Color → **sRGB** ✅
- Roughness → **Non-Color** ✅
- Normal → **Non-Color** ✅

