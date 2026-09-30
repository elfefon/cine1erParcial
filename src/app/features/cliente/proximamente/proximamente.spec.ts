import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Proximamente } from './proximamente';

describe('Proximamente', () => {
  let component: Proximamente;
  let fixture: ComponentFixture<Proximamente>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Proximamente],
    }).compileComponents();

    fixture = TestBed.createComponent(Proximamente);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
