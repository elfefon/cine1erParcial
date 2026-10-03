import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GpCrearFuncion } from './gp-crear-funcion';

describe('GpCrearFuncion', () => {
  let component: GpCrearFuncion;
  let fixture: ComponentFixture<GpCrearFuncion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GpCrearFuncion],
    }).compileComponents();

    fixture = TestBed.createComponent(GpCrearFuncion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
