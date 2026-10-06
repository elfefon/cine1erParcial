import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast';

@Component({
  selector: 'app-canjes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canjes.html',
  styleUrl: './canjes.css'
})
export class CanjesComponent implements OnInit {
  private supabase = inject(SupabaseService);
  authService = inject(AuthService);
  private toast = inject(ToastService);

  catalogo = signal<any[]>([]);
  loading = signal(true);
  procesando = signal(false);

  async ngOnInit() {
    await this.cargarCatalogo();
  }

  async cargarCatalogo() {
    this.loading.set(true);
    const { data, error } = await this.supabase.client
      .from('catalogo_canjes')
      .select('*')
      .eq('activo', true)
      .order('costo_puntos');
    
    if (data) {
      this.catalogo.set(data);
    }
    this.loading.set(false);
  }

  async realizarCanje(canje: any) {
    const user = this.authService.usuarioActual();
    if (!user) {
      this.toast.error('Debes iniciar sesión para realizar canjes.');
      return;
    }

    if ((user.puntos || 0) < canje.costo_puntos) {
      this.toast.error('Puntos insuficientes.');
      return;
    }

    if (!confirm(`¿Querés canjear ${canje.costo_puntos} puntos por "${canje.nombre}"?`)) {
      return;
    }

    this.procesando.set(true);
    try {
      const { data, error } = await this.supabase.client.rpc('realizar_canje', {
        p_user_id: user.id,
        p_canje_id: canje.id
      });

      if (error) {
        throw error;
      }

      this.toast.success('¡Canje realizado con éxito!');
      
      // Actualizar puntos locales
      const { data: profile } = await this.supabase.client.from('profiles').select('*').eq('id', user.id).single();
      if (profile) {
        this.authService.usuarioActual.set(profile as any);
      }
    } catch (e: any) {
      console.error(e);
      this.toast.error(e.message || 'Error al realizar el canje.');
    } finally {
      this.procesando.set(false);
    }
  }
}
