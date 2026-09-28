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
    }
  }
}
