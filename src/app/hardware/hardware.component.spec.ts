import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HardwareComponent } from './hardware.component';

describe('HardwareComponent', () => {
  let component: HardwareComponent;
  let fixture: ComponentFixture<HardwareComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HardwareComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HardwareComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
