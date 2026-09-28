import { Component } from '@angular/core';
import { GraficoPeliculas } from './components.home/grafico-peliculas/grafico-peliculas/grafico-peliculas';
import { GraficoCandyComponent } from './components.home/grafico-candy/grafico-candy.component';
import { GraficoFinanzasComponent } from './components.home/grafico-finanzas/grafico-finanzas.component';

@Component({
  imports: [GraficoPeliculas, GraficoCandyComponent, GraficoFinanzasComponent],
  selector: 'app-home',
  styleUrl: './home.component.css',
  templateUrl: './home.component.html',
})
export class HomeComponent {
}
