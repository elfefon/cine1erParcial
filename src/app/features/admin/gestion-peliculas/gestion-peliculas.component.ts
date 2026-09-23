import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Pelicula } from '../../../models/pelicula.interface';

@Component({
  selector: 'app-gestion-peliculas',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './gestion-peliculas.component.html',
  styleUrl: './gestion-peliculas.component.css'
})
export class GestionPeliculasComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);

  peliculas = signal<Pelicula[]>([]);
  
  peliculaForm = this.fb.nonNullable.group({
    titulo: ['', Validators.required],
    sinopsis: ['', Validators.required],
    poster_url: ['', Validators.required],
    activa: [true]
  });

  async ngOnInit() {
    await this.cargarPeliculas();
  }

  async cargarPeliculas() {
    const data = await this.supabase.getTableData<Pelicula>('peliculas');
    this.peliculas.set(data);
  }

  async onSubmit() {
    if (this.peliculaForm.valid) {
      const pelicula = this.peliculaForm.getRawValue();
      await this.supabase.insertData('peliculas', pelicula);
      this.peliculaForm.reset({ activa: true });
      await this.cargarPeliculas();
      await this.registrarAccion('CREATE_MOVIE');
    }
  }

  private async registrarAccion(tipo: string) {
    const user = await this.supabase.auth.getUser();
    if (user.data.user) {
      await this.supabase.insertData('historial_acciones', {
        tipo,
        administrador: user.data.user.email,
        fecha: new Date().toISOString()
      });
    }
  }
}
