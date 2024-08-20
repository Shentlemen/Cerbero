import { TestBed } from '@angular/core/testing';

import { HwSwComprasService } from './hw-sw-compras.service';

describe('HwSwComprasService', () => {
  let service: HwSwComprasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HwSwComprasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
