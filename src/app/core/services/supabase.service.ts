import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly _supabase: SupabaseClient;

  constructor() {
    this._supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  get client(): SupabaseClient {
    return this._supabase;
  }

  get auth() {
    return this._supabase.auth;
  }

  // Métodos genéricos
  async getTableData<T>(table: string): Promise<T[]> {
    const { data, error } = await this._supabase.from(table).select('*');
    if (error) throw error;
    return data as T[];
  }

  async insertData<T>(table: string, payload: any): Promise<T> {
    const { data, error } = await this._supabase.from(table).insert(payload).select().single();
    if (error) throw error;
    return data as T;
  }
  
  async updateData<T>(table: string, id: string, payload: any): Promise<T> {
    const { data, error } = await this._supabase.from(table).update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as T;
  }
  
  async deleteData(table: string, id: string): Promise<void> {
    const { error } = await this._supabase.from(table).delete().eq('id', id);
    if (error) throw error;
  }
}
