import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GpMenu } from './gp-menu';

describe('GpMenu', () => {
  let component: GpMenu;
  let fixture: ComponentFixture<GpMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GpMenu],
    }).compileComponents();

    fixture = TestBed.createComponent(GpMenu);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
