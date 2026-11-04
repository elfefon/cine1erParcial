import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { WaitlistService } from '../../../core/services/waitlist.service';
import { RolesService } from '../../../core/services/roles.service';
import { ToastService } from '../../../core/services/toast.service';
import { WaitlistEntry } from '../../../models/waitlist.interface';

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
  rolesService = inject(RolesService);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private waitlistService = inject(WaitlistService);
  private toastService = inject(ToastService);

  peliculasVistas = signal<any[]>([]);
  historialPuntos = signal<any[]>([]);
  misListasEspera = signal<WaitlistEntry[]>([]);
  cargandoWaitlist = signal(false);

  // Estado para la reseña
  peliculaACalificar = signal<any>(null);
  calificacionValue = signal<number>(5);
  comentarioValue = signal<string>('');
  enviandoResena = signal(false);

  async ngOnInit() {
    await this.rolesService.cargarRolesDesdeDB();
    const user = this.authService.usuarioActual();
    if (user) {
      const { data } = await this.supabase.client.from('profiles').select('puntos, credito_saldo, role').eq('id', user.id).single();
      if (data) {
        this.authService.usuarioActual.update(u => u ? {
          ...u,
          puntos: data.puntos || 0,
          credito_saldo: data.credito_saldo || 0,
          role: data.role || u.role
        } : null);
      }
      await Promise.all([
        this.cargarHistorial(),
        this.cargarMisListasEspera()
      ]);
    }
  }

  async cargarMisListasEspera() {
    const user = this.authService.usuarioActual();
    if (!user) return;
    this.cargandoWaitlist.set(true);
    try {
      const listas = await this.waitlistService.obtenerListasDeUsuarioConPosicion(user.id);
      this.misListasEspera.set(listas);
    } finally {
      this.cargandoWaitlist.set(false);
    }
  }

  async salirDeLista(entry: WaitlistEntry) {
    if (!confirm('¿Querés salir de esta lista de espera?')) return;
    const res = await this.waitlistService.salirDeListaEspera(entry.id, entry.showtime_id);
    if (res.ok) {
      this.toastService.info(res.mensaje);
      await this.cargarMisListasEspera();
    } else {
      this.toastService.error(res.mensaje);
    }
  }

  tieneAccesoAdmin(): boolean {
    const rol = this.authService.usuarioActual()?.role;
    return this.rolesService.tieneAccesoAlPanelAdmin(rol);
  }

  obtenerRutaInicialAdmin(): string[] {
    const rol = this.authService.usuarioActual()?.role;
    const ruta = this.rolesService.obtenerPrimeraRutaPermitida(rol);
    return ['/admin', ruta];
  }

  async cargarHistorial() {
    const user = this.authService.usuarioActual();
    if (!user) return;
    
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
      const { data: existingReview } = await this.supabase.client
        .from('reviews')
        .select('id')
        .eq('movie_id', peli.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingReview) {
        alert('Ya enviaste una reseña para esta película y no puede ser modificada.');
        this.cerrarCalificacion();
        return;
      }

      const payload = {
        movie_id: peli.id,
        user_id: user.id,
        calificacion: this.calificacionValue(),
        comentario: this.comentarioValue()
      };

      const { error } = await this.supabase.client.from('reviews').insert(payload);
      
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
