import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GpVerPeliculas } from './gp-ver-peliculas';

describe('GpVerPeliculas', () => {
  let component: GpVerPeliculas;
  let fixture: ComponentFixture<GpVerPeliculas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GpVerPeliculas],
    }).compileComponents();

    fixture = TestBed.createComponent(GpVerPeliculas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
