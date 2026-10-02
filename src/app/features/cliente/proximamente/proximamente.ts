import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Pelicula } from '../../../models/pelicula.interface';

@Component({
  selector: 'app-proximamente',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './proximamente.html',
  styleUrl: './proximamente.css'
})
export class ProximamenteComponent implements OnInit {
  private supabase = inject(SupabaseService);
  peliculasProximamente = signal<Pelicula[]>([]);
  peliculasPreventa = signal<Pelicula[]>([]);

  async ngOnInit() {
    const data = await this.supabase.getTableData<Pelicula>('movies');
    const hoy = new Date().toISOString().split('T')[0];
    
    // Solo películas con fecha de estreno en el futuro
    const peliculasFuturas = data.filter(p => p.fecha_estreno && p.fecha_estreno > hoy);

    // Buscar showtimes para saber cuáles tienen funciones programadas
    const { data: showtimes } = await this.supabase.client.from('showtimes').select('movie_id');
    const moviesConFunciones = new Set((showtimes || []).map(s => s.movie_id));

    const preventa = peliculasFuturas.filter(p => moviesConFunciones.has(p.id));
    const proximamente = peliculasFuturas.filter(p => !moviesConFunciones.has(p.id));

    this.peliculasPreventa.set(preventa);
    this.peliculasProximamente.set(proximamente);
  }
}
