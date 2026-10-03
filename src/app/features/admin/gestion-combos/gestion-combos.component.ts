import { Component, inject, ViewEncapsulation } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-gestion-combos',
  standalone: true,
  imports: [RouterOutlet, CommonModule, RouterLink],
  templateUrl: './gestion-combos.component.html',
  styleUrl: './gestion-combos.component.css',
  encapsulation: ViewEncapsulation.None
})
export class GestionCombosComponent {
  private router = inject(Router);
  
  isNotMenu = false;

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.isNotMenu = !event.urlAfterRedirects.endsWith('/menu');
    });
  }
}
