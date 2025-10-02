import { Directive, ElementRef, HostListener, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Directive({
  selector: '[appCurrencyMask]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyMaskDirective),
      multi: true
    }
  ]
})
export class CurrencyMaskDirective implements ControlValueAccessor {
  private onChange: (v: number | null) => void = () => {};
  private onTouched: () => void = () => {};
  private formatter = new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  private isEditing = false;
  private lastCursorPosition = 0;
  private lastValue = '';
  private editingValue = '';

  constructor(private el: ElementRef<HTMLInputElement>) {}

  writeValue(value: number | null): void {
    if (value == null || isNaN(value as any)) {
      this.el.nativeElement.value = '';
      this.lastValue = '';
    } else {
      const formatted = this.formatter.format(value);
      this.el.nativeElement.value = formatted;
      this.lastValue = formatted;
    }
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.el.nativeElement.disabled = isDisabled; }

  @HostListener('input', ['$event'])
  onInput(event: any) {
    const input = this.el.nativeElement;
    const cursorPosition = input.selectionStart || 0;
    const currentValue = input.value;
    
    // Si el valor no cambió, no hacer nada
    if (currentValue === this.lastValue) {
      return;
    }

    // Extraer solo dígitos
    const digits = currentValue.replace(/\D/g, '');
    const numericValue = digits ? parseInt(digits, 10) / 100 : 0;
    
    // Actualizar el valor del formulario
    this.onChange(numericValue);
    
    // Si estamos editando en el medio, NO formatear inmediatamente
    if (this.isEditing && cursorPosition > 0 && cursorPosition < currentValue.length) {
      this.editingValue = currentValue;
      this.lastValue = currentValue;
      return;
    }

    // Formatear el valor solo si no estamos editando
    const formattedValue = this.formatter.format(numericValue);
    
    // Solo actualizar si el valor formateado es diferente
    if (formattedValue !== currentValue) {
      input.value = formattedValue;
      this.lastValue = formattedValue;
    } else {
      this.lastValue = currentValue;
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    const input = this.el.nativeElement;
    const cursorPosition = input.selectionStart || 0;
    
    // Detectar si el usuario está editando en el medio del texto
    if (cursorPosition > 0 && cursorPosition < input.value.length) {
      this.isEditing = true;
      this.lastCursorPosition = cursorPosition;
    } else {
      this.isEditing = false;
    }
  }

  @HostListener('keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    // Formateo inmediato si estamos editando
    if (this.isEditing) {
      this.finalizeEditing();
    }
  }

  @HostListener('focus')
  onFocus() {
    this.isEditing = false;
    this.editingValue = '';
    this.lastValue = this.el.nativeElement.value;
  }

  @HostListener('blur')
  onBlur() {
    this.onTouched();
    this.isEditing = false;
    this.editingValue = '';
    
    // Re-formatear al salir
    this.finalizeEditing();
  }

  private finalizeEditing() {
    const input = this.el.nativeElement;
    const oldValue = input.value;
    const oldCursor = input.selectionStart ?? oldValue.length;

    const digits = oldValue.replace(/\D/g, '');
    const cents = digits ? parseInt(digits, 10) : 0;
    const formattedValue = this.formatter.format(cents / 100);

    if (formattedValue !== oldValue) {
      // Calcular nueva posición ANTES de modificar el value
      const newCursor = this.calculateCursorPosition(formattedValue, oldCursor, oldValue);

      // Asignar valor formateado
      input.value = formattedValue;
      this.lastValue = formattedValue;

      // Restaurar posición
      setTimeout(() => {
        input.setSelectionRange(newCursor, newCursor);
      });
    }

    this.isEditing = false;
    this.editingValue = '';
  }

  private calculateCursorPosition(
    formattedValue: string,
    oldCursor: number,
    oldValue: string
  ): number {
    // Cuántos dígitos había antes de la posición antigua
    const digitsBefore = (oldValue.substring(0, oldCursor).match(/\d/g) || []).length;

    // Reubicar en el string formateado
    let digitCount = 0;
    for (let i = 0; i < formattedValue.length; i++) {
      if (/\d/.test(formattedValue[i])) {
        digitCount++;
        if (digitCount === digitsBefore) {
          return i + 1; // posición justo después de ese dígito
        }
      }
    }
    return formattedValue.length; // fallback: al final
  }
} 