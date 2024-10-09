import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonitorDetailsComponent } from './monitor-details.component';

describe('MonitorDetailsComponent', () => {
  let component: MonitorDetailsComponent;
  let fixture: ComponentFixture<MonitorDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonitorDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonitorDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
