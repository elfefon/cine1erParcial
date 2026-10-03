import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../../core/services/supabase.service';
import { PeliculasStateService } from '../../services/peliculas-state.service';
import { BuscadorAutocompleteComponent } from '../../../../../shared/components/buscador-autocomplete/buscador-autocomplete.component';

@Component({
  selector: 'app-gp-proximamente',
  standalone: true,
  imports: [ReactiveFormsModule, BuscadorAutocompleteComponent],
  templateUrl: './gp-proximamente.html'
})
export class GpProximamenteComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  state = inject(PeliculasStateService);

  preventaForm = this.fb.nonNullable.group({
    pelicula_id: ['', Validators.required],
    imagen_apaisada_url: ['', Validators.required]
  });

  onPeliculaSeleccionada(id: string) {
    if (id) {
      const p = this.state.peliculas().find(x => x.id === id);
      this.preventaForm.patchValue({ pelicula_id: id, imagen_apaisada_url: p?.imagen_apaisada_url || '' });
    } else {
      this.preventaForm.patchValue({ pelicula_id: '', imagen_apaisada_url: '' });
    }
  }

  async onSubmit() {
    if (this.preventaForm.valid) {
      const { pelicula_id, imagen_apaisada_url } = this.preventaForm.getRawValue();
      const { error } = await this.supabase.client.from('movies').update({ imagen_apaisada_url: imagen_apaisada_url.trim() }).eq('id', pelicula_id);
      if (!error) {
        this.state.peliculas.update(l => l.map(p => p.id === pelicula_id ? { ...p, imagen_apaisada_url: imagen_apaisada_url.trim() } : p));
        alert('Imagen guardada.');
        this.preventaForm.reset();
      } else { alert(error.message); }
    }
  }
}
