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

  constructor(private el: ElementRef<HTMLInputElement>) {}

  writeValue(value: number | null): void {
    if (value == null || isNaN(value as any)) {
      this.el.nativeElement.value = '';
    } else {
      this.el.nativeElement.value = this.formatter.format(value);
    }
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.el.nativeElement.disabled = isDisabled; }

  // Al escribir: tomar solo dígitos, convertir cents -> número, propagar al form y formatear la vista
  @HostListener('input')
  onInput() {
    const input = this.el.nativeElement;
    const digits = input.value.replace(/\D/g, ''); // sólo dígitos
    const cents = digits ? parseInt(digits, 10) : 0;
    const numericValue = cents / 100; // valor real (12.34)
    this.onChange(numericValue);
    input.value = this.formatter.format(numericValue);
  }

  // Opcional: al focusear mostramos los dígitos sin formato para facilitar edición
  @HostListener('focus')
  onFocus() {
    const input = this.el.nativeElement;
    const digits = input.value.replace(/\D/g, '');
    input.value = digits ? digits : '';
  }

  @HostListener('blur')
  onBlur() {
    this.onTouched();
    // re-formatear al salir
    const input = this.el.nativeElement;
    const digits = input.value.replace(/\D/g, '');
    const cents = digits ? parseInt(digits, 10) : 0;
    input.value = this.formatter.format(cents / 100);
  }
} 