import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PeliculasStateService } from '../../services/peliculas-state.service';
import { SupabaseService } from '../../../../../core/services/supabase.service';

@Component({
  selector: 'app-gp-ver-peliculas',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './gp-ver-peliculas.html'
})
export class GpVerPeliculasComponent {
  state = inject(PeliculasStateService);
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);

  filtroPeliculaTabla = signal('');
  
  // Modal states
  peliculaEditando = signal<any | null>(null);
  
  peliculaEditForm = this.fb.nonNullable.group({
    id: [''],
    nombre: ['', Validators.required],
    sinopsis: ['', Validators.required],
    duracion_min: [0, [Validators.required, Validators.min(1)]]
  });

  peliculasTablaFiltradas = computed(() => {
    const s = this.filtroPeliculaTabla().toLowerCase();
    if (!s) return this.state.peliculas();
    return this.state.peliculas().filter(p => p.nombre.toLowerCase().includes(s));
  });

  /** 
   * Filtra la lista de películas por nombre.
   */
  onBuscar(e: Event) {
    this.filtroPeliculaTabla.set((e.target as HTMLInputElement).value);
  }

  /**
   * Abre el modal de edición precargando los datos de la película seleccionada.
   */
  abrirModificar(p: any) {
    this.peliculaEditando.set(p);
    this.peliculaEditForm.patchValue({
      id: p.id,
      nombre: p.nombre,
      sinopsis: p.sinopsis,
      duracion_min: p.duracion_min
    });
  }

  /**
   * Cierra el modal de edición.
   */
  cerrarModificar() {
    this.peliculaEditando.set(null);
  }

  /**
   * Guarda los cambios de la película en la base de datos y recarga el estado.
   */
  async guardarModificacion() {
    if (this.peliculaEditForm.valid) {
      const data = this.peliculaEditForm.getRawValue();
      const { error } = await this.supabase.client.from('movies').update({
        nombre: data.nombre,
        sinopsis: data.sinopsis,
        duracion_min: data.duracion_min
      }).eq('id', data.id);
      
      if (error) {
        alert('Error al modificar la película: ' + error.message);
      } else {
        this.cerrarModificar();
        await this.state.cargarPeliculas();
        await this.state.registrarAccion('UPDATE_MOVIE');
      }
    }
  }

  /**
   * Elimina una película permanentemente de la base de datos.
   */
  async eliminar(id: string) {
    if (confirm("¿Estás seguro de que deseas eliminar esta película permanentemente? Se eliminarán también las funciones asociadas.")) {
      const { error } = await this.supabase.client.from('movies').delete().eq('id', id);
      if (error) {
        alert("Error al eliminar la película: " + error.message);
      } else {
        await this.state.cargarPeliculas();
        await this.state.registrarAccion('DELETE_MOVIE');
      }
    }
  }
}
