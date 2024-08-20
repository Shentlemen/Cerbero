import { TestBed } from '@angular/core/testing';

import { SwComprasService } from './sw-compras.service';

describe('SwComprasService', () => {
  let service: SwComprasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SwComprasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
