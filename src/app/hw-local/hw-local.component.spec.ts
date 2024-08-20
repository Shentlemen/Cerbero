import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HwLocalComponent } from './hw-local.component';

describe('HwLocalComponent', () => {
  let component: HwLocalComponent;
  let fixture: ComponentFixture<HwLocalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HwLocalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HwLocalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
