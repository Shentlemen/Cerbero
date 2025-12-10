# Texturas 3D para Babylon.js

Esta carpeta contiene las texturas utilizadas en los modelos 3D de la aplicación.

## Ubicación de archivos
Guarda todas las texturas en esta carpeta: `src/assets/textures/`

## Formatos soportados
Babylon.js soporta los siguientes formatos de imagen:
- **JPEG (.jpg, .jpeg)** - Recomendado para texturas sin transparencia
- **PNG (.png)** - Para texturas con transparencia o canales alpha
- **WebP (.webp)** - Buen balance calidad/tamaño (recomendado)
- **BMP (.bmp)** - Menos común

## Formatos recomendados
- **Diffuse/Albedo**: JPG o WebP (512x512, 1024x1024 o 2048x2048 píxeles)
- **Normal Maps**: PNG o JPG (mismo tamaño que diffuse)
- **Bump Maps**: PNG en escala de grises
- **Roughness/Metallic**: PNG en escala de grises

## Sitios recomendados para descargar texturas

### Gratuitos (CC0 - Libre uso comercial):
1. **Poly Haven** - https://polyhaven.com/textures
   - Texturas de alta calidad, múltiples resoluciones
   - Incluye diffuse, normal, roughness, displacement
   - Formato: JPG/PNG/EXR

2. **AmbientCG** - https://ambientcg.com/
   - Biblioteca extensa de texturas PBR
   - Varias resoluciones disponibles
   - Formato: JPG/PNG

3. **Textures.com** - https://www.textures.com/
   - Requiere registro gratuito (limitado a 15 descargas/día)
   - Gran variedad de texturas
   - Formato: JPG

4. **Pixabay** - https://pixabay.com/images/search/texture/
   - Texturas libres de derechos
   - Formato: JPG/PNG

5. **FreePBR** - https://freepbr.com/
   - Texturas PBR gratuitas
   - Incluye todos los mapas necesarios
   - Formato: PNG/JPG

### Texturas específicas para pisos de madera:
- Busca: "wood floor texture", "parquet texture", "hardwood floor texture"
- Tamaño recomendado: 1024x1024 o 2048x2048 píxeles
- Formato: JPG o PNG

## Nombre de archivos

Para el piso de madera, usa estos nombres:
- `wood-floor.jpg` - Textura difusa principal
- `wood-floor-normal.jpg` - Mapa normal (opcional, para relieve)
- `wood-floor-roughness.jpg` - Mapa de rugosidad (opcional)

## Estructura recomendada

```
src/assets/textures/
├── wood-floor.jpg          (Textura del piso)
├── wood-floor-normal.jpg   (Normal map opcional)
└── README.md              (Este archivo)
```

## Notas importantes

1. **Tamaño de archivo**: Mantén las texturas optimizadas (menos de 1MB por archivo preferiblemente)
2. **Resolución**: Para web, 1024x1024 es un buen balance calidad/rendimiento
3. **Repetición**: Las texturas se repetirán (wrap) automáticamente, así que asegúrate de que se vean bien cuando se repiten
4. **Carga**: Después de agregar las texturas, reinicia el servidor de desarrollo (`ng serve`)

## Ejemplo de descarga

1. Ve a https://polyhaven.com/a/wood_floor_001
2. Descarga el "Diffuse" en resolución 1K (1024x1024)
3. Guarda como `wood-floor.jpg` en esta carpeta
4. Opcional: descarga el "Normal" como `wood-floor-normal.jpg`

