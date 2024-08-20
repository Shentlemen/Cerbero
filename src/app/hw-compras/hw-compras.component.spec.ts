import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HwComprasComponent } from './hw-compras.component';

describe('HwComprasComponent', () => {
  let component: HwComprasComponent;
  let fixture: ComponentFixture<HwComprasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HwComprasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HwComprasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
