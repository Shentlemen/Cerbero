import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SwComprasComponent } from './sw-compras.component';

describe('SwComprasComponent', () => {
  let component: SwComprasComponent;
  let fixture: ComponentFixture<SwComprasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwComprasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SwComprasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
