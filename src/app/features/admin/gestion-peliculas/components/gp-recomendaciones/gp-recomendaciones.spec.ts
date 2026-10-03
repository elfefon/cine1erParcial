import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GpRecomendaciones } from './gp-recomendaciones';

describe('GpRecomendaciones', () => {
  let component: GpRecomendaciones;
  let fixture: ComponentFixture<GpRecomendaciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GpRecomendaciones],
    }).compileComponents();

    fixture = TestBed.createComponent(GpRecomendaciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
