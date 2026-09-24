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
  
  //==================================================
  //     Métodos extraccion de peliculas de bdd
  //==================================================

  /*poblacion de datos en bdd (buscar lista en tmbd)
  
  public async poblarBaseDeDatos() {
  console.log("Iniciando la carga de 100 películas populares...");
  
  try {
    // Un bucle para traer las páginas 1, 2, 3, 4 y 5 (20 películas por página)
    for (let page = 1; page <= 5; page++) {
      // Reemplaza TU_API_KEY por tu variable real
      const url = `https://api.themoviedb.org/3/movie/popular?api_key=${environment.tmbd_key}&language=es-ES&page=${page}`;
      
      const response = await fetch(url);
      const data = await response.json();

      // Recorremos las 20 películas de la página actual
      for (const movieList of data.results) {
        // Reutilizamos tu método actual pasándole el ID
        // Esto traerá la duración, restricción de edad y la insertará en Supabase
        await this.importarPelicula(movieList.id);
      }
      
      console.log(`✅ Página ${page} procesada (20 películas).`);
    }
    
    console.log("🎉 ¡Las 100 películas se cargaron exitosamente en Supabase!");

  } catch (error: any) {
    console.error("❌ Error en el proceso masivo:", error.message);
  }
}
*/
  // Función para calcular la edad
  private obtenerRestriccionEdad(releaseDates: any): number {
    if (!releaseDates || !releaseDates.results) return 0;
    const usRelease = releaseDates.results.find((r: any) => r.iso_3166_1 === 'US');
    if (usRelease) {
      const certObj = usRelease.release_dates.find((d: any) => d.certification !== '');
      const certUS = certObj ? certObj.certification : '';
      if (['G', 'PG'].includes(certUS)) return 0;
      if (certUS === 'PG-13') return 13;
      if (['R', 'NC-17'].includes(certUS)) return 18;
    }
    return 0; 
  }

  // importación de peliculas
  private async importarPelicula(tmdbId: number) {
  try {
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${environment.tmbd_key}&language=es-ES&append_to_response=release_dates`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error de TMDB: ${response.status}`);
    const data = await response.json();

    const nuevaPelicula = {
      nombre: data.title,
      sinopsis: data.overview,
      duracion_min: data.runtime || 0,
      imagen_url: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
      restriccion_edad: this.obtenerRestriccionEdad(data.release_dates),
      generos: data.genres ? data.genres.map((g: any) => g.name) : [],
      fecha_estreno: data.release_date || null
    };

    const { data: peliculaGuardada, error } = await this._supabase
      .from('movies')
      .insert([nuevaPelicula])
      .select();

    if (error) throw error;
    
    console.log(`Éxito: "${peliculaGuardada[0].nombre}" guardada en tu Supabase con ID:`, peliculaGuardada[0].id);
    return peliculaGuardada[0];

  } catch (error:any) {
    console.error("Error importando la película:", error.message);
  }
}

  //==================================================
  //              Métodos genéricos
  //==================================================

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
