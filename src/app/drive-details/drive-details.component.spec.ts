import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DriveDetailsComponent } from './drive-details.component';

describe('DriveDetailsComponent', () => {
  let component: DriveDetailsComponent;
  let fixture: ComponentFixture<DriveDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DriveDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DriveDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
