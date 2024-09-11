import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssetdetailsComponent } from './assetdetails.component';

describe('AssetdetailsComponent', () => {
  let component: AssetdetailsComponent;
  let fixture: ComponentFixture<AssetdetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetdetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssetdetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
