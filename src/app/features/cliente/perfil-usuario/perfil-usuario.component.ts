import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-perfil-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './perfil-usuario.component.html',
  styleUrl: './perfil-usuario.component.css'
})
export class PerfilUsuarioComponent implements OnInit {
  authService = inject(AuthService);
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  peliculasVistas = signal<any[]>([]);
  historialPuntos = signal<any[]>([]);

  // Estado para la reseña
  peliculaACalificar = signal<any>(null);
  calificacionValue = signal<number>(5);
  comentarioValue = signal<string>('');
  enviandoResena = signal(false);

  async ngOnInit() {
    const user = this.authService.usuarioActual();
    if (user) {
      // Recargar puntos
      const { data } = await this.supabase.client.from('profiles').select('puntos, credito_saldo').eq('id', user.id).single();
      if (data) {
        this.authService.usuarioActual.update(u => u ? { ...u, puntos: data.puntos || 0, credito_saldo: data.credito_saldo || 0 } : null);
      }
      await this.cargarHistorial();
    }
  }

  async cargarHistorial() {
    const user = this.authService.usuarioActual();
    if (!user) return;
    
    // Obtener tickets con películas
    const { data } = await this.supabase.client
      .from('tickets')
      .select(`
        *,
        seat_reservations(
          *,
          showtimes(
            *,
            movies(*)
          )
        )
      `)
      .eq('user_id', user.id)
      .order('fecha_compra', { ascending: false });
      
    if (data) {
      const peliculasMap = new Map();
      
      for (const t of data) {
        if (t.seat_reservations && t.seat_reservations.length > 0) {
          const movie = t.seat_reservations[0].showtimes?.movies;
          if (movie && !peliculasMap.has(movie.id)) {
            peliculasMap.set(movie.id, {
              ...movie,
              ticket_fecha: t.fecha_compra
            });
          }
        }
      }
      
      this.peliculasVistas.set(Array.from(peliculasMap.values()));
    }

    const { data: puntosData } = await this.supabase.client
      .from('puntos_movimientos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (puntosData) {
      this.historialPuntos.set(puntosData);
    }
  }

  abrirCalificacion(peli: any) {
    this.peliculaACalificar.set(peli);
    this.calificacionValue.set(5);
    this.comentarioValue.set('');
  }

  cerrarCalificacion() {
    this.peliculaACalificar.set(null);
  }

  async enviarCalificacion() {
    const peli = this.peliculaACalificar();
    const user = this.authService.usuarioActual();
    if (!peli || !user) return;

    this.enviandoResena.set(true);
    try {
      const payload = {
        movie_id: peli.id,
        user_id: user.id,
        calificacion: this.calificacionValue(),
        comentario: this.comentarioValue()
      };

      const { error } = await this.supabase.client.from('reviews').upsert(payload, { onConflict: 'movie_id, user_id' });
      
      if (error) {
        console.error(error);
        alert('Error al enviar la reseña.');
      } else {
        alert('¡Reseña enviada con éxito!');
        this.cerrarCalificacion();
      }
    } catch (e) {
      console.error(e);
      alert('Ocurrió un error inesperado.');
    } finally {
      this.enviandoResena.set(false);
    }
  }

  async logout() {
    await this.authService.signOut();
    this.router.navigate(['/']);
  }
}
