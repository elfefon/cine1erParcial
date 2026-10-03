import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GpCrearPelicula } from './gp-crear-pelicula';

describe('GpCrearPelicula', () => {
  let component: GpCrearPelicula;
  let fixture: ComponentFixture<GpCrearPelicula>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GpCrearPelicula],
    }).compileComponents();

    fixture = TestBed.createComponent(GpCrearPelicula);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
