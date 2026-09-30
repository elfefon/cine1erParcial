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

  async ngOnInit() {
    const data = await this.supabase.getTableData<Pelicula>('movies');
    const hoy = new Date().toISOString().split('T')[0];
    
    // Solo películas con fecha de estreno en el futuro
    const peliculasFiltradas = data.filter(p => p.fecha_estreno && p.fecha_estreno > hoy);
    this.peliculasProximamente.set(peliculasFiltradas);
  }
}
