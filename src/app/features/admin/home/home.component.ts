import { Component, OnInit, inject, signal } from '@angular/core';
import { GraficoPeliculas } from './components.home/grafico-peliculas/grafico-peliculas/grafico-peliculas';
import { GraficoCandyComponent } from './components.home/grafico-candy/grafico-candy.component';
import { GraficoFinanzasComponent } from './components.home/grafico-finanzas/grafico-finanzas.component';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  imports: [GraficoPeliculas, GraficoCandyComponent, GraficoFinanzasComponent],
  selector: 'app-home',
  styleUrl: './home.component.css',
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private supabase = inject(SupabaseService);

  totalRecaudado = signal<number>(0);
  totalEntradas = signal<number>(0);
  peliculaMasVista = signal<string>('Cargando...');

  async ngOnInit() {
    await this.cargarMetricas();
  }

  async cargarMetricas() {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];

    // Total recaudado hoy
    const { data: ticketsHoy } = await this.supabase.client
      .from('tickets')
      .select('precio_total')
      .gte('fecha_compra', hoyStr);
    
    let sumaHoy = 0;
    if (ticketsHoy) {
      sumaHoy = ticketsHoy.reduce((acc, t) => acc + (t.precio_total || 0), 0);
    }
    this.totalRecaudado.set(sumaHoy);

    // Total entradas
    const { data: totalT } = await this.supabase.client.from('tickets').select('id', { count: 'exact' });
    this.totalEntradas.set(totalT?.length || 0);

    // Película más vista
    // Para simplificar, obtenemos todos los tickets y agrupamos por pelicula_nombre
    const { data: tickets } = await this.supabase.client.from('tickets').select('pelicula_nombre');
    if (tickets && tickets.length > 0) {
      const counts: Record<string, number> = {};
      tickets.forEach(t => {
        counts[t.pelicula_nombre] = (counts[t.pelicula_nombre] || 0) + 1;
      });
      const topPelicula = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
      this.peliculaMasVista.set(topPelicula);
    } else {
      this.peliculaMasVista.set('N/A');
    }
  }
}
