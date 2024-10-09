import { TestBed } from '@angular/core/testing';

import { BiosService } from './bios.service';

describe('BiosService', () => {
  let service: BiosService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BiosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
