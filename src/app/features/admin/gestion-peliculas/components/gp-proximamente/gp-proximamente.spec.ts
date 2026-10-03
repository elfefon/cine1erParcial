import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GpProximamente } from './gp-proximamente';

describe('GpProximamente', () => {
  let component: GpProximamente;
  let fixture: ComponentFixture<GpProximamente>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GpProximamente],
    }).compileComponents();

    fixture = TestBed.createComponent(GpProximamente);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
