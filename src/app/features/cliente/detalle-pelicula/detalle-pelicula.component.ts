import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Pelicula } from '../../../models/pelicula.interface';

@Component({
  selector: 'app-detalle-pelicula',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './detalle-pelicula.component.html',
  styleUrl: './detalle-pelicula.component.css'
})
export class DetallePeliculaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private supabase = inject(SupabaseService);
  
  pelicula = signal<Pelicula | null>(null);
  funciones = signal<any[]>([]);
  reviews = signal<any[]>([]);
  promedioEstrellas = signal<number>(0);
  porcentajeEstrellas = signal<string>('0%');

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const data = await this.supabase.client
        .from('movies')
        .select('*')
        .eq('id', id)
        .single();
      
      if (data.data) {
        this.pelicula.set(data.data as Pelicula);
      }

      const dataFunciones = await this.supabase.client
        .from('showtimes')
        .select('*, rooms(nombre)')
        .eq('movie_id', id)
        .order('fecha_hora', { ascending: true });
        
        
      if (dataFunciones.data) {
        this.funciones.set(dataFunciones.data);
      }

      const dataReviews = await this.supabase.client
        .from('reviews')
        .select('*, profiles(nombre)')
        .eq('movie_id', id)
        .order('created_at', { ascending: false });
        
      if (dataReviews.data && dataReviews.data.length > 0) {
        this.reviews.set(dataReviews.data);
        const sum = dataReviews.data.reduce((acc, r) => acc + (r.calificacion || 0), 0);
        const avg = sum / dataReviews.data.length;
        this.promedioEstrellas.set(avg);
        // porcentaje de 0 a 100 basado en 5 estrellas (ej: 4 estrellas = 80%)
        this.porcentajeEstrellas.set(`${(avg / 5) * 100}%`);
      }
    }
  }
}
