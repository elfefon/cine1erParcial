import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Usuario } from '../../models/usuario.interface';
import { User } from '@supabase/supabase-js';

const USER_CACHE_KEY = 'cineutn_cached_user_v1';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabaseService = inject(SupabaseService);
  public usuarioActual = signal<Usuario | null>(this.leerCacheUsuario());
  private sessionInitPromise: Promise<Usuario | null> | null = null;

  constructor() {
    this.sessionInitPromise = this.initSession();
  }

  private leerCacheUsuario(): Usuario | null {
    try {
      const raw = localStorage.getItem(USER_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private guardarCacheUsuario(user: Usuario | null) {
    try {
      if (user) {
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_CACHE_KEY);
      }
    } catch {}
  }

  private async initSession(): Promise<Usuario | null> {
    try {
      const { data: { session } } = await this.supabaseService.auth.getSession();
      if (session?.user) {
        await this.loadUserProfile(session.user);
      } else {
        this.usuarioActual.set(null);
        this.guardarCacheUsuario(null);
      }
    } catch {
      // Mantener cache si hubo error de red momentáneo
    }

    this.supabaseService.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await this.loadUserProfile(session.user);
      } else {
        this.usuarioActual.set(null);
        this.guardarCacheUsuario(null);
      }
    });

    return this.usuarioActual();
  }

  async ensureSessionLoaded(): Promise<Usuario | null> {
    if (this.usuarioActual()) {
      return this.usuarioActual();
    }
    if (this.sessionInitPromise) {
      await this.sessionInitPromise;
    }
    if (!this.usuarioActual()) {
      const { data: { session } } = await this.supabaseService.auth.getSession();
      if (session?.user) {
        await this.loadUserProfile(session.user);
      }
    }
    return this.usuarioActual();
  }

  private async loadUserProfile(user: User) {
    try {
      const { data } = await this.supabaseService.client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        const usuario: Usuario = {
          ...data,
          role: data.role || 'cliente',
          email: user.email || ''
        };
        this.usuarioActual.set(usuario);
        this.guardarCacheUsuario(usuario);
      } else {
        const fallbackUser: Usuario = {
          id: user.id,
          nombre: (user.user_metadata as any)?.nombre || user.email?.split('@')[0] || 'Usuario',
          email: user.email || '',
          role: (user.user_metadata as any)?.role || 'cliente'
        };
        this.usuarioActual.set(fallbackUser);
        this.guardarCacheUsuario(fallbackUser);
      }
    } catch (e) {
      console.error('Error loading user profile', e);
    }
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabaseService.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      await this.loadUserProfile(data.user);
    }
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

    if (data.user) {
      const { error: insertError } = await this.supabaseService.client
        .from('profiles')
        .insert({
          id: data.user.id,
          nombre: nombre,
          role: 'cliente',
          fecha_nacimiento: fecha_nacimiento,
          tipo_sangre: tipo_sangre,
          color_ojos: color_ojos,
          vacaciones_anuales: vacaciones_anuales
        });

      if (insertError) {
        console.error('Error insertando usuario en la tabla pública:', insertError);
      } else {
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
    this.guardarCacheUsuario(null);
    this.usuarioActual.set(null);
    await this.supabaseService.auth.signOut();
  }
}
