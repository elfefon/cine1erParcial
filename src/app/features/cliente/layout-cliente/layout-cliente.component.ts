import { Component, inject, signal, effect, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { WaitlistService } from '../../../core/services/waitlist.service';

@Component({
  selector: 'app-layout-cliente',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './layout-cliente.component.html',
  styleUrl: './layout-cliente.component.css'
})
export class LayoutClienteComponent implements OnDestroy {
  authService = inject(AuthService);
  cart = inject(CartService);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private waitlistService = inject(WaitlistService);

  isMobileMenuOpen = signal(false);
  isNotifMenuOpen = signal(false);
  notificaciones = signal<any[]>([]);

  private notifChannel: any;

  constructor() {
    effect(() => {
      const user = this.authService.usuarioActual();
      if (user) {
        this.cargarNotificaciones();
        this.suscribirRealtimeNotificaciones(user.id);
      } else {
        this.notificaciones.set([]);
        this.limpiarRealtime();
      }
    });
  }

  private suscribirRealtimeNotificaciones(userId: string) {
    this.limpiarRealtime();
    try {
      this.notifChannel = this.supabase.client
        .channel(`user_notifs_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_notifications',
            filter: `user_id=eq.${userId}`
          },
          payload => {
            const nueva = payload.new as any;
            if (nueva?.mensaje) {
              this.waitlistService.dispararPushNotification(
                nueva.tipo === 'WAITLIST_TURNO'
                  ? '🎟️ ¡Se liberó un lugar en tu Lista de Espera!'
                  : '🔔 Notificación de CineUTN',
                nueva.mensaje
              );
            }
            this.cargarNotificaciones();
          }
        )
        .subscribe();
    } catch {
      // Ignorar si realtime no está activo
    }
  }

  private limpiarRealtime() {
    if (this.notifChannel) {
      this.supabase.client.removeChannel(this.notifChannel);
      this.notifChannel = null;
    }
  }

  ngOnDestroy() {
    this.limpiarRealtime();
  }

  async cargarNotificaciones() {
    const user = this.authService.usuarioActual();
    if (!user) return;
    
    const listaCombinada: any[] = [];

    // 1. Notificaciones de user_notifications (Waitlist 15 min, Cancelación de función, Propuestas)
    try {
      const { data: userNotifs } = await this.supabase.client
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (userNotifs) {
        for (const n of userNotifs) {
          listaCombinada.push({
            id: n.id,
            origen: 'user_notifications',
            tipo: n.tipo,
            mensaje: n.mensaje,
            metadata: n.metadata,
            fecha: n.created_at
          });
        }
      }
    } catch {
      // Fallback local
    }

    // 2. Notificaciones locales (fallback cuando no hay tabla o offline)
    const locales = this.waitlistService.leerNotificacionesLocales(user.id);
    for (const loc of locales) {
      if (!listaCombinada.some(x => x.id === loc.id)) {
        listaCombinada.push({
          id: loc.id,
          origen: 'local',
          tipo: loc.tipo,
          mensaje: loc.mensaje,
          metadata: loc.metadata,
          fecha: loc.fecha
        });
      }
    }

    // 3. Suscripciones a preventas (movie_subscriptions)
    try {
      const { data } = await this.supabase.client
        .from('movie_subscriptions')
        .select('*, movies(nombre)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (data) {
        for (const sub of data) {
          listaCombinada.push({
            id: sub.id,
            origen: 'movie_subscriptions',
            tipo: 'PREVENTA',
            mensaje: `Te suscribiste a las preventas de "${sub.movies?.nombre}".`,
            fecha: sub.created_at
          });
        }
      }
    } catch {
      // Ignorar
    }

    listaCombinada.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    this.notificaciones.set(listaCombinada);
  }

  toggleNotifMenu() {
    const next = !this.isNotifMenuOpen();
    this.isNotifMenuOpen.set(next);
    if (next) {
      this.cargarNotificaciones();
    }
  }

  async eliminarNotificacion(notif: any) {
    if (notif.origen === 'movie_subscriptions') {
      await this.supabase.client.from('movie_subscriptions').delete().eq('id', notif.id);
    } else if (notif.origen === 'user_notifications') {
      await this.supabase.client.from('user_notifications').delete().eq('id', notif.id);
    }
    this.waitlistService.eliminarNotificacionLocal(notif.id);
    this.notificaciones.update(list => list.filter(n => n.id !== notif.id));
  }

  irAReubicacion(notif: any) {
    this.closeNotifMenu();
    const movieId = notif?.metadata?.movie_id;
    if (movieId) {
      this.router.navigate(['/pelicula', movieId], { queryParams: { reubicar: 'true' } });
    } else {
      this.router.navigate(['/cartelera']);
    }
  }

  irACompraWaitlist(notif: any) {
    this.closeNotifMenu();
    const movieId = notif?.metadata?.movie_id;
    const showtimeId = notif?.metadata?.showtime_id;
    if (movieId && showtimeId) {
      this.router.navigate(['/reserva', movieId], { queryParams: { showtime: showtimeId } });
    } else {
      this.router.navigate(['/perfil']);
    }
  }

  closeNotifMenu() {
    this.isNotifMenuOpen.set(false);
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen.update(val => !val);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
    this.isNotifMenuOpen.set(false);
  }

  async logout() {
    await this.authService.signOut();
    this.router.navigate(['/']);
  }
}
