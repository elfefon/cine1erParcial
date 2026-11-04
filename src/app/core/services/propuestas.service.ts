import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { PropuestaPelicula } from '../../models/propuesta.interface';

const PROPUESTAS_STORAGE_KEY = 'cineutn_movie_proposals_v1';

@Injectable({
  providedIn: 'root'
})
export class PropuestasService {
  private supabase = inject(SupabaseService);

  propuestas = signal<PropuestaPelicula[]>([]);

  private leerLocales(): PropuestaPelicula[] {
    try {
      const raw = localStorage.getItem(PROPUESTAS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private guardarLocales(lista: PropuestaPelicula[]) {
    try {
      localStorage.setItem(PROPUESTAS_STORAGE_KEY, JSON.stringify(lista));
    } catch {}
  }

  async obtenerTodasLasPropuestas(): Promise<PropuestaPelicula[]> {
    try {
      const { data, error } = await this.supabase.client
        .from('movie_proposals')
        .select('*, profiles(nombre)')
        .order('created_at', { ascending: false });

      if (!error && data) {
        this.propuestas.set(data as PropuestaPelicula[]);
        this.guardarLocales(data as PropuestaPelicula[]);
        return data as PropuestaPelicula[];
      }
    } catch {}

    const locales = this.leerLocales().sort((a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    this.propuestas.set(locales);
    return locales;
  }

  async obtenerPropuestasPorUsuario(userId: string): Promise<PropuestaPelicula[]> {
    try {
      const { data, error } = await this.supabase.client
        .from('movie_proposals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as PropuestaPelicula[];
      }
    } catch {}

    return this.leerLocales()
      .filter(p => p.user_id === userId)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async obtenerPropuestaPendienteUsuario(userId: string): Promise<PropuestaPelicula | null> {
    const lista = await this.obtenerPropuestasPorUsuario(userId);
    return lista.find(p => p.estado === 'pendiente') || null;
  }

  async enviarPropuesta(payload: {
    user_id: string;
    usuario_nombre?: string;
    titulo: string;
    descripcion: string;
    motivo: string;
  }): Promise<PropuestaPelicula> {
    const tituloLimpio = payload.titulo.trim();
    const descripcionLimpia = payload.descripcion.trim();
    const motivoLimpio = payload.motivo.trim();

    if (!tituloLimpio || !descripcionLimpia || !motivoLimpio) {
      throw new Error('Todos los campos (título, descripción y explicación) son obligatorios.');
    }

    // 1. Verificar que el usuario no tenga ya una propuesta activa/pendiente (1 propuesta a la vez)
    const pendiente = await this.obtenerPropuestaPendienteUsuario(payload.user_id);
    if (pendiente) {
      throw new Error('Ya tenés una propuesta pendiente de revisión. Solo podés hacer una propuesta a la vez.');
    }

    // 2. Verificar que la película no esté ya en la cartelera
    try {
      const { data: pelisExistentes } = await this.supabase.client
        .from('movies')
        .select('id, nombre')
        .ilike('nombre', tituloLimpio);

      if (pelisExistentes && pelisExistentes.length > 0) {
        throw new Error(`La película "${pelisExistentes[0].nombre}" ya se encuentra registrada en nuestro catálogo.`);
      }
    } catch (err: any) {
      if (err.message?.includes('ya se encuentra registrada')) {
        throw err;
      }
    }

    const nueva: PropuestaPelicula = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      user_id: payload.user_id,
      titulo: tituloLimpio,
      descripcion: descripcionLimpia,
      motivo: motivoLimpio,
      estado: 'pendiente',
      created_at: new Date().toISOString(),
      profiles: { nombre: payload.usuario_nombre || 'Cliente' }
    };

    try {
      const { data, error } = await this.supabase.client
        .from('movie_proposals')
        .insert({
          user_id: nueva.user_id,
          titulo: nueva.titulo,
          descripcion: nueva.descripcion,
          motivo: nueva.motivo,
          estado: 'pendiente'
        })
        .select('*, profiles(nombre)')
        .single();

      if (!error && data) {
        const locales = this.leerLocales();
        this.guardarLocales([data as PropuestaPelicula, ...locales]);
        return data as PropuestaPelicula;
      }
    } catch {}

    // Fallback en localStorage si la tabla remota no está migrada aún
    const locales = this.leerLocales();
    const actualizada = [nueva, ...locales];
    this.guardarLocales(actualizada);
    this.propuestas.set(actualizada);
    return nueva;
  }

  async actualizarEstadoPropuesta(
    propuesta: PropuestaPelicula,
    nuevoEstado: 'aceptada' | 'rechazada'
  ): Promise<void> {
    if (!propuesta.id) return;

    try {
      await this.supabase.client
        .from('movie_proposals')
        .update({ estado: nuevoEstado })
        .eq('id', propuesta.id);
    } catch {}

    const locales = this.leerLocales().map(p =>
      p.id === propuesta.id ? { ...p, estado: nuevoEstado } : p
    );
    this.guardarLocales(locales);
    this.propuestas.update(list =>
      list.map(p => (p.id === propuesta.id ? { ...p, estado: nuevoEstado } : p))
    );

    // Notificar al cliente proponente
    try {
      const msg =
        nuevoEstado === 'aceptada'
          ? `🎉 ¡Tu propuesta para agregar la película "${propuesta.titulo}" fue ACEPTADA por el cine!`
          : `ℹ️ Tu propuesta para la película "${propuesta.titulo}" fue revisada y rechazada en esta ocasión. ¡Ya podés enviar una nueva propuesta!`;

      await this.supabase.client.from('user_notifications').insert({
        user_id: propuesta.user_id,
        tipo: nuevoEstado === 'aceptada' ? 'PROPUESTA_ACEPTADA' : 'PROPUESTA_RECHAZADA',
        mensaje: msg,
        leida: false
      });
    } catch {}

    // Registrar en auditoría
    try {
      const { data: authData } = await this.supabase.auth.getUser();
      if (authData?.user) {
        await this.supabase.client.from('activity_logs').insert({
          user_id: authData.user.id,
          accion: nuevoEstado === 'aceptada' ? 'ACCEPT_MOVIE_PROPOSAL' : 'REJECT_MOVIE_PROPOSAL',
          entidad_afectada: `Propuesta: ${propuesta.titulo}`
        });
      }
    } catch {}
  }
}
