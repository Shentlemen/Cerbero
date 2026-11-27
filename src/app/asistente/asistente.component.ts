import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AsistenteRespuesta, AsistenteService } from './asistente.service';

interface MensajeChat {
  rol: 'vos' | 'asistente';
  texto: string;
  sql?: string;
  columnas?: string[];
  filas?: Record<string, string>[];
  error?: boolean;
}

@Component({
  selector: 'app-asistente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asistente.component.html',
  styleUrls: ['./asistente.component.css']
})
export class AsistenteComponent implements OnInit {
  @ViewChild('hilo') hilo?: ElementRef<HTMLElement>;
  /** En el popup del perro se achica el encabezado. La conversación es la misma instancia. */
  @Input() compacto = false;

  pregunta = '';
  enviando = false;
  estadoTexto = 'Revisando si el asistente está instalado…';
  disponible = false;
  mensajes: MensajeChat[] = [];

  constructor(private asistente: AsistenteService) {}

  ngOnInit(): void {
    this.revisarEstado();
  }

  revisarEstado(): void {
    this.estadoTexto = 'Revisando si el asistente está instalado…';
    this.asistente.estado().subscribe({
      next: (estado) => {
        this.disponible = !!estado?.disponible;
        this.estadoTexto = estado?.mensaje || (this.disponible
          ? 'Listo para consultar el inventario.'
          : 'El asistente todavía no está instalado. El resto de Cerbero funciona igual.');
      },
      error: () => {
        this.disponible = false;
        this.estadoTexto = 'No pude revisar el asistente. El resto de Cerbero funciona igual.';
      }
    });
  }

  enviar(): void {
    const texto = this.pregunta.trim();
    if (!texto || this.enviando) {
      return;
    }
    const sqlPrevio = this.ultimoSql();
    const historial = this.mensajes.slice(-6).map((mensaje) => ({
      rol: mensaje.rol,
      texto: mensaje.texto,
      sql: mensaje.sql || ''
    }));
    this.mensajes.push({ rol: 'vos', texto });
    this.pregunta = '';
    this.enviando = true;
    this.bajar();

    this.asistente.preguntar(texto, sqlPrevio, historial).subscribe({
      next: (respuesta) => {
        this.mensajes.push(this.armarRespuesta(respuesta));
        this.enviando = false;
        this.bajar();
      },
      error: () => {
        this.mensajes.push({
          rol: 'asistente',
          error: true,
          texto: 'No pude hablar con el asistente. Cerbero sigue funcionando igual: podés usar el resto del sistema.'
        });
        this.enviando = false;
        this.bajar();
      }
    });
  }

  onEnter(event: Event): void {
    const tecla = event as KeyboardEvent;
    if (tecla.shiftKey) {
      return;
    }
    tecla.preventDefault();
    this.enviar();
  }

  private ultimoSql(): string {
    for (let i = this.mensajes.length - 1; i >= 0; i--) {
      const sql = this.mensajes[i].sql;
      if (this.mensajes[i].rol === 'asistente' && sql) {
        return sql;
      }
    }
    return '';
  }

  private armarRespuesta(respuesta: AsistenteRespuesta | null): MensajeChat {
    const texto = respuesta?.respuesta
      || respuesta?.mensaje
      || 'No hubo respuesta. Cerbero sigue funcionando igual.';
    return {
      rol: 'asistente',
      error: respuesta?.success === false,
      texto: this.textoVisible(texto, respuesta?.filas?.length || 0),
      sql: respuesta?.sql || '',
      columnas: respuesta?.columnas || [],
      filas: respuesta?.filas || []
    };
  }

  /** El globo nunca muestra el SELECT. Si se coló, queda el resultado o un mensaje claro. */
  private textoVisible(texto: string, filas: number): string {
    if (/\bselect\b/i.test(texto) && /\bfrom\b/i.test(texto)) {
      if (filas > 0) {
        const sufijo = filas === 1 ? '' : 's';
        return `Encontré ${filas} fila${sufijo}. Te las dejo en la tabla.`;
      }
      return 'Pediste un dato del inventario, pero no pude mostrar el resultado. Probá de nuevo con una frase corta.';
    }
    return texto;
  }

  private bajar(): void {
    setTimeout(() => {
      const el = this.hilo?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }
}
