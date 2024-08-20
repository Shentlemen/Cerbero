import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComprasPedidoComponent } from './compras-pedido.component';

describe('ComprasPedidoComponent', () => {
  let component: ComprasPedidoComponent;
  let fixture: ComponentFixture<ComprasPedidoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComprasPedidoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComprasPedidoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
