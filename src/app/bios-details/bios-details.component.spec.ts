import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BiosDetailsComponent } from './bios-details.component';

describe('BiosDetailsComponent', () => {
  let component: BiosDetailsComponent;
  let fixture: ComponentFixture<BiosDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BiosDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BiosDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
