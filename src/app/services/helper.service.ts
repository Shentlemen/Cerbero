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
    devices: {
      message: "¡Bienvenido a la sección de dispositivos! 🖨️ Aquí gestionamos impresoras, escáneres y otros periféricos. Puedes ver su estado de conexión y ubicación. ¡Todo ordenado y fácil de encontrar!"
    },
    software: {
      message: "¿Necesitas saber qué software está instalado? 🔍 Esta sección te muestra todo el software en tu red. Puedes filtrar por equipo y ver detalles de instalación. ¡El botón del ojo te permite mostrar u ocultar programas!"
    },
    procurement: {
      message: "¡Organiza tus compras aquí! 🛒 Registra nuevos equipos, software y lleva un control de todas las adquisiciones. ¡Mantén un historial ordenado de todo lo que se compra!"
    },
    subnets: {
      message: "¡Bienvenido al centro de redes! 🌐 Aquí puedes ver todas tus subredes, la distribución de IPs y gestionar la configuración de red. ¡Mantén tu red organizada y segura!"
    },
    settings: {
      message: "¡Cuidado! ⚠️ Esta es la zona de configuración avanzada. Aquí puedes modificar ajustes importantes del sistema. ¡Asegúrate de saber lo que haces antes de cambiar algo!"
    }
  };

  getHelpForSection(section: string): HelpTip {
    return this.helpTips[section] || { 
      message: "¡Hola! 🐕 ¿Necesitas ayuda? Estoy aquí para guiarte. ¡Haz clic en mí cuando quieras saber más sobre cualquier sección!" 
    };
  }
} 