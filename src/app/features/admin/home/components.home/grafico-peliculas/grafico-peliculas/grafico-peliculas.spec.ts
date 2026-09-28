import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GraficoPeliculas } from './grafico-peliculas';

describe('GraficoPeliculas', () => {
  let component: GraficoPeliculas;
  let fixture: ComponentFixture<GraficoPeliculas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficoPeliculas],
    }).compileComponents();

    fixture = TestBed.createComponent(GraficoPeliculas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
