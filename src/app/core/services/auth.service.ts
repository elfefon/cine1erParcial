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
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (data) {
        this.usuarioActual.set(data as Usuario);
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

  async signUp(email: string, password: string, nombre: string) {
    const { data, error } = await this.supabaseService.auth.signUp({ 
      email, 
      password,
      options: {
        data: { nombre, rol: 'cliente' }
      }
    });
    if (error) throw error;
    return data;
  }

  async signOut() {
    await this.supabaseService.auth.signOut();
  }
}
