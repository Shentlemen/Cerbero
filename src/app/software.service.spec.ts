import { TestBed } from '@angular/core/testing';

import { SoftwareService } from './software.service';

describe('SoftwareService', () => {
  let service: SoftwareService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SoftwareService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
