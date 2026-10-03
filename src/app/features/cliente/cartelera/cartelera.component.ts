import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Pelicula } from '../../../models/pelicula.interface';
import { RouterLink } from '@angular/router';
import { SlicePipe, CommonModule } from '@angular/common';

@Component({
  selector: 'app-cartelera',
  standalone: true,
  imports: [RouterLink, SlicePipe, CommonModule],
  templateUrl: './cartelera.component.html',
  styleUrl: './cartelera.component.css'
})
export class CarteleraComponent implements OnInit {
  private supabase = inject(SupabaseService);
  peliculas = signal<Pelicula[]>([]);
  generosDisponibles = signal<string[]>([]);
  generosSeleccionados = signal<string[]>([]);

  peliculasFiltradas = computed(() => {
    const seleccionados = this.generosSeleccionados();
    if (seleccionados.length === 0) return this.peliculas();
    
    return this.peliculas().filter(p => {
      // Si la peli tiene un array de generos y alguno coincide
      if (!p.generos || p.generos.length === 0) return false;
      return seleccionados.some(g => p.generos!.includes(g));
    });
  });

  topPeliculas = computed(() => {
    return [...this.peliculas()]
      .sort((a, b) => (b.ventas_totales || 0) - (a.ventas_totales || 0))
      .slice(0, 3);
  });

  recomendadasPeliculas = computed(() => {
    return this.peliculas().filter(p => p.recomendada);
  });

  async ngOnInit() {
    const data = await this.supabase.getTableData<Pelicula>('movies');
    const hoy = new Date().toISOString().split('T')[0];
    
    // Solo películas de cartelera (fechas <= hoy o vacías)
    const enCartelera = data.filter(p => p.activa !== false && (!p.fecha_estreno || p.fecha_estreno <= hoy));
    this.peliculas.set(enCartelera);

    // Extraer generos unicos
    const unicos = new Set<string>();
    enCartelera.forEach(p => {
      if (p.generos) {
        p.generos.forEach(g => unicos.add(g));
      }
    });
    this.generosDisponibles.set(Array.from(unicos).sort());
  }

  toggleGenero(g: string) {
    const actuales = this.generosSeleccionados();
    if (actuales.includes(g)) {
      this.generosSeleccionados.set(actuales.filter(x => x !== g));
    } else {
      this.generosSeleccionados.set([...actuales, g]);
    }
  }
}
