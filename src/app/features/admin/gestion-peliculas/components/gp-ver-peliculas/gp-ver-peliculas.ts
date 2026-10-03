import { Component, inject, signal, computed } from '@angular/core';
import { PeliculasStateService } from '../../services/peliculas-state.service';

@Component({
  selector: 'app-gp-ver-peliculas',
  standalone: true,
  templateUrl: './gp-ver-peliculas.html'
})
export class GpVerPeliculasComponent {
  state = inject(PeliculasStateService);
  filtroPeliculaTabla = signal('');
  
  peliculasTablaFiltradas = computed(() => {
    const s = this.filtroPeliculaTabla().toLowerCase();
    if (!s) return this.state.peliculas();
    return this.state.peliculas().filter(p => p.nombre.toLowerCase().includes(s));
  });

  onBuscar(e: Event) {
    this.filtroPeliculaTabla.set((e.target as HTMLInputElement).value);
  }
}
