import { Injectable } from '@angular/core';

export interface HelpTip {
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class HelperService {
  private helpTips: { [key: string]: HelpTip } = {
    dashboard: {
      message: "¡Hola! 👋 Aquí podrás monitorear todos los cambios importantes en tu red. Los cuadros de colores te muestran alertas sobre cambios en hardware, nuevos equipos y uso de disco. ¡Usa el botón 'Verificar cambios' para actualizar!"
    },
    assets: {
      message: "En esta sección encontrarás todas las computadoras registradas. 💻 Puedes ver detalles como su ubicación, hardware y estado actual. ¡Haz clic en cualquier terminal para ver más información!"
    },
    'asset-details': {
      message: "Aquí puedes ver toda la información detallada de un terminal específico: hardware, usuario asignado, ubicación, compras y activos relacionados. ¡Explora cada sección para más detalles!"
    },
    devices: {
      message: "¡Bienvenido a la sección de dispositivos! 🖨️ Aquí gestionamos impresoras, escáneres y otros periféricos. Puedes ver su estado de conexión y ubicación. ¡Todo ordenado y fácil de encontrar!"
    },
    'device-details': {
      message: "Aquí puedes ver información detallada de un dispositivo específico, incluyendo su estado de red, ubicación y características técnicas."
    },
    software: {
      message: "¿Necesitas saber qué software está instalado? 🔍 Esta sección te muestra todo el software en tu red. Puedes filtrar por equipo y ver detalles de instalación. ¡El botón del ojo te permite mostrar u ocultar programas!"
    },
    'procurement/activos': {
      message: "Gestiona todos los activos de la organización: registra, edita, elimina y consulta información de cada activo, incluyendo su relación con hardware y compras."
    },
    'procurement/compras': {
      message: "Aquí puedes ver y registrar todas las compras realizadas. Consulta detalles, fechas, montos y relaciónalas con activos o lotes."
    },
    'procurement/entregas': {
      message: "Gestiona las entregas de activos y equipos. Lleva el control de qué, cuándo y a quién se entregó cada elemento."
    },
    'procurement/lotes': {
      message: "Administra los lotes de compras y activos. Un lote agrupa varios ítems adquiridos en una misma compra o entrega."
    },
    'procurement/proveedores': {
      message: "Consulta y administra los proveedores de la organización. Mantén actualizada la información de contacto y los servicios que ofrecen."
    },
    'procurement/tipos-activo': {
      message: "Define y gestiona los diferentes tipos de activos que existen en la organización. Esto ayuda a clasificar y organizar mejor los recursos."
    },
    'procurement/tipos-compra': {
      message: "Configura los tipos de compra disponibles, como licencias, hardware, servicios, etc. Esto facilita la clasificación de las adquisiciones."
    },
    'procurement/servicios-garantia': {
      message: "Administra los servicios de garantía asociados a los activos. Lleva el control de fechas, proveedores y condiciones de garantía."
    },
    'procurement/usuarios': {
      message: "Gestiona los usuarios responsables de los activos y compras. Asigna roles y mantén actualizada la información de cada usuario."
    },
    subnets: {
      message: "¡Bienvenido al centro de redes! 🌐 Aquí puedes ver todas tus subredes, la distribución de IPs y gestionar la configuración de red. ¡Mantén tu red organizada y segura!"
    },
    settings: {
      message: "¡Cuidado! ⚠️ Esta es la zona de configuración avanzada. Aquí puedes modificar ajustes importantes del sistema. ¡Asegúrate de saber lo que haces antes de cambiar algo!"
    },
    locations: {
      message: "Consulta y administra todas las ubicaciones físicas de la organización. Así puedes saber dónde está cada activo o dispositivo."
    }
  };

  getHelpForSection(section: string): HelpTip {
    return this.helpTips[section] || { 
      message: "¡Hola! 🐕 ¿Necesitas ayuda? Estoy aquí para guiarte. ¡Haz clic en mí cuando quieras saber más sobre cualquier sección!" 
    };
  }

  hasHelpForSection(section: string): boolean {
    return !!this.helpTips[section];
  }
} 