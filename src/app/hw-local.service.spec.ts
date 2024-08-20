import { TestBed } from '@angular/core/testing';

import { HwLocalService } from './hw-local.service';

describe('HwLocalService', () => {
  let service: HwLocalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HwLocalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
