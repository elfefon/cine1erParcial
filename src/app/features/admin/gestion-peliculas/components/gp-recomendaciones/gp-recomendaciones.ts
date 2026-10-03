import { Component, inject, signal } from '@angular/core';
import { SupabaseService } from '../../../../../core/services/supabase.service';
import { PeliculasStateService } from '../../services/peliculas-state.service';
import { BuscadorAutocompleteComponent } from '../../../../../shared/components/buscador-autocomplete/buscador-autocomplete.component';
import { Pelicula } from '../../../../../models/pelicula.interface';

@Component({
  selector: 'app-gp-recomendaciones',
  standalone: true,
  imports: [BuscadorAutocompleteComponent],
  templateUrl: './gp-recomendaciones.html'
})
export class GpRecomendacionesComponent {
  state = inject(PeliculasStateService);
  private supabase = inject(SupabaseService);
  recomendacionSeleccionada = signal<string>('');

  async agregarRecomendadaLocal() {
    const id = this.recomendacionSeleccionada();
    if (!id) { alert('Selecciona una película.'); return; }
    const p = this.state.peliculas().find(x => x.id === id);
    if (p) {
      if (this.state.recomendadasBorrador().length >= 10) { alert('Máximo 10 recomendadas.'); return; }
      const { error } = await this.supabase.client.from('movies').update({ recomendada: true }).eq('id', p.id);
      if (!error) {
        this.state.recomendadasBorrador.update(l => [...l, { ...p, recomendada: true }]);
        this.state.peliculas.update(l => l.map(x => x.id === p.id ? { ...x, recomendada: true } : x));
        this.recomendacionSeleccionada.set('');
      } else { alert(error.message); }
    }
  }

  async quitarDeRecomendadas(p: Pelicula) {
    const { error } = await this.supabase.client.from('movies').update({ recomendada: false }).eq('id', p.id);
    if (!error) {
      this.state.recomendadasBorrador.update(l => l.filter(x => x.id !== p.id));
      this.state.peliculas.update(l => l.map(x => x.id === p.id ? { ...x, recomendada: false } : x));
    } else { alert(error.message); }
  }
}
