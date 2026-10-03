import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { Pelicula } from '../../../../models/pelicula.interface';

@Injectable({
  providedIn: 'root'
})
export class PeliculasStateService {
  private supabase = inject(SupabaseService);

  peliculas = signal<Pelicula[]>([]);
  salas = signal<any[]>([]);
  funciones = signal<any[]>([]);

  recomendadasBorrador = signal<Pelicula[]>([]);

  constructor() {
    this.cargarPeliculas();
    this.cargarSalas();
    this.cargarFunciones();
  }

  async cargarPeliculas() {
    const data = await this.supabase.getTableData<Pelicula>('movies');
    this.peliculas.set(data || []);
    this.recomendadasBorrador.set((data || []).filter(p => p.recomendada));
  }

  async cargarSalas() {
    const data = await this.supabase.getTableData<any>('rooms');
    this.salas.set(data || []);
  }

  async cargarFunciones() {
    const { data, error } = await this.supabase.client.from('showtimes').select('*, movies(*), rooms(*)');
    if (!error) {
      this.funciones.set(data || []);
    } else {
      console.error('Error cargando funciones:', error);
    }
  }

  // Computed signals
  peliculasDisponiblesParaRecomendar = computed(() => {
    return this.peliculas().filter(p => !this.recomendadasBorrador().some(r => r.id === p.id) && p.activa);
  });

  peliculasProximamenteAdmin = computed(() => {
    const hoy = new Date().toISOString().split('T')[0];
    return this.peliculas().filter(p => p.fecha_estreno && p.fecha_estreno > hoy);
  });

  opcionesRecomendadas = computed(() => 
    this.peliculasDisponiblesParaRecomendar().map(p => ({ id: p.id || '', label: p.nombre }))
  );

  opcionesPreventas = computed(() => 
    this.peliculasProximamenteAdmin().map(p => ({ id: p.id || '', label: p.nombre }))
  );

  opcionesGenerales = computed(() => 
    this.peliculas().map(p => ({ id: p.id || '', label: p.nombre }))
  );

  async registrarAccion(tipo: string) {
    const user = await this.supabase.auth.getUser();
    if (user.data.user) {
      await this.supabase.insertData('activity_logs', {
        accion: tipo,
        entidad_afectada: 'Pelicula',
        user_id: user.data.user.id
      });
    }
  }
}
