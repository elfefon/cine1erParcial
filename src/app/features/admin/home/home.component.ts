import { Component, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  imports: [],
  selector: 'app-home',
  styleUrl: './home.component.css',
  templateUrl: './home.component.html',
})
export class HomeComponent {
  private supabase = inject(SupabaseService);
  datosGraficoPeliculas: any[] = [];

  async cargarGraficoPeliculas(filtro: 'semana' | 'mes' | 'año') {
    const fecha_fin = new Date();
    const fecha_inicio = new Date();

    switch (filtro) {
      case 'semana':
        fecha_inicio.setDate(fecha_fin.getDate() - 7);
        break;
      case 'mes':
        fecha_inicio.setDate(fecha_fin.getDate() - 30);
        break;
      case 'año':
        fecha_inicio.setDate(fecha_fin.getDate() - 365);
        break;
    }

    const { data, error } = await this.supabase.client.rpc('obtener_top_peliculas', {
      fecha_inicio: fecha_inicio.toISOString(),
      fecha_fin: fecha_fin.toISOString()
    });

    if (error) {
      console.error('Error obteniendo top películas:', error);
      return;
    }

    this.datosGraficoPeliculas = data;
  }
}
