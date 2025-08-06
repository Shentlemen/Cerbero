import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface HelpTip {
  message: string;
  type?: 'info' | 'warning' | 'success' | 'tip';
  priority?: 'low' | 'medium' | 'high';
  context?: string[];
  relatedSections?: string[];
  userLevel?: 'beginner' | 'intermediate' | 'advanced';
}

export interface UserBehavior {
  section: string;
  timestamp: Date;
  action: string;
  duration: number;
  errors?: string[];
}

export interface SmartSuggestion {
  message: string;
  type: 'tip' | 'warning' | 'suggestion';
  confidence: number;
  basedOn: string[];
}

@Injectable({
  providedIn: 'root'
})
export class HelperService {
  private helpTips: { [key: string]: HelpTip } = {
    // === DASHBOARD Y PANEL PRINCIPAL ===
    dashboard: {
      message: "Panel principal del sistema. Aquí puedes monitorear el estado general de tu red, ver alertas sobre cambios en hardware, nuevos equipos detectados y uso de disco. Usa el botón 'Verificar cambios' para actualizar la información en tiempo real.",
      type: 'info',
      priority: 'high',
      context: ['monitoring', 'alerts', 'hardware'],
      relatedSections: ['assets', 'devices', 'software'],
      userLevel: 'beginner'
    },

    // === GESTIÓN DE ACTIVOS ===
    assets: {
      message: "Gestión de activos informáticos. Aquí puedes ver todas las computadoras registradas en el sistema con información detallada: ubicación física, especificaciones de hardware, estado operativo y usuario asignado. Haz clic en cualquier equipo para ver su información completa.",
      type: 'info',
      priority: 'high',
      context: ['inventory', 'computers', 'hardware'],
      relatedSections: ['asset-details', 'locations', 'procurement/activos'],
      userLevel: 'beginner'
    },
    'asset-details': {
      message: "Detalles completos del activo. Aquí puedes ver toda la información técnica del equipo: especificaciones de hardware, usuario asignado, ubicación física, historial de compras, garantías y activos relacionados. Esta información es esencial para el mantenimiento y gestión del inventario.",
      type: 'info',
      priority: 'medium',
      context: ['details', 'hardware', 'user'],
      relatedSections: ['assets', 'locations', 'procurement/activos'],
      userLevel: 'intermediate'
    },

    // === GESTIÓN DE DISPOSITIVOS ===
    devices: {
      message: "Gestión de dispositivos periféricos. Aquí puedes administrar impresoras, escáneres, switches y otros dispositivos de red. Puedes ver su estado de conexión, ubicación física y configuraciones. Esta información es importante para el mantenimiento de la infraestructura de red.",
      type: 'info',
      priority: 'medium',
      context: ['peripherals', 'printers', 'scanners'],
      relatedSections: ['device-details', 'locations', 'subnets'],
      userLevel: 'beginner'
    },
    'device-details': {
      message: "Aquí puedes ver información detallada de un dispositivo específico, incluyendo su estado de red, ubicación y características técnicas.",
      type: 'info',
      priority: 'low',
      context: ['details', 'network', 'technical'],
      relatedSections: ['devices', 'subnets', 'locations'],
      userLevel: 'intermediate'
    },

    // === GESTIÓN DE SOFTWARE ===
    software: {
      message: "Inventario de software. Aquí puedes ver todo el software instalado en tu red, incluyendo versiones, licencias y equipos donde está instalado. Usa los filtros para buscar software específico y el botón del ojo para mostrar u ocultar programas. Esta información es crucial para la gestión de licencias y auditorías.",
      type: 'info',
      priority: 'medium',
      context: ['software', 'licenses', 'installation'],
      relatedSections: ['assets', 'dashboard'],
      userLevel: 'intermediate'
    },

    // === MÓDULO DE ADQUISICIONES ===
    'procurement/activos': {
      message: "Gestión de activos de la organización. Aquí puedes registrar nuevos activos, editar información existente, eliminar registros obsoletos y consultar el inventario completo. Cada activo incluye su relación con hardware y compras. Esta sección es fundamental para mantener el control patrimonial.",
      type: 'info',
      priority: 'high',
      context: ['procurement', 'assets', 'management'],
      relatedSections: ['procurement/compras', 'procurement/lotes', 'assets'],
      userLevel: 'intermediate'
    },
    'procurement/compras': {
      message: "Registro de compras de la organización. Aquí puedes ver y registrar todas las transacciones de compra realizadas, incluyendo fechas, montos, proveedores y detalles de cada adquisición. Esta información se relaciona con activos y lotes para mantener un control financiero completo.",
      type: 'info',
      priority: 'high',
      context: ['procurement', 'purchases', 'financial'],
      relatedSections: ['procurement/activos', 'procurement/proveedores', 'procurement/lotes'],
      userLevel: 'intermediate'
    },
    'procurement/entregas': {
      message: "Gestiona las entregas de activos y equipos. Lleva el control de qué, cuándo y a quién se entregó cada elemento.",
      type: 'info',
      priority: 'medium',
      context: ['procurement', 'deliveries', 'tracking'],
      relatedSections: ['procurement/activos', 'procurement/lotes'],
      userLevel: 'intermediate'
    },
    'procurement/lotes': {
      message: "Administra los lotes de compras y activos. Un lote agrupa varios ítems adquiridos en una misma compra o entrega.",
      type: 'info',
      priority: 'medium',
      context: ['procurement', 'batches', 'grouping'],
      relatedSections: ['procurement/compras', 'procurement/activos'],
      userLevel: 'intermediate'
    },
    'procurement/proveedores': {
      message: "Consulta y administra los proveedores de la organización. Mantén actualizada la información de contacto y los servicios que ofrecen.",
      type: 'info',
      priority: 'medium',
      context: ['procurement', 'vendors', 'contacts'],
      relatedSections: ['procurement/compras', 'procurement/servicios-garantia'],
      userLevel: 'intermediate'
    },
    'procurement/tipos-activo': {
      message: "Define y gestiona los diferentes tipos de activos que existen en la organización. Esto ayuda a clasificar y organizar mejor los recursos.",
      type: 'info',
      priority: 'low',
      context: ['procurement', 'classification', 'organization'],
      relatedSections: ['procurement/activos'],
      userLevel: 'advanced'
    },
    'procurement/tipos-compra': {
      message: "Configura los tipos de compra disponibles, como licencias, hardware, servicios, etc. Esto facilita la clasificación de las adquisiciones.",
      type: 'info',
      priority: 'low',
      context: ['procurement', 'classification', 'configuration'],
      relatedSections: ['procurement/compras'],
      userLevel: 'advanced'
    },
    'procurement/servicios-garantia': {
      message: "Administra los servicios de garantía asociados a los activos. Lleva el control de fechas, proveedores y condiciones de garantía.",
      type: 'info',
      priority: 'medium',
      context: ['procurement', 'warranty', 'services'],
      relatedSections: ['procurement/activos', 'procurement/proveedores'],
      userLevel: 'intermediate'
    },
    'procurement/usuarios': {
      message: "Gestiona los usuarios responsables de los activos y compras. Asigna roles y mantén actualizada la información de cada usuario.",
      type: 'info',
      priority: 'medium',
      context: ['procurement', 'users', 'roles'],
      relatedSections: ['procurement/activos', 'procurement/compras'],
      userLevel: 'intermediate'
    },

    // === GESTIÓN DE REDES ===
    subnets: {
      message: "Administración de redes. Aquí puedes gestionar todas las subredes de la organización, ver la distribución de direcciones IP y configurar parámetros de red. Esta información es esencial para el mantenimiento de la infraestructura de red y la resolución de problemas de conectividad.",
      type: 'info',
      priority: 'high',
      context: ['network', 'subnets', 'ip'],
      relatedSections: ['devices', 'locations'],
      userLevel: 'intermediate'
    },

    // === CONFIGURACIÓN Y ADMINISTRACIÓN ===
    settings: {
      message: "Configuración avanzada del sistema. Aquí puedes modificar ajustes importantes del sistema, configuraciones de seguridad y parámetros técnicos. Esta sección es para administradores del sistema. Asegúrate de entender las implicaciones antes de realizar cambios.",
      type: 'warning',
      priority: 'high',
      context: ['configuration', 'system', 'advanced'],
      relatedSections: [],
      userLevel: 'advanced'
    },
    locations: {
      message: "Gestión de ubicaciones físicas. Aquí puedes administrar todas las ubicaciones de la organización donde se encuentran los activos: oficinas, salas de servidores, almacenes y otros espacios. Esta información es importante para el control de inventario y la gestión de activos.",
      type: 'info',
      priority: 'medium',
      context: ['locations', 'physical', 'organization'],
      relatedSections: ['assets', 'devices', 'subnets'],
      userLevel: 'beginner'
    },
    'user-management': {
      message: "Gestión de usuarios del sistema. Aquí puedes crear, editar y eliminar usuarios, asignar roles y permisos, y administrar el acceso al sistema. Esta sección es para administradores y es fundamental para la seguridad del sistema.",
      type: 'warning',
      priority: 'high',
      context: ['administration', 'users', 'roles'],
      relatedSections: ['procurement/usuarios'],
      userLevel: 'advanced'
    },

    // === SECCIONES ESPECÍFICAS ===
    'procurement': {
      message: "Módulo completo de adquisiciones. Aquí gestionas todo el ciclo de compras: desde proveedores hasta la entrega de activos.",
      type: 'info',
      priority: 'high',
      context: ['procurement', 'overview', 'management'],
      relatedSections: ['procurement/activos', 'procurement/compras', 'procurement/proveedores'],
      userLevel: 'intermediate'
    },

    // === MENSAJES PARA RUTAS ESPECÍFICAS ===
    'menu': {
      message: "¡Bienvenido al menú principal! 🏠 Aquí puedes navegar por todas las secciones del sistema. Usa los menús desplegables para acceder a subsecciones.",
      type: 'info',
      priority: 'low',
      context: ['navigation', 'menu', 'overview'],
      relatedSections: ['dashboard', 'assets', 'procurement'],
      userLevel: 'beginner'
    },

    // === MENSAJES PARA ERRORES Y ESTADOS ===
    'error': {
      message: "¡Ups! 😅 Parece que algo salió mal. No te preocupes, puedes intentar de nuevo o contactar al administrador si el problema persiste.",
      type: 'warning',
      priority: 'high',
      context: ['error', 'troubleshooting'],
      relatedSections: ['dashboard'],
      userLevel: 'beginner'
    },

    'loading': {
      message: "Cargando... ⏳ Por favor espera mientras el sistema procesa tu solicitud.",
      type: 'info',
      priority: 'low',
      context: ['loading', 'processing'],
      relatedSections: [],
      userLevel: 'beginner'
    },

    // === MENSAJES PARA FUNCIONALIDADES ESPECÍFICAS ===
    'search': {
      message: "🔍 Usa la búsqueda para encontrar rápidamente lo que necesitas. Puedes buscar por nombre, ubicación, tipo o cualquier criterio relevante.",
      type: 'tip',
      priority: 'medium',
      context: ['search', 'find', 'filter'],
      relatedSections: ['assets', 'devices', 'procurement/activos'],
      userLevel: 'beginner'
    },

    'filter': {
      message: "🎯 Los filtros te ayudan a ver solo la información que necesitas. Combina diferentes criterios para obtener resultados más precisos.",
      type: 'tip',
      priority: 'medium',
      context: ['filter', 'sort', 'organize'],
      relatedSections: ['assets', 'software', 'procurement/activos'],
      userLevel: 'intermediate'
    },

    'export': {
      message: "📊 Exporta datos para análisis externos o reportes. Los archivos se descargan en formato Excel o CSV según tu preferencia.",
      type: 'tip',
      priority: 'low',
      context: ['export', 'reports', 'data'],
      relatedSections: ['assets', 'procurement/activos', 'dashboard'],
      userLevel: 'intermediate'
    },

    'import': {
      message: "📥 Importa datos masivos desde archivos Excel o CSV. Asegúrate de que el formato sea correcto antes de subir.",
      type: 'tip',
      priority: 'low',
      context: ['import', 'bulk', 'data'],
      relatedSections: ['procurement/activos', 'assets'],
      userLevel: 'advanced'
    },

    // === MENSAJES PARA ESTADOS DE SISTEMA ===
    'sync': {
      message: "🔄 Sincronizando datos con el servidor. Esto puede tomar unos segundos dependiendo de la cantidad de información.",
      type: 'info',
      priority: 'medium',
      context: ['sync', 'update', 'server'],
      relatedSections: ['dashboard', 'settings'],
      userLevel: 'intermediate'
    },

    'backup': {
      message: "💾 Creando respaldo de datos. Es importante mantener copias de seguridad regulares para proteger la información.",
      type: 'info',
      priority: 'high',
      context: ['backup', 'security', 'data'],
      relatedSections: ['settings'],
      userLevel: 'advanced'
    },

    // === MENSAJES PARA ALERTAS Y NOTIFICACIONES ===
    'alerts': {
      message: "🚨 Sistema de alertas activo. Aquí verás notificaciones importantes sobre cambios, errores o eventos que requieren tu atención.",
      type: 'warning',
      priority: 'high',
      context: ['alerts', 'notifications', 'events'],
      relatedSections: ['dashboard'],
      userLevel: 'beginner'
    },

    'notifications': {
      message: "🔔 Centro de notificaciones. Aquí puedes ver el historial de todas las notificaciones y configurar tus preferencias.",
      type: 'info',
      priority: 'medium',
      context: ['notifications', 'history', 'preferences'],
      relatedSections: ['dashboard'],
      userLevel: 'intermediate'
    },

    // === MENSAJES PARA REPORTES Y ANÁLISIS ===
    'reports': {
      message: "📈 Genera reportes detallados sobre activos, compras, uso de software y más. Los reportes se pueden exportar en diferentes formatos.",
      type: 'info',
      priority: 'medium',
      context: ['reports', 'analytics', 'data'],
      relatedSections: ['dashboard', 'assets', 'procurement/activos'],
      userLevel: 'intermediate'
    },

    'analytics': {
      message: "📊 Análisis avanzado de datos. Visualiza tendencias, patrones y métricas importantes para tomar decisiones informadas.",
      type: 'info',
      priority: 'medium',
      context: ['analytics', 'trends', 'metrics'],
      relatedSections: ['dashboard', 'reports'],
      userLevel: 'advanced'
    },

    // === MENSAJES PARA CONFIGURACIÓN AVANZADA ===
    'advanced-config': {
      message: "⚙️ Configuración avanzada del sistema. Aquí puedes ajustar parámetros técnicos y opciones de rendimiento.",
      type: 'warning',
      priority: 'high',
      context: ['advanced', 'configuration', 'technical'],
      relatedSections: ['settings'],
      userLevel: 'advanced'
    },

    'system-health': {
      message: "🏥 Estado de salud del sistema. Monitorea el rendimiento, uso de recursos y estado de los servicios.",
      type: 'info',
      priority: 'high',
      context: ['health', 'performance', 'monitoring'],
      relatedSections: ['dashboard', 'settings'],
      userLevel: 'advanced'
    },

    // === MENSAJES PARA INTEGRACIONES ===
    'integrations': {
      message: "🔗 Gestión de integraciones externas. Conecta el sistema con otras herramientas y servicios para automatizar procesos.",
      type: 'info',
      priority: 'low',
      context: ['integrations', 'api', 'automation'],
      relatedSections: ['settings'],
      userLevel: 'advanced'
    },

    // === MENSAJES PARA SEGURIDAD ===
    'security': {
      message: "🔒 Configuración de seguridad. Gestiona contraseñas, permisos, auditorías y políticas de seguridad del sistema.",
      type: 'warning',
      priority: 'high',
      context: ['security', 'permissions', 'audit'],
      relatedSections: ['user-management', 'settings'],
      userLevel: 'advanced'
    },

    // === MENSAJES PARA MANTENIMIENTO ===
    'maintenance': {
      message: "🔧 Herramientas de mantenimiento. Aquí puedes limpiar datos, optimizar la base de datos y realizar tareas de mantenimiento.",
      type: 'warning',
      priority: 'high',
      context: ['maintenance', 'cleanup', 'optimization'],
      relatedSections: ['settings'],
      userLevel: 'advanced'
    },

    // === MENSAJES PARA AYUDA Y SOPORTE ===
    'help': {
      message: "❓ Centro de ayuda y soporte. Encuentra documentación, tutoriales y contacta al equipo de soporte técnico.",
      type: 'info',
      priority: 'medium',
      context: ['help', 'support', 'documentation'],
      relatedSections: [],
      userLevel: 'beginner'
    },

    'tutorials': {
      message: "📚 Tutoriales interactivos. Aprende a usar el sistema paso a paso con guías visuales y ejemplos prácticos.",
      type: 'tip',
      priority: 'medium',
      context: ['tutorials', 'learning', 'guides'],
      relatedSections: ['help'],
      userLevel: 'beginner'
    },

    // === MENSAJES PARA PERFIL DE USUARIO ===
    'user-profile': {
      message: "👤 Tu perfil de usuario. Aquí puedes ver y editar tu información personal, cambiar contraseña y configurar preferencias.",
      type: 'info',
      priority: 'medium',
      context: ['profile', 'personal', 'preferences'],
      relatedSections: ['user-management'],
      userLevel: 'beginner'
    },

    // === MENSAJES PARA LOGOUT Y SESIÓN ===
    'logout': {
      message: "👋 Cerrando sesión. Recuerda guardar cualquier trabajo pendiente antes de salir del sistema.",
      type: 'info',
      priority: 'medium',
      context: ['logout', 'session', 'security'],
      relatedSections: [],
      userLevel: 'beginner'
    },

    // === MENSAJE POR DEFECTO ===
    '': {
      message: "Asistente de ayuda del sistema. Soy tu guía para navegar por las diferentes secciones de la aplicación. Haz clic en mí cuando necesites información sobre cualquier funcionalidad o sección del sistema.",
      type: 'info',
      priority: 'low',
      context: ['general', 'help', 'assistance'],
      relatedSections: ['dashboard', 'assets', 'help'],
      userLevel: 'beginner'
    }
  };

  // Sistema de IA y aprendizaje
  private userBehavior = new BehaviorSubject<UserBehavior[]>([]);
  private userLevel = new BehaviorSubject<'beginner' | 'intermediate' | 'advanced'>('beginner');
  private userPreferences = new BehaviorSubject<{[key: string]: any}>({});
  private smartSuggestions = new BehaviorSubject<SmartSuggestion[]>([]);

  // Patrones de uso comunes
  private commonPatterns = {
    'dashboard': ['assets', 'devices', 'software'],
    'procurement': ['procurement/activos', 'procurement/compras', 'procurement/lotes'],
    'network': ['subnets', 'devices', 'locations'],
    'management': ['user-management', 'settings', 'locations']
  };

  // Sugerencias inteligentes basadas en contexto
  private contextualSuggestions = {
    'new_user': [
      { message: "Recomendación: Comienza explorando el Dashboard para obtener una vista general del estado del sistema y las alertas activas.", confidence: 0.9, type: 'tip' as const },
      { message: "Sugerencia: Revisa la sección de Assets para familiarizarte con el inventario de equipos y su información técnica.", confidence: 0.8, type: 'tip' as const },
      { message: "Ayuda: Consulta la documentación del sistema para aprender sobre las funcionalidades disponibles y mejores prácticas.", confidence: 0.7, type: 'tip' as const }
    ],
    'frequent_errors': [
      { message: "Atención: Se han detectado errores frecuentes. Revisa la configuración del sistema en la sección Settings.", confidence: 0.7, type: 'warning' as const },
      { message: "Sugerencia: Verifica la configuración de red y conectividad en la sección de Settings si experimentas problemas técnicos.", confidence: 0.6, type: 'tip' as const },
      { message: "Importante: Si los errores persisten, contacta al administrador del sistema para asistencia técnica.", confidence: 0.5, type: 'warning' as const }
    ],
    'procurement_workflow': [
      { message: "Flujo recomendado para adquisiciones: 1) Registrar proveedores → 2) Crear órdenes de compra → 3) Organizar en lotes → 4) Asignar activos a ubicaciones.", confidence: 0.8, type: 'suggestion' as const },
      { message: "Importante: No olvides registrar las garantías de los equipos adquiridos para el control de mantenimiento.", confidence: 0.7, type: 'tip' as const },
      { message: "Sugerencia: Después de crear un lote, asigna los activos a sus ubicaciones correspondientes para mantener el inventario actualizado.", confidence: 0.6, type: 'tip' as const }
    ],
    'network_management': [
      { message: "Recomendación: Verifica que las subnets estén correctamente configuradas para evitar problemas de conectividad.", confidence: 0.8, type: 'tip' as const },
      { message: "Sugerencia: Revisa la conectividad de los dispositivos en la sección de Devices para identificar problemas de red.", confidence: 0.7, type: 'tip' as const },
      { message: "Importante: Asigna ubicaciones físicas a los dispositivos para facilitar el mantenimiento y control de inventario.", confidence: 0.6, type: 'tip' as const }
    ],
    'asset_tracking': [
      { message: "Sugerencia: Usa los filtros de búsqueda para encontrar activos específicos rápidamente por nombre, IP o ubicación.", confidence: 0.8, type: 'tip' as const },
      { message: "Recomendación: Verifica la ubicación actual del activo en la sección de Locations para confirmar su posición física.", confidence: 0.7, type: 'tip' as const },
      { message: "Utilidad: Exporta la lista de activos para análisis externos o reportes de inventario.", confidence: 0.6, type: 'tip' as const }
    ],
    'software_management': [
      { message: "Recomendación: Usa los filtros para ver qué software está instalado en equipos específicos y gestionar licencias.", confidence: 0.8, type: 'tip' as const },
      { message: "Funcionalidad: El botón del ojo permite mostrar u ocultar software específico para facilitar la visualización.", confidence: 0.7, type: 'tip' as const },
      { message: "Importante: Revisa las licencias de software en la sección de procurement para mantener el cumplimiento legal.", confidence: 0.6, type: 'tip' as const }
    ],
    'user_administration': [
      { message: "Administración: Crea nuevos usuarios, asigna roles y gestiona permisos de acceso al sistema desde esta sección.", confidence: 0.8, type: 'tip' as const },
      { message: "Seguridad: Los roles determinan los permisos de cada usuario. Asigna roles apropiados para mantener la seguridad del sistema.", confidence: 0.7, type: 'tip' as const },
      { message: "Comunicación: Configura notificaciones para informar a los usuarios sobre cambios en sus cuentas o permisos.", confidence: 0.6, type: 'tip' as const }
    ],
    'system_maintenance': [
      { message: "Importante: Realiza respaldos antes de hacer cambios importantes en la configuración del sistema.", confidence: 0.9, type: 'warning' as const },
      { message: "Mantenimiento: Sincroniza datos regularmente para mantener la integridad de la información del sistema.", confidence: 0.8, type: 'tip' as const },
      { message: "Monitoreo: Revisa los reportes del sistema regularmente para identificar problemas y tendencias.", confidence: 0.7, type: 'tip' as const }
    ],
    'data_export': [
      { message: "Exportación: Usa filtros para exportar solo la información específica que necesitas, optimizando el proceso.", confidence: 0.8, type: 'tip' as const },
      { message: "Filtros: Selecciona rangos de fechas específicos para obtener datos relevantes para tu análisis.", confidence: 0.7, type: 'tip' as const },
      { message: "Seguridad: Guarda los archivos exportados en ubicaciones seguras para proteger la información sensible.", confidence: 0.6, type: 'tip' as const }
    ],
    'security_management': [
      { message: "Seguridad: Revisa los logs de acceso regularmente para detectar actividades sospechosas o no autorizadas.", confidence: 0.8, type: 'warning' as const },
      { message: "Permisos: Verifica que cada usuario tenga solo los permisos necesarios para su función, siguiendo el principio de menor privilegio.", confidence: 0.7, type: 'tip' as const },
      { message: "Contraseñas: Cambia las contraseñas periódicamente y asegúrate de que cumplan con las políticas de seguridad.", confidence: 0.6, type: 'tip' as const }
    ],
    'performance_optimization': [
      { message: "Rendimiento: Revisa el uso de recursos del sistema para identificar cuellos de botella y optimizar el rendimiento.", confidence: 0.8, type: 'tip' as const },
      { message: "Mantenimiento: Limpia datos antiguos y archivos temporales para liberar espacio y mejorar el rendimiento del sistema.", confidence: 0.7, type: 'tip' as const },
      { message: "Monitoreo: Revisa las métricas del sistema regularmente para detectar problemas de rendimiento antes de que afecten a los usuarios.", confidence: 0.6, type: 'tip' as const }
    ],
    'reporting': [
      { message: "Reportes: Usa diferentes filtros para generar análisis específicos según tus necesidades de información.", confidence: 0.8, type: 'tip' as const },
      { message: "Exportación: Selecciona el formato de exportación adecuado según el uso que le darás al reporte.", confidence: 0.7, type: 'tip' as const },
      { message: "Automatización: Configura reportes automáticos para recibir información actualizada regularmente sin intervención manual.", confidence: 0.6, type: 'tip' as const }
    ],
    'backup_management': [
      { message: "Importante: Programa respaldos automáticos regulares para proteger la información crítica del sistema.", confidence: 0.9, type: 'warning' as const },
      { message: "Verificación: Confirma que los respaldos se completen exitosamente para asegurar la disponibilidad de los datos.", confidence: 0.8, type: 'tip' as const },
      { message: "Almacenamiento: Guarda los respaldos en ubicaciones seguras y separadas para proteger contra pérdida de datos.", confidence: 0.7, type: 'tip' as const }
    ],
    'integration_setup': [
      { message: "Integración: Verifica la conectividad con sistemas externos para asegurar el flujo correcto de datos.", confidence: 0.8, type: 'tip' as const },
      { message: "Credenciales: Mantén actualizadas las credenciales de acceso para evitar interrupciones en las integraciones.", confidence: 0.7, type: 'tip' as const },
      { message: "Pruebas: Realiza pruebas completas antes de activar nuevas integraciones para evitar problemas en producción.", confidence: 0.6, type: 'tip' as const }
    ],
    'alert_management': [
      { message: "Alertas: Configura notificaciones para eventos importantes del sistema para mantenerte informado sobre cambios críticos.", confidence: 0.8, type: 'warning' as const },
      { message: "Revisión: Revisa las alertas pendientes regularmente para responder a problemas antes de que se agraven.", confidence: 0.7, type: 'tip' as const },
      { message: "Configuración: Ajusta los umbrales de alertas para evitar notificaciones excesivas o insuficientes.", confidence: 0.6, type: 'tip' as const }
    ],
    'location_management': [
      { message: "Organización: Estructura las ubicaciones de forma jerárquica para facilitar la gestión y localización de activos.", confidence: 0.8, type: 'tip' as const },
      { message: "Precisión: Asigna coordenadas GPS a las ubicaciones para mejorar la precisión en la localización de activos.", confidence: 0.7, type: 'tip' as const },
      { message: "Asignación: Asigna activos a ubicaciones específicas para mantener un control preciso del inventario.", confidence: 0.6, type: 'tip' as const }
    ],
    'inventory_audit': [
      { message: "Auditoría: Verifica la información de cada activo para asegurar la precisión del inventario del sistema.", confidence: 0.8, type: 'tip' as const },
      { message: "Verificación: Confirma que las ubicaciones de los activos sean correctas para mantener el control del inventario.", confidence: 0.7, type: 'tip' as const },
      { message: "Reportes: Genera reportes de diferencias para identificar discrepancias entre el inventario físico y el sistema.", confidence: 0.6, type: 'tip' as const }
    ]
  };

  constructor() {
    this.loadUserData();
    this.analyzeUserBehavior();
  }

  getHelpForSection(section: string): HelpTip {
    const baseTip = this.helpTips[section] || { 
      message: "¡Hola! 🐕 ¿Necesitas ayuda? Estoy aquí para guiarte. ¡Haz clic en mí cuando quieras saber más sobre cualquier sección!",
      type: 'info',
      priority: 'low',
      userLevel: 'beginner'
    };

    // Personalizar mensaje basado en el nivel del usuario
    return this.personalizeTip(baseTip, section);
  }

  hasHelpForSection(section: string): boolean {
    return !!this.helpTips[section];
  }

  // Nuevos métodos inteligentes
  recordUserBehavior(behavior: UserBehavior): void {
    const currentBehaviors = this.userBehavior.value;
    currentBehaviors.push(behavior);
    
    // Mantener solo los últimos 100 comportamientos
    if (currentBehaviors.length > 100) {
      currentBehaviors.splice(0, currentBehaviors.length - 100);
    }
    
    this.userBehavior.next(currentBehaviors);
    this.saveUserData();
    this.analyzeUserBehavior();
  }

  getSmartSuggestions(currentSection: string): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];
    const userLevel = this.userLevel.value;
    const behaviors = this.userBehavior.value;

    // Analizar patrones de uso
    const recentBehaviors = behaviors.filter(b => 
      new Date().getTime() - b.timestamp.getTime() < 24 * 60 * 60 * 1000 // Últimas 24 horas
    );

    // Sugerencias basadas en nivel de usuario
    if (userLevel === 'beginner') {
      const newUserSuggestions = this.contextualSuggestions['new_user'];
      suggestions.push(...newUserSuggestions.map(s => ({
        ...s,
        basedOn: ['user_level', 'beginner']
      })));
    }

    // Sugerencias basadas en errores frecuentes
    const errorCount = recentBehaviors.filter(b => b.errors && b.errors.length > 0).length;
    if (errorCount > 3) {
      const errorSuggestions = this.contextualSuggestions['frequent_errors'];
      suggestions.push(...errorSuggestions.map(s => ({
        ...s,
        basedOn: ['error_pattern', 'frequent_errors']
      })));
    }

    // Sugerencias basadas en sección actual
    if (currentSection.includes('procurement')) {
      const procurementSuggestions = this.contextualSuggestions['procurement_workflow'];
      suggestions.push(...procurementSuggestions.map(s => ({
        ...s,
        basedOn: ['workflow', 'procurement']
      })));
    }

    if (currentSection.includes('subnets') || currentSection.includes('devices')) {
      const networkSuggestions = this.contextualSuggestions['network_management'];
      suggestions.push(...networkSuggestions.map(s => ({
        ...s,
        basedOn: ['network', 'management']
      })));
    }

    if (currentSection.includes('assets')) {
      const assetSuggestions = this.contextualSuggestions['asset_tracking'];
      suggestions.push(...assetSuggestions.map(s => ({
        ...s,
        basedOn: ['assets', 'tracking']
      })));
    }

    if (currentSection.includes('software')) {
      const softwareSuggestions = this.contextualSuggestions['software_management'];
      suggestions.push(...softwareSuggestions.map(s => ({
        ...s,
        basedOn: ['software', 'management']
      })));
    }

    if (currentSection.includes('user-management') || currentSection.includes('procurement/usuarios')) {
      const userSuggestions = this.contextualSuggestions['user_administration'];
      suggestions.push(...userSuggestions.map(s => ({
        ...s,
        basedOn: ['users', 'administration']
      })));
    }

    if (currentSection.includes('settings')) {
      const maintenanceSuggestions = this.contextualSuggestions['system_maintenance'];
      suggestions.push(...maintenanceSuggestions.map(s => ({
        ...s,
        basedOn: ['maintenance', 'system']
      })));
    }

    // Sugerencias basadas en patrones de navegación
    const recentSections = recentBehaviors.map(b => b.section);
    const uniqueSections = [...new Set(recentSections)];
    
    if (uniqueSections.length > 5) {
      suggestions.push({
        message: "🎯 Veo que exploras muchas secciones. ¿Te gustaría que te ayude a organizar tu flujo de trabajo?",
        type: 'tip',
        confidence: 0.7,
        basedOn: ['navigation_pattern', 'exploration']
      });
    }

    // Sugerencias basadas en tiempo de sesión
    const sessionDuration = recentBehaviors.reduce((sum, b) => sum + b.duration, 0);
    if (sessionDuration > 30 * 60 * 1000) { // Más de 30 minutos
      suggestions.push({
        message: "⏰ Has estado trabajando por un tiempo. ¿Te gustaría guardar tu progreso?",
        type: 'tip',
        confidence: 0.6,
        basedOn: ['session_duration', 'work_time']
      });
    }

    // Sugerencias basadas en secciones relacionadas
    const relatedSections = this.helpTips[currentSection]?.relatedSections || [];
    if (relatedSections.length > 0) {
      suggestions.push({
        message: `🔗 Secciones relacionadas que podrían interesarte: ${relatedSections.join(', ')}`,
        type: 'tip',
        confidence: 0.6,
        basedOn: ['related_sections', currentSection]
      });
    }

    // Sugerencias específicas para usuarios avanzados
    if (userLevel === 'advanced') {
      if (currentSection.includes('settings')) {
        suggestions.push({
          message: "⚙️ Como usuario avanzado, puedes acceder a configuraciones más detalladas del sistema.",
          type: 'tip',
          confidence: 0.8,
          basedOn: ['user_level', 'advanced', 'settings']
        });
      }
    }

    // Filtrar sugerencias duplicadas y ordenar por confianza
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => s.message === suggestion.message)
    );

    return uniqueSuggestions.sort((a, b) => b.confidence - a.confidence);
  }

  getUserLevel(): Observable<'beginner' | 'intermediate' | 'advanced'> {
    return this.userLevel.asObservable();
  }

  getSmartSuggestionsObservable(): Observable<SmartSuggestion[]> {
    return this.smartSuggestions.asObservable();
  }

  // Métodos privados para IA
  private personalizeTip(tip: HelpTip, section: string): HelpTip {
    const userLevel = this.userLevel.value;
    const behaviors = this.userBehavior.value;
    
    // Personalizar mensaje basado en nivel de usuario
    if (userLevel === 'advanced' && tip.userLevel === 'beginner') {
      tip.message += " 🚀 ¡Como experto, tienes acceso a configuraciones secretas que otros solo pueden soñar!";
    } else if (userLevel === 'beginner' && tip.userLevel === 'advanced') {
      tip.message += " 🎓 ¡Esta sección es para usuarios avanzados! ¡Pero no te preocupes, con práctica llegarás ahí!";
    }

    // Personalizar basado en uso previo
    const sectionUsage = behaviors.filter(b => b.section === section).length;
    if (sectionUsage > 5) {
      tip.message += " 🎯 ¡Veo que te encanta esta sección! ¡Eres como un niño en una tienda de dulces! 🍭";
    }

    return tip;
  }

  private analyzeUserBehavior(): void {
    const behaviors = this.userBehavior.value;
    
    // Determinar nivel de usuario basado en comportamiento
    const totalActions = behaviors.length;
    const uniqueSections = new Set(behaviors.map(b => b.section)).size;
    const averageDuration = behaviors.reduce((sum, b) => sum + b.duration, 0) / behaviors.length;
    const errorRate = behaviors.filter(b => b.errors && b.errors.length > 0).length / totalActions;

    let newLevel: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
    
    if (totalActions > 50 && uniqueSections > 8 && errorRate < 0.1) {
      newLevel = 'advanced';
    } else if (totalActions > 20 && uniqueSections > 4 && errorRate < 0.2) {
      newLevel = 'intermediate';
    }

    this.userLevel.next(newLevel);
    
    // Generar sugerencias inteligentes
    const suggestions = this.generateContextualSuggestions(behaviors);
    this.smartSuggestions.next(suggestions);
  }

  private generateContextualSuggestions(behaviors: UserBehavior[]): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];
    
    // Analizar patrones de navegación
    const recentBehaviors = behaviors.slice(-10);
    const sections = recentBehaviors.map(b => b.section);
    
    // Detectar flujo de trabajo de procurement
    if (sections.some(s => s.includes('procurement'))) {
      suggestions.push({
        message: "💼 ¿Estás trabajando en adquisiciones? Te recomiendo seguir el flujo: Proveedores → Compras → Lotes → Activos",
        type: 'suggestion',
        confidence: 0.8,
        basedOn: ['workflow_analysis', 'procurement_pattern']
      });
    }

    // Detectar problemas de red
    if (sections.includes('subnets') && sections.includes('devices')) {
      suggestions.push({
        message: "🌐 ¿Tienes problemas de red? Revisa la configuración de subnets y la conectividad de dispositivos.",
        type: 'tip',
        confidence: 0.7,
        basedOn: ['network_troubleshooting', 'section_pattern']
      });
    }

    return suggestions;
  }

  private loadUserData(): void {
    try {
      const savedBehaviors = localStorage.getItem('cerbero_user_behavior');
      const savedLevel = localStorage.getItem('cerbero_user_level');
      const savedPreferences = localStorage.getItem('cerbero_user_preferences');

      if (savedBehaviors) {
        const behaviors = JSON.parse(savedBehaviors).map((b: any) => ({
          ...b,
          timestamp: new Date(b.timestamp)
        }));
        this.userBehavior.next(behaviors);
      }

      if (savedLevel) {
        this.userLevel.next(savedLevel as 'beginner' | 'intermediate' | 'advanced');
      }

      if (savedPreferences) {
        this.userPreferences.next(JSON.parse(savedPreferences));
      }
    } catch (error) {
      console.warn('Error loading user data:', error);
    }
  }

  private saveUserData(): void {
    try {
      localStorage.setItem('cerbero_user_behavior', JSON.stringify(this.userBehavior.value));
      localStorage.setItem('cerbero_user_level', this.userLevel.value);
      localStorage.setItem('cerbero_user_preferences', JSON.stringify(this.userPreferences.value));
    } catch (error) {
      console.warn('Error saving user data:', error);
    }
  }

  // Métodos para ayuda contextual de elementos
  getElementContextualHelp(element: HTMLElement): string {
    const elementType = this.getElementType(element);
    const elementText = element.textContent?.trim() || '';
    const elementClass = element.className || '';
    const elementId = element.id || '';
    
    // Ayuda específica basada en el tipo de elemento
    const specificHelp = this.getSpecificElementHelp(elementType, elementText, elementClass, elementId);
    if (specificHelp) {
      return specificHelp;
    }
    
    // Ayuda genérica basada en el tipo
    return this.getGenericElementHelp(elementType);
  }

  private getElementType(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const className = element.className || '';
    const elementId = element.id || '';
    const elementText = element.textContent?.trim() || '';
    const placeholder = element.getAttribute('placeholder') || '';
    
    // === DETECCIÓN DE BOTONES ===
    if (tagName === 'button' || role === 'button' || className.includes('btn')) {
      // Botones específicos por texto
      if (elementText.toLowerCase().includes('guardar') || elementText.toLowerCase().includes('save')) {
        return 'button-save';
      }
      if (elementText.toLowerCase().includes('cancelar') || elementText.toLowerCase().includes('cancel')) {
        return 'button-cancel';
      }
      if (elementText.toLowerCase().includes('editar') || elementText.toLowerCase().includes('edit')) {
        return 'button-edit';
      }
      if (elementText.toLowerCase().includes('eliminar') || elementText.toLowerCase().includes('delete')) {
        return 'button-delete';
      }
      if (elementText.toLowerCase().includes('ver') || elementText.toLowerCase().includes('view')) {
        return 'button-view';
      }
      if (elementText.toLowerCase().includes('agregar') || elementText.toLowerCase().includes('add') || elementText.toLowerCase().includes('nuevo')) {
        return 'button-add';
      }
      if (elementText.toLowerCase().includes('exportar') || elementText.toLowerCase().includes('export')) {
        return 'button-export';
      }
      if (elementText.toLowerCase().includes('importar') || elementText.toLowerCase().includes('import')) {
        return 'button-import';
      }
      if (elementText.toLowerCase().includes('actualizar') || elementText.toLowerCase().includes('refresh') || elementText.toLowerCase().includes('recargar')) {
        return 'button-refresh';
      }
      if (elementText.toLowerCase().includes('filtrar') || elementText.toLowerCase().includes('filter')) {
        return 'button-filter';
      }
      if (elementText.toLowerCase().includes('ordenar') || elementText.toLowerCase().includes('sort')) {
        return 'button-sort';
      }
      if (className.includes('btn-danger') || className.includes('btn-delete')) {
        return 'button-danger';
      }
      if (className.includes('btn-primary')) {
        return 'button-primary';
      }
      if (className.includes('btn-secondary')) {
        return 'button-secondary';
      }
      return 'button-primary';
    }
    
    // === DETECCIÓN DE CAMPOS DE ENTRADA ===
    if (tagName === 'input') {
      const type = element.getAttribute('type') || 'text';
      
      // Campos específicos por placeholder o id
      if (placeholder.toLowerCase().includes('buscar') || placeholder.toLowerCase().includes('search') || 
          elementId.toLowerCase().includes('search') || className.includes('search')) {
        return 'input-search';
      }
      if (type === 'email' || placeholder.toLowerCase().includes('email') || elementId.toLowerCase().includes('email')) {
        return 'input-email';
      }
      if (type === 'password' || elementId.toLowerCase().includes('password')) {
        return 'input-password';
      }
      if (type === 'number' || elementId.toLowerCase().includes('number') || elementId.toLowerCase().includes('cantidad')) {
        return 'input-number';
      }
      if (type === 'date' || elementId.toLowerCase().includes('date') || elementId.toLowerCase().includes('fecha')) {
        return 'input-date';
      }
      if (type === 'file' || elementId.toLowerCase().includes('file')) {
        return 'input-file';
      }
      
      return `input-${type}`;
    }
    
    // === DETECCIÓN DE TABLAS ===
    if (tagName === 'table' || className.includes('table')) {
      if (className.includes('sortable') || element.querySelector('th[onclick]')) {
        return 'table-sortable';
      }
      if (className.includes('filterable') || element.querySelector('.filter-controls')) {
        return 'table-filterable';
      }
      if (className.includes('selectable') || element.querySelector('input[type="checkbox"]')) {
        return 'table-selectable';
      }
      if (className.includes('editable') || element.querySelector('[contenteditable]')) {
        return 'table-editable';
      }
      if (className.includes('paginated') || element.querySelector('.pagination')) {
        return 'table-paginated';
      }
      return 'table';
    }
    
    // === DETECCIÓN DE FORMULARIOS ===
    if (tagName === 'form' || className.includes('form')) {
      if (className.includes('wizard') || element.querySelector('.wizard-step')) {
        return 'form-wizard';
      }
      if (className.includes('dynamic') || element.querySelector('[data-dynamic]')) {
        return 'form-dynamic';
      }
      if (element.querySelector('[required]') || element.querySelector('.validation-error')) {
        return 'form-validation';
      }
      return 'form';
    }
    
    // === DETECCIÓN DE SELECTORES ===
    if (tagName === 'select' || className.includes('select')) {
      if (element.hasAttribute('multiple')) {
        return 'dropdown-multi';
      }
      if (className.includes('searchable') || element.querySelector('.search-input')) {
        return 'dropdown-search';
      }
      return 'dropdown-single';
    }
    
    // === DETECCIÓN DE ENLACES ===
    if (tagName === 'a' || role === 'link' || className.includes('link')) {
      if (className.includes('nav-link')) {
        return 'nav-link';
      }
      if (className.includes('dropdown-toggle')) {
        return 'nav-dropdown';
      }
      if (className.includes('tab-link')) {
        return 'nav-tab';
      }
      return 'link';
    }
    
    // === DETECCIÓN DE MODALES ===
    if (className.includes('modal') || className.includes('dialog') || role === 'dialog') {
      if (className.includes('confirmation') || elementText.toLowerCase().includes('confirmar')) {
        return 'modal-confirmation';
      }
      if (className.includes('details') || elementText.toLowerCase().includes('detalles')) {
        return 'modal-details';
      }
      if (className.includes('form') || element.querySelector('form')) {
        return 'modal-form';
      }
      return 'modal';
    }
    
    // === DETECCIÓN DE ELEMENTOS ESPECÍFICOS ===
    if (className.includes('dropdown') || className.includes('menu')) {
      return 'dropdown-single';
    }
    if (className.includes('tooltip') || element.hasAttribute('title')) {
      return 'info-tooltip';
    }
    if (className.includes('status') || className.includes('indicator')) {
      return 'status-indicator';
    }
    if (className.includes('progress')) {
      return 'progress-bar';
    }
    if (className.includes('notification') || className.includes('alert')) {
      return 'notification';
    }
    if (className.includes('breadcrumb')) {
      return 'nav-breadcrumb';
    }
    if (className.includes('login') || elementId.includes('login')) {
      return 'login-form';
    }
    if (className.includes('logout') || elementText.toLowerCase().includes('cerrar sesión')) {
      return 'logout-button';
    }
    if (className.includes('profile') || elementId.includes('profile')) {
      return 'profile-menu';
    }
    if (className.includes('settings') || elementId.includes('settings')) {
      return 'settings-link';
    }
    
    return tagName;
  }

  private getSpecificElementHelp(elementType: string, text: string, className: string, id: string): string {
    const specificHelp: { [key: string]: string } = {
      // === CAMPOS DE BÚSQUEDA ===
      'input-search': '🔍 Busca equipos por nombre, IP, ubicación o cualquier dato. Usa palabras clave para encontrar rápidamente lo que necesitas.',
      'input-email': '📧 Campo para correo electrónico. Debe tener formato válido (ejemplo@empresa.com).',
      'input-password': '🔒 Contraseña segura. Mínimo 8 caracteres, incluye mayúsculas, minúsculas y números.',
      'input-number': '🔢 Solo números. Para cantidades, precios, puertos o cualquier valor numérico.',
      'input-date': '📅 Selecciona fecha del calendario. Para fechas de compra, garantía, mantenimiento.',
      'input-file': '📁 Sube archivos Excel, CSV o PDF. Máximo 10MB. Para importar datos o adjuntar documentos.',
      
      // === BOTONES DE ACCIÓN ===
      'button-primary': '🖱️ Acción principal. Ejecuta la función más importante de esta sección.',
      'button-secondary': '🖱️ Acción secundaria. Función adicional o alternativa disponible.',
      'button-danger': '⚠️ Acción destructiva. Elimina, cancela o revierte cambios. ¡No se puede deshacer!',
      'button-save': '💾 Guarda los cambios realizados. Asegúrate de completar todos los campos requeridos.',
      'button-cancel': '❌ Cancela la operación actual. Los cambios no guardados se perderán.',
      'button-edit': '✏️ Modifica la información seleccionada. Abre el formulario de edición.',
      'button-delete': '🗑️ Elimina permanentemente el elemento. Requiere confirmación.',
      'button-view': '👁️ Muestra detalles completos. Información detallada del elemento.',
      'button-add': '➕ Crea un nuevo registro. Abre formulario en blanco para agregar.',
      'button-export': '📤 Descarga datos en Excel/PDF. Selecciona el formato y rango de fechas.',
      'button-import': '📥 Sube archivo con datos. Verifica el formato antes de importar.',
      'button-refresh': '🔄 Actualiza la información. Obtiene datos más recientes del servidor.',
      'button-filter': '🎯 Aplica filtros. Muestra solo los elementos que cumplan los criterios.',
      'button-sort': '📊 Ordena la lista. Haz clic en encabezados para cambiar el orden.',
      
      // === TABLAS Y LISTAS ===
      'table-sortable': '📊 Tabla ordenable. Haz clic en encabezados para ordenar por esa columna (ascendente/descendente).',
      'table-filterable': '🎯 Tabla con filtros. Usa los controles para mostrar solo la información que necesitas.',
      'table-selectable': '☑️ Tabla con selección. Marca casillas para seleccionar múltiples elementos.',
      'table-editable': '✏️ Tabla editable. Haz doble clic en celdas para editar directamente.',
      'table-paginated': '📄 Tabla paginada. Navega entre páginas para ver más resultados.',
      
      // === FORMULARIOS ===
      'form-validation': '✅ Formulario con validación. Los campos marcados con * son obligatorios. Revisa errores antes de guardar.',
      'form-wizard': '🧙‍♂️ Formulario por pasos. Completa cada sección antes de continuar al siguiente paso.',
      'form-dynamic': '🔄 Formulario dinámico. Los campos cambian según las opciones seleccionadas.',
      
      // === MODALES Y VENTANAS ===
      'modal-confirmation': '❓ Ventana de confirmación. Confirma si quieres proceder con esta acción importante.',
      'modal-details': '📋 Ventana de detalles. Información completa sin salir de la página actual.',
      'modal-form': '📝 Ventana de formulario. Completa la información sin perder el contexto.',
      
      // === DROPDOWNS Y SELECTORES ===
      'dropdown-multi': '📋 Lista múltiple. Selecciona varias opciones manteniendo Ctrl (Cmd en Mac).',
      'dropdown-single': '📋 Lista simple. Selecciona una opción de la lista desplegable.',
      'dropdown-search': '🔍 Lista con búsqueda. Escribe para filtrar las opciones disponibles.',
      
      // === FUNCIONALIDADES ESPECÍFICAS ===
      'search-advanced': '🔍 Búsqueda avanzada. Usa múltiples criterios para encontrar información específica.',
      'export-excel': '📊 Exporta a Excel. Descarga datos en formato .xlsx para análisis en hojas de cálculo.',
      'export-pdf': '📄 Exporta a PDF. Genera reportes en formato de documento imprimible.',
      'import-bulk': '📥 Importación masiva. Sube archivo Excel/CSV con múltiples registros de una vez.',
      'save-draft': '💾 Guarda borrador. Conserva tu trabajo sin publicarlo. Puedes continuar después.',
      'delete-confirm': '🗑️ Elimina con confirmación. Esta acción es permanente y no se puede deshacer.',
      'edit-inline': '✏️ Edita en línea. Modifica directamente en la tabla sin abrir formularios.',
      'view-details': '👁️ Ver detalles completos. Información completa del elemento seleccionado.',
      'add-new': '➕ Agregar nuevo. Crea un nuevo registro con formulario en blanco.',
      'refresh-data': '🔄 Actualiza datos. Obtiene la información más reciente del servidor.',
      
      // === ELEMENTOS DE NAVEGACIÓN ===
      'nav-link': '🧭 Enlace de navegación. Te lleva a otra sección del sistema.',
      'nav-dropdown': '📂 Menú desplegable. Contiene subsecciones relacionadas.',
      'nav-tab': '📑 Pestaña de navegación. Cambia entre diferentes vistas de la misma sección.',
      'nav-breadcrumb': '🍞 Migas de pan. Muestra tu ubicación actual en el sistema.',
      
      // === ELEMENTOS DE INFORMACIÓN ===
      'info-tooltip': 'ℹ️ Información adicional. Pasa el mouse para ver detalles o ayuda.',
      'status-indicator': '🟢 Indicador de estado. Muestra el estado actual (activo, inactivo, error, etc.).',
      'progress-bar': '📊 Barra de progreso. Muestra el avance de una operación en curso.',
      'notification': '🔔 Notificación. Mensaje importante del sistema o actualización.',
      
      // === ELEMENTOS DE ACCESO ===
      'login-form': '🔐 Formulario de inicio de sesión. Ingresa tu usuario y contraseña para acceder.',
      'logout-button': '👋 Cerrar sesión. Cierra tu sesión actual y vuelve a la pantalla de login.',
      'profile-menu': '👤 Menú de perfil. Accede a tu información personal y configuración.',
      'settings-link': '⚙️ Configuración. Ajusta preferencias y configuraciones del sistema.'
    };
    
    // Buscar ayuda específica basada en texto o clase
    for (const [key, help] of Object.entries(specificHelp)) {
      if (text.toLowerCase().includes(key.split('-')[1]) || 
          className.toLowerCase().includes(key.split('-')[1]) ||
          id.toLowerCase().includes(key.split('-')[1])) {
        return help;
      }
    }
    
    // Ayuda específica para elementos de Cerbero
    const cerberoSpecificHelp = this.getCerberoSpecificHelp(elementType, text, className, id);
    if (cerberoSpecificHelp) {
      return cerberoSpecificHelp;
    }
    
    return '';
  }

  private getCerberoSpecificHelp(elementType: string, text: string, className: string, id: string): string {
    // Ayuda específica para elementos de Cerbero
    const cerberoHelp: { [key: string]: string } = {
      // === ELEMENTOS DE ASSETS ===
      'asset-name': '💻 Nombre del equipo. Identificador único del activo en el sistema.',
      'asset-type': '🏷️ Tipo de activo. Desktop, Laptop, Server, etc. Define la categoría del equipo.',
      'asset-location': '📍 Ubicación física. Dónde está ubicado el equipo (edificio, piso, oficina).',
      'asset-status': '🟢 Estado del activo. Activo, Inactivo, En mantenimiento, Retirado.',
      'asset-user': '👤 Usuario asignado. Persona responsable del equipo.',
      'asset-ip': '🌐 Dirección IP. Identificador de red del equipo.',
      'asset-mac': '🔗 Dirección MAC. Identificador físico único de la tarjeta de red.',
      'asset-serial': '📋 Número de serie. Identificador único del fabricante.',
      'asset-warranty': '🛡️ Garantía. Fecha de vencimiento y condiciones de garantía.',
      'asset-purchase': '🛒 Información de compra. Fecha, proveedor, precio, factura.',
      
      // === ELEMENTOS DE PROCUREMENT ===
      'purchase-order': '📋 Orden de compra. Número único de la transacción de compra.',
      'purchase-date': '📅 Fecha de compra. Cuándo se realizó la adquisición.',
      'purchase-amount': '💰 Monto de compra. Precio total de la transacción.',
      'purchase-supplier': '🏢 Proveedor. Empresa que vendió el producto o servicio.',
      'purchase-status': '📊 Estado de compra. Pendiente, Aprobada, En proceso, Completada.',
      'purchase-items': '📦 Items de compra. Lista de productos o servicios adquiridos.',
      
      // === ELEMENTOS DE NETWORK ===
      'subnet-name': '🌐 Nombre de subred. Identificador de la red (ej: 192.168.1.0/24).',
      'subnet-range': '📡 Rango de IPs. Direcciones disponibles en la subred.',
      'subnet-gateway': '🚪 Gateway. Puerta de enlace de la subred.',
      'subnet-dns': '🔍 Servidores DNS. Servidores de resolución de nombres.',
      'subnet-vlan': '🏷️ VLAN. Identificador de red virtual.',
      
      // === ELEMENTOS DE SOFTWARE ===
      'software-name': '💾 Nombre del software. Programa instalado en el equipo.',
      'software-version': '📋 Versión. Número de versión del software.',
      'software-license': '📜 Licencia. Tipo y estado de la licencia de software.',
      'software-install-date': '📅 Fecha de instalación. Cuándo se instaló el software.',
      'software-publisher': '🏢 Editor. Empresa que desarrolló el software.',
      
      // === ELEMENTOS DE DEVICES ===
      'device-name': '🖨️ Nombre del dispositivo. Identificador del periférico.',
      'device-type': '🏷️ Tipo de dispositivo. Impresora, Escáner, Switch, etc.',
      'device-model': '📋 Modelo. Modelo específico del dispositivo.',
      'device-manufacturer': '🏢 Fabricante. Empresa que fabricó el dispositivo.',
      'device-connection': '🔗 Tipo de conexión. USB, Ethernet, WiFi, Bluetooth.',
      'device-status': '🟢 Estado de conexión. Conectado, Desconectado, Error.',
      
      // === ELEMENTOS DE LOCATIONS ===
      'location-name': '📍 Nombre de ubicación. Identificador del lugar físico.',
      'location-type': '🏢 Tipo de ubicación. Oficina, Almacén, Sala de servidores.',
      'location-address': '🏠 Dirección física. Dirección completa del lugar.',
      'location-contact': '📞 Contacto. Persona responsable de la ubicación.',
      'location-capacity': '👥 Capacidad. Número máximo de personas/equipos.',
      
      // === ELEMENTOS DE USERS ===
      'user-name': '👤 Nombre de usuario. Identificador único del usuario.',
      'user-email': '📧 Correo electrónico. Email de contacto del usuario.',
      'user-role': '🎭 Rol del usuario. Administrador, Usuario, Supervisor.',
      'user-department': '🏢 Departamento. Área de trabajo del usuario.',
      'user-status': '🟢 Estado del usuario. Activo, Inactivo, Bloqueado.',
      
      // === ELEMENTOS DE REPORTS ===
      'report-type': '📊 Tipo de reporte. Inventario, Compras, Software, etc.',
      'report-date-range': '📅 Rango de fechas. Período que cubre el reporte.',
      'report-format': '📄 Formato de salida. Excel, PDF, CSV.',
      'report-filters': '🎯 Filtros aplicados. Criterios de selección de datos.',
      
      // === ELEMENTOS DE SETTINGS ===
      'setting-category': '⚙️ Categoría de configuración. General, Seguridad, Red, etc.',
      'setting-name': '🔧 Nombre del ajuste. Identificador de la configuración.',
      'setting-value': '💾 Valor actual. Configuración actual del sistema.',
      'setting-description': '📝 Descripción. Explicación de qué hace esta configuración.',
      
      // === ELEMENTOS DE FILTERS ===
      'filter-type': '🎯 Tipo de filtro. Por fecha, estado, tipo, ubicación.',
      'filter-value': '📋 Valor del filtro. Criterio específico de filtrado.',
      'filter-operator': '🔍 Operador. Igual, Contiene, Mayor que, Menor que.',
      'filter-clear': '🧹 Limpiar filtros. Remueve todos los filtros aplicados.',
      
      // === ELEMENTOS DE SORTING ===
      'sort-column': '📊 Columna de ordenamiento. Campo por el cual se ordena la lista.',
      'sort-direction': '⬆️ Dirección de ordenamiento. Ascendente o descendente.',
      'sort-multi': '📋 Ordenamiento múltiple. Ordenar por varios campos.',
      
      // === ELEMENTOS DE PAGINATION ===
      'page-size': '📄 Tamaño de página. Número de elementos por página.',
      'page-number': '🔢 Número de página. Página actual de resultados.',
      'page-total': '📊 Total de páginas. Número total de páginas disponibles.',
      'page-navigation': '🧭 Navegación. Botones para ir a primera, anterior, siguiente, última página.',
      
      // === ELEMENTOS DE VALIDATION ===
      'validation-error': '❌ Error de validación. Campo con formato incorrecto o requerido.',
      'validation-success': '✅ Validación exitosa. Campo con formato correcto.',
      'validation-warning': '⚠️ Advertencia. Campo que podría tener problemas.',
      'validation-info': 'ℹ️ Información de validación. Ayuda sobre el formato esperado.',
      
      // === ELEMENTOS DE NOTIFICATIONS ===
      'notification-success': '✅ Notificación de éxito. Operación completada correctamente.',
      'notification-error': '❌ Notificación de error. Problema que requiere atención.',
      'notification-warning': '⚠️ Notificación de advertencia. Situación que requiere revisión.',
      'notification-info': 'ℹ️ Notificación informativa. Información general del sistema.',
      
      // === ELEMENTOS DE LOADING ===
      'loading-spinner': '⏳ Indicador de carga. El sistema está procesando tu solicitud.',
      'loading-text': '📝 Texto de carga. Mensaje explicativo durante la operación.',
      'loading-progress': '📊 Barra de progreso. Avance de la operación en curso.',
      
      // === ELEMENTOS DE CONFIRMATION ===
      'confirm-title': '❓ Título de confirmación. Acción que requiere confirmación.',
      'confirm-message': '📝 Mensaje de confirmación. Explicación de la acción a realizar.',
      'confirm-yes': '✅ Confirmar. Proceder con la acción.',
      'confirm-no': '❌ Cancelar. No proceder con la acción.',
      
      // === ELEMENTOS DE SEARCH ===
      'search-input': '🔍 Campo de búsqueda. Escribe para encontrar información.',
      'search-button': '🔍 Botón de búsqueda. Ejecuta la búsqueda con los criterios ingresados.',
      'search-clear': '🧹 Limpiar búsqueda. Remueve los criterios de búsqueda.',
      'search-results': '📊 Resultados de búsqueda. Lista de elementos encontrados.',
      'search-no-results': '😔 Sin resultados. No se encontraron elementos con los criterios.',
      
      // === ELEMENTOS DE EXPORT ===
      'export-button': '📤 Botón de exportar. Descarga los datos en formato de archivo.',
      'export-format': '📄 Formato de exportación. Excel, PDF, CSV, etc.',
      'export-range': '📅 Rango de exportación. Período de datos a exportar.',
      'export-filters': '🎯 Filtros de exportación. Criterios aplicados a la exportación.',
      
      // === ELEMENTOS DE IMPORT ===
      'import-button': '📥 Botón de importar. Sube archivo con datos para importar.',
      'import-template': '📋 Plantilla de importación. Archivo de ejemplo con formato correcto.',
      'import-validation': '✅ Validación de importación. Verificación de datos antes de importar.',
      'import-progress': '📊 Progreso de importación. Avance del proceso de importación.',
      
      // === ELEMENTOS DE BULK ACTIONS ===
      'bulk-select': '☑️ Selección masiva. Selecciona múltiples elementos para acciones en lote.',
      'bulk-action': '⚡ Acción masiva. Aplica la misma acción a múltiples elementos.',
      'bulk-delete': '🗑️ Eliminación masiva. Elimina múltiples elementos de una vez.',
      'bulk-export': '📤 Exportación masiva. Exporta múltiples elementos seleccionados.',
      'bulk-update': '✏️ Actualización masiva. Actualiza múltiples elementos con los mismos datos.'
    };
    
    // Buscar ayuda específica de Cerbero
    for (const [key, help] of Object.entries(cerberoHelp)) {
      if (text.toLowerCase().includes(key.split('-')[1]) || 
          className.toLowerCase().includes(key.split('-')[1]) ||
          id.toLowerCase().includes(key.split('-')[1])) {
        return help;
      }
    }
    
    return '';
  }

  private getGenericElementHelp(elementType: string): string {
    const genericHelp: { [key: string]: string } = {
      'button': '🖱️ Haz clic para ejecutar una acción',
      'input': '⌨️ Escribe aquí para ingresar información',
      'input-text': '⌨️ Escribe texto en este campo',
      'input-email': '📧 Ingresa tu dirección de correo electrónico',
      'input-password': '🔒 Ingresa tu contraseña de forma segura',
      'input-number': '🔢 Ingresa un valor numérico',
      'input-date': '📅 Selecciona una fecha del calendario',
      'input-file': '📁 Selecciona un archivo para subir',
      'select': '📋 Selecciona una opción de la lista desplegable',
      'textarea': '📝 Área de texto - Puedes escribir múltiples líneas',
      'table': '📊 Tabla de datos - Puedes ordenar y filtrar las columnas',
      'form': '📝 Formulario - Completa todos los campos requeridos',
      'link': '🔗 Enlace - Haz clic para navegar a otra página',
      'modal': '🪟 Ventana emergente - Cierra con X o presionando ESC',
      'dropdown': '📂 Menú desplegable - Haz clic para ver las opciones',
      'search': '🔍 Busca información específica en esta sección',
      'filter': '🎯 Filtra los resultados mostrados',
      'export': '📤 Descarga los datos en un archivo',
      'import': '📥 Sube datos desde un archivo',
      'save': '💾 Guarda los cambios realizados',
      'delete': '🗑️ Elimina el elemento seleccionado',
      'edit': '✏️ Edita la información mostrada',
      'view': '👁️ Ver detalles completos del elemento',
      'add': '➕ Agregar un nuevo elemento',
      'refresh': '🔄 Actualizar la información mostrada',
      'a': '🔗 Enlace de navegación',
      'div': '📦 Contenedor de elementos',
      'span': '📝 Texto o etiqueta',
      'img': '🖼️ Imagen o icono',
      'nav': '🧭 Navegación principal',
      'header': '📋 Encabezado de la página',
      'footer': '📄 Pie de página',
      'main': '📄 Contenido principal',
      'aside': '📋 Panel lateral o información adicional'
    };
    
    return genericHelp[elementType] || 'ℹ️ Elemento interactivo - Haz clic para interactuar';
  }

  // Método para obtener ayuda contextual de sección
  getSectionContextualHelp(section: string): string {
    const sectionHelp: { [key: string]: string } = {
      'dashboard': '📊 Panel principal - Aquí puedes ver un resumen de todo el sistema',
      'assets': '💻 Gestión de activos - Administra todas las computadoras y equipos',
      'devices': '🖨️ Dispositivos - Gestiona impresoras, escáneres y periféricos',
      'software': '🔍 Software - Consulta qué programas están instalados',
      'procurement': '🛒 Adquisiciones - Gestiona compras, proveedores y activos',
      'subnets': '🌐 Redes - Administra la configuración de red y subredes',
      'locations': '📍 Ubicaciones - Gestiona las ubicaciones físicas',
      'settings': '⚙️ Configuración - Ajustes avanzados del sistema',
      'user-management': '👥 Usuarios - Administra usuarios y permisos'
    };
    
    return sectionHelp[section] || 'ℹ️ Sección del sistema - Explora las opciones disponibles';
  }

  // Método para detectar elementos que necesitan ayuda contextual
  getElementsNeedingHelp(): string[] {
    return [
      '[data-help]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '.btn',
      '.nav-link',
      '.dropdown-toggle',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '.table',
      '.form',
      '.modal',
      '.search',
      '.filter',
      '.export',
      '.import'
    ];
  }
} 