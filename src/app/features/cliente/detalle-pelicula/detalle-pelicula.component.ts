import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Pelicula } from '../../../models/pelicula.interface';

@Component({
  selector: 'app-detalle-pelicula',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './detalle-pelicula.component.html',
  styleUrl: './detalle-pelicula.component.css'
})
export class DetallePeliculaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private supabase = inject(SupabaseService);
  
  pelicula = signal<Pelicula | null>(null);

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
    }
  }
}
