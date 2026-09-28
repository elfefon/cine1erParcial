import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModificarFuncion } from './modificar-funcion';

describe('ModificarFuncion', () => {
  let component: ModificarFuncion;
  let fixture: ComponentFixture<ModificarFuncion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModificarFuncion],
    }).compileComponents();

    fixture = TestBed.createComponent(ModificarFuncion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
