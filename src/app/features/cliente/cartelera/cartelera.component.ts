import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Pelicula } from '../../../models/pelicula.interface';
import { RouterLink } from '@angular/router';
import { SlicePipe, CommonModule } from '@angular/common';

@Component({
  selector: 'app-cartelera',
  standalone: true,
  imports: [RouterLink, SlicePipe, CommonModule],
  templateUrl: './cartelera.component.html',
  styleUrl: './cartelera.component.css'
})
export class CarteleraComponent implements OnInit {
  private supabase = inject(SupabaseService);
  peliculas = signal<Pelicula[]>([]);

  topPeliculas = computed(() => {
    return [...this.peliculas()]
      .sort((a, b) => (b.ventas_totales || 0) - (a.ventas_totales || 0))
      .slice(0, 10);
  });

  async ngOnInit() {
    const data = await this.supabase.getTableData<Pelicula>('movies');
    this.peliculas.set(data.filter(p => p.activa !== false));
  }
}
