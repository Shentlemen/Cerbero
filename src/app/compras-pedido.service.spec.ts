import { TestBed } from '@angular/core/testing';

import { ComprasPedidoService } from './compras-pedido.service';

describe('ComprasPedidoService', () => {
  let service: ComprasPedidoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ComprasPedidoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
