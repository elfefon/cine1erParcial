import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../../core/services/supabase.service';
import { PeliculasStateService } from '../../services/peliculas-state.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-gp-crear-pelicula',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './gp-crear-pelicula.html'
})
export class GpCrearPeliculaComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private state = inject(PeliculasStateService);
  private router = inject(Router);

  tmdbNombreInput = signal<string>('');

  peliculaForm = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    sinopsis: ['', Validators.required],
    imagen_url: ['', Validators.required],
    duracion_min: [0, [Validators.required, Validators.min(1)]],
    restriccion_edad: [0, [Validators.required, Validators.min(0)]],
    generos: ['', Validators.required],
    fecha_estreno: [''],
    activa: [true]
  });

  async importarDesdeTMDB() {
    const nombre = this.tmdbNombreInput().trim();
    if (!nombre) { alert('Ingresa el nombre de una película'); return; }
    try {
      const peliculaGuardada = await this.supabase.buscarEImportarPeliculaPorNombre(nombre);
      if (peliculaGuardada) {
        this.state.peliculas.update(lista => {
          const existe = lista.find(x => x.id === peliculaGuardada.id);
          return existe ? lista.map(x => x.id === peliculaGuardada.id ? peliculaGuardada : x) : [...lista, peliculaGuardada];
        });
        this.tmdbNombreInput.set('');
        alert(`Película "${peliculaGuardada.nombre}" importada exitosamente.`);
      }
    } catch (e: any) { alert(e.message || 'Error importando.'); }
  }

  async onSubmit() {
    if (this.peliculaForm.valid) {
      const rawValues = this.peliculaForm.getRawValue();
      const generosArray = rawValues.generos.split(',').map(g => g.trim()).filter(g => g !== '');
      const pelicula = {
        nombre: rawValues.nombre, sinopsis: rawValues.sinopsis, imagen_url: rawValues.imagen_url,
        duracion_min: rawValues.duracion_min, restriccion_edad: rawValues.restriccion_edad,
        generos: generosArray, fecha_estreno: rawValues.fecha_estreno || null, activa: rawValues.activa
      };
      await this.supabase.insertData('movies', pelicula);
      await this.state.cargarPeliculas();
      await this.state.registrarAccion('CREATE_MOVIE');
      this.router.navigate(['/admin/peliculas/menu']);
    }
  }
}
