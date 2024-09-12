import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SoftwareEditModalComponent } from './software-edit-modal.component';

describe('SoftwareEditModalComponent', () => {
  let component: SoftwareEditModalComponent;
  let fixture: ComponentFixture<SoftwareEditModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SoftwareEditModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SoftwareEditModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
