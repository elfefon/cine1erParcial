import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-perfil-usuario',
  standalone: true,
  templateUrl: './perfil-usuario.component.html',
  styleUrl: './perfil-usuario.component.css'
})
export class PerfilUsuarioComponent implements OnInit {
  authService = inject(AuthService);
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  async ngOnInit() {
    const user = this.authService.usuarioActual();
    if (user) {
      // Recargar puntos
      const { data } = await this.supabase.client.from('profiles').select('puntos').eq('id', user.id).single();
      if (data) {
        this.authService.usuarioActual.update(u => u ? { ...u, puntos: data.puntos || 0 } : null);
      }
    }
  }

  async logout() {
    await this.authService.signOut();
    this.router.navigate(['/']);
  }
}
