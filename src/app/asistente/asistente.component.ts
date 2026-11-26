import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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

  pregunta = '';
  enviando = false;
  estadoTexto = 'Revisando si el asistente está instalado…';
  disponible = false;
  mensajes: MensajeChat[] = [];

  readonly ejemplos = [
    '¿Cuántos equipos tenemos con Windows 7?',
    '¿Cuántos equipos hay en total, sin contar los dados de baja?',
    'Listame equipos que no reportan hace más de 30 días'
  ];

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

  usarEjemplo(texto: string): void {
    this.pregunta = texto;
    this.enviar();
  }

  enviar(): void {
    const texto = this.pregunta.trim();
    if (!texto || this.enviando) {
      return;
    }
    this.mensajes.push({ rol: 'vos', texto });
    this.pregunta = '';
    this.enviando = true;
    this.bajar();

    this.asistente.preguntar(texto).subscribe({
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

  private armarRespuesta(respuesta: AsistenteRespuesta | null): MensajeChat {
    const texto = respuesta?.respuesta
      || respuesta?.mensaje
      || 'No hubo respuesta. Cerbero sigue funcionando igual.';
    return {
      rol: 'asistente',
      error: respuesta?.success === false,
      texto,
      sql: respuesta?.sql || '',
      columnas: respuesta?.columnas || [],
      filas: respuesta?.filas || []
    };
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
