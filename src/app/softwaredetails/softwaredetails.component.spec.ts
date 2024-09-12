import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SoftwaredetailsComponent } from './softwaredetails.component';

describe('SoftwaredetailsComponent', () => {
  let component: SoftwaredetailsComponent;
  let fixture: ComponentFixture<SoftwaredetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SoftwaredetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SoftwaredetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
