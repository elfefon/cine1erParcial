import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Usuario } from '../../models/usuario.interface';
import { User, Session } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabaseService = inject(SupabaseService);
  public usuarioActual = signal<Usuario | null>(null);

  constructor() {
    this.initSession();
  }

  private async initSession() {
    const { data: { session } } = await this.supabaseService.auth.getSession();
    if (session) {
      await this.loadUserProfile(session.user);
    }

    this.supabaseService.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await this.loadUserProfile(session.user);
      } else {
        this.usuarioActual.set(null);
      }
    });
  }

  private async loadUserProfile(user: User) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        const usuario: Usuario = {
          ...data,
          rol: data.rol || data.role || 'cliente',
          email: user.email || ''
        };
        this.usuarioActual.set(usuario);
      }
    } catch (e) {
      console.error('Error loading user profile', e);
    }
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabaseService.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signUp(
    email: string,
    password: string,
    nombre: string,
    fecha_nacimiento?: string,
    tipo_sangre?: string,
    color_ojos?: string,
    vacaciones_anuales?: string | number
  ) {
    const { data, error } = await this.supabaseService.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          role: 'cliente',
          fecha_nacimiento: fecha_nacimiento,
          tipo_sangre: tipo_sangre,
          color_ojos: color_ojos,
          vacaciones_anuales: vacaciones_anuales
        }
      }
    });

    if (error) throw error;

    // Si el usuario se creó correctamente en auth, guardamos sus datos en la tabla 'usuarios' (pública)
    if (data.user) {
      const { error: insertError } = await this.supabaseService.client
        .from('profiles')
        .insert({
          id: data.user.id,
          nombre: nombre,
          role: 'cliente',
          rol: 'cliente',
          fecha_nacimiento: fecha_nacimiento,
          tipo_sangre: tipo_sangre,
          color_ojos: color_ojos,
          vacaciones_anuales: vacaciones_anuales
        });

      if (insertError) {
        console.error('Error insertando usuario en la tabla pública:', insertError);
      } else {
        // Otorgar cupón 20% primera compra
        const cuponCode = `BIENVENIDO-${data.user.id.substring(0, 6).toUpperCase()}`;
        await this.supabaseService.client.from('coupons').insert({
          codigo: cuponCode,
          porcentaje_descuento: 20,
          es_primera_compra: true,
          edad_minima: 0,
          activo: true
        });
      }
    }

    return data;
  }

  async signOut() {
    await this.supabaseService.auth.signOut();
  }
}
