import { Injectable, signal } from '@angular/core';
import {
  AuthChangeEvent,
  createClient,
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly _supabase: SupabaseClient;

  // Reactive signals for modern Angular state management
  readonly currentUser = signal<User | null>(null);
  readonly currentSession = signal<Session | null>(null);

  constructor() {
    const supabaseKey = environment.supabasePublishableKey || environment.supabaseKey;
    this._supabase = createClient(environment.supabaseUrl, supabaseKey);

    // Initial auth state check
    this._supabase.auth.getSession().then(({ data: { session } }) => {
      this.currentSession.set(session);
      this.currentUser.set(session?.user ?? null);
    });

    // Listen for auth state changes (login, logout, token refresh, etc.)
    this._supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        this.currentSession.set(session);
        this.currentUser.set(session?.user ?? null);
      }
    );
  }

  // Access the underlying SupabaseClient
  get client(): SupabaseClient {
    return this._supabase;
  }

  get supabase(): SupabaseClient {
    return this._supabase;
  }

  // Convenience accessors for Supabase modules
  get auth() {
    return this._supabase.auth;
  }

  get storage() {
    return this._supabase.storage;
  }

  // Query database tables directly: supabaseService.from('peliculas').select('*')
  from(table: string) {
    return this._supabase.from(table);
  }

  // Call Database Functions (Stored Procedures)
  rpc(fn: string, args?: Record<string, any>) {
    return this._supabase.rpc(fn, args);
  }
}
