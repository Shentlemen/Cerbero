import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HwSwComprasComponent } from './hw-sw-compras.component';

describe('HwSwComprasComponent', () => {
  let component: HwSwComprasComponent;
  let fixture: ComponentFixture<HwSwComprasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HwSwComprasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HwSwComprasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
