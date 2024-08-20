import { TestBed } from '@angular/core/testing';

import { HwService } from './hw.service';

describe('HwService', () => {
  let service: HwService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HwService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
