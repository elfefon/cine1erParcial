import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-layout-cliente',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './layout-cliente.component.html',
  styleUrl: './layout-cliente.component.css'
})
export class LayoutClienteComponent {
  authService = inject(AuthService);
  cart = inject(CartService);
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  isMobileMenuOpen = signal(false);
  isNotifMenuOpen = signal(false);
  notificaciones = signal<any[]>([]);

  constructor() {
    effect(() => {
      const user = this.authService.usuarioActual();
      if (user) {
        // Para usar await dentro del effect hay que meterlo en un bloque async, o no bloquear.
        this.cargarNotificaciones();
      } else {
        this.notificaciones.set([]);
      }
    });
  }

  async cargarNotificaciones() {
    const user = this.authService.usuarioActual();
    if (!user) return;
    
    // Fetch movie subscriptions for notifications
    const { data } = await this.supabase.client.from('movie_subscriptions')
      .select('*, movies(nombre)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    if (data) {
      this.notificaciones.set(data.map(sub => ({
        id: sub.id,
        mensaje: `Te suscribiste a las preventas de "${sub.movies?.nombre}".`,
        fecha: sub.created_at
      })));
    }
  }

  toggleNotifMenu() {
    this.isNotifMenuOpen.update(v => !v);
  }

  async eliminarNotificacion(id: string) {
    const { error } = await this.supabase.client.from('movie_subscriptions').delete().eq('id', id);
    if (!error) {
      this.notificaciones.update(list => list.filter(n => n.id !== id));
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
