import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GpVerFunciones } from './gp-ver-funciones';

describe('GpVerFunciones', () => {
  let component: GpVerFunciones;
  let fixture: ComponentFixture<GpVerFunciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GpVerFunciones],
    }).compileComponents();

    fixture = TestBed.createComponent(GpVerFunciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
