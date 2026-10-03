import { Component, inject, ViewEncapsulation } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-gestion-peliculas',
  standalone: true,
  imports: [RouterOutlet, CommonModule, RouterLink],
  templateUrl: './gestion-peliculas.component.html',
  styleUrl: './gestion-peliculas.component.css',
  encapsulation: ViewEncapsulation.None
})
export class GestionPeliculasComponent {
  private router = inject(Router);
  
  isNotMenu = false;

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // Check if URL ends with /menu
      this.isNotMenu = !event.urlAfterRedirects.endsWith('/menu');
    });
  }
}
