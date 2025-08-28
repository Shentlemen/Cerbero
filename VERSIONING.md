# Sistema de Versionado - Cerbero

## 📋 Información de Versión

**Versión Actual:** v0.9.0-beta (2024.12.001)  
**Codename:** Cerbero Beta  
**Estado:** En Desarrollo  
**Fecha de Release:** 2024-12-19  
**Equipo de Desarrollo:** Cerbero Development Team  

## 🚀 Sistema de Versionado

Cerbero utiliza **Semantic Versioning (SemVer)** para mantener un control profesional de las versiones:

### **Formato de Versión: MAJOR.MINOR.PATCH**

- **MAJOR** (1.0.0): Cambios incompatibles con versiones anteriores
- **MINOR** (0.9.0): Nuevas funcionalidades compatibles
- **PATCH** (0.9.1): Correcciones de bugs y mejoras menores

### **Etiquetas de Estado (Sufijos)**
- **-alpha**: Versión muy temprana, funcionalidades básicas
- **-beta**: Versión de testing, funcionalidades principales completas
- **-rc** (release candidate): Versión candidata para release
- **-dev**: Versión en desarrollo activo
- **Sin sufijo**: Versión estable para producción

### **Número de Build**

Formato: `YYYY.MM.NNN` (Año.Mes.Contador secuencial)
- **Ejemplo:** `2025.08.001`, `2025.08.002`, `2025.08.003`
- **Se actualiza**: Después de cada deploy, sprint o hito de desarrollo
- **Contador**: Se incrementa secuencialmente cada mes (001, 002, 003...)
- **Reinicio**: El contador se reinicia a 001 cada mes nuevo

### **Ejemplos de Builds Secuenciales:**

| Fecha | Build | Explicación |
|-------|-------|-------------|
| 2025-08-15 | 2025.08.001 | Primer build del mes de agosto |
| 2025-08-18 | 2025.08.002 | Segundo build del mes de agosto |
| 2025-08-22 | 2025.08.003 | Tercer build del mes de agosto |
| 2025-09-01 | 2025.09.001 | Primer build del mes de septiembre (contador reiniciado) |

## 🔧 Actualización Automática de Versiones

### **Script de Actualización**

```bash
# Incrementar versión menor (nueva funcionalidad)
node scripts/version-updater.js minor

# Incrementar versión de parche (bug fix)
node scripts/version-updater.js patch

# Incrementar versión mayor (cambio importante)
node scripts/version-updater.js major

# Solo actualizar build y fecha
node scripts/version-updater.js build
```

### **Ejemplos de Uso**

```bash
# Versión actual: 1.0.0
node scripts/version-updater.js minor
# Resultado: 1.1.0

# Versión actual: 1.1.0
node scripts/version-updater.js patch
# Resultado: 1.1.1

# Versión actual: 1.1.1
node scripts/version-updater.js major
# Resultado: 2.0.0
```

## 📅 Cuándo Incrementar Versiones

### **MAJOR (X.0.0)**
- Cambios en la API que rompen compatibilidad
- Refactorizaciones importantes de la base de datos
- Cambios en la arquitectura del sistema
- Migraciones de versiones de Angular o dependencias

### **MINOR (0.X.0)**
- Nuevas funcionalidades
- Nuevos módulos o componentes
- Mejoras significativas en la interfaz
- Nuevas integraciones

### **PATCH (0.0.X)**
- Correcciones de bugs
- Mejoras menores en la interfaz
- Optimizaciones de rendimiento
- Correcciones de seguridad

### **BUILD**
- **Después de cada deploy** a producción o testing
- **Al finalizar sprints** de desarrollo
- **Para marcar hitos** importantes del proyecto
- **Después de correcciones** de bugs críticos

## 🎯 Workflow de Versionado para Desarrollo

### **1. Desarrollo Activo (Actual)**
- **Versión:** 0.9.0-beta
- **Estado:** Funcionalidades principales en desarrollo
- **Build:** Se incrementa con cada hito

### **2. Testing (Próximo)**
- **Versión:** 0.9.0-rc (release candidate)
- **Estado:** Testing de funcionalidades completas
- **Build:** Se incrementa con cada corrección

### **3. Release Estable (Objetivo)**
- **Versión:** 1.0.0
- **Estado:** Versión estable para producción
- **Build:** Se incrementa con cada deploy

## 📊 Historial de Versiones

| Versión | Build | Fecha | Estado | Cambios |
|---------|-------|-------|--------|---------|
| 0.9.0-beta | 2024.12.001 | 2024-12-19 | 🚧 En Desarrollo | Sistema principal en desarrollo |
| - | - | - | - | - |

## 🔍 Verificación de Versión

La versión actual se muestra en:
- **Footer de la aplicación** (parte inferior)
- **Archivo:** `src/app/version.ts`
- **Componente:** `AppFooterComponent`

## 📝 Notas de Release

### **v0.9.0-beta - Cerbero Beta (2024-12-19)**
**Estado:** En Desarrollo Activo
- 🚧 Sistema de gestión de activos (en desarrollo)
- 🚧 Gestión de dispositivos de red (en desarrollo)
- 🚧 Sistema de compras y proveedores (en desarrollo)
- 🚧 Gestión de almacén y stock (en desarrollo)
- 🚧 Sistema de alertas y notificaciones (en desarrollo)
- 🚧 Panel de administración (en desarrollo)
- 🚧 Interfaz responsive y moderna (en desarrollo)

## 🚀 Próximas Versiones

### **v0.9.0-rc - Release Candidate (Próximamente)**
- 🔄 Testing completo de funcionalidades
- 🔄 Corrección de bugs críticos
- 🔄 Optimización de rendimiento
- 🔄 Preparación para release estable

### **v1.0.0 - Release Estable (Objetivo)**
- 🎉 Versión estable para producción
- 🎉 Todas las funcionalidades principales completas
- 🎉 Documentación completa
- 🎉 Testing exhaustivo completado

---

**© 2024 Cerbero Development Team. Todos los derechos reservados.** 