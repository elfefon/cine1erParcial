import { Component, inject, signal, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Pelicula } from '../../../models/pelicula.interface';
import { RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';

@Component({
  selector: 'app-cartelera',
  standalone: true,
  imports: [RouterLink, SlicePipe],
  templateUrl: './cartelera.component.html',
  styleUrl: './cartelera.component.css'
})
export class CarteleraComponent implements OnInit {
  private supabase = inject(SupabaseService);
  peliculas = signal<Pelicula[]>([]);

  async ngOnInit() {
    const data = await this.supabase.getTableData<Pelicula>('movies');
    this.peliculas.set(data.filter(p => p.activa !== false));
  }
}
