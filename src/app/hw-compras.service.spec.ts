import { TestBed } from '@angular/core/testing';

import { HwComprasService } from './hw-compras.service';

describe('HwComprasService', () => {
  let service: HwComprasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HwComprasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
