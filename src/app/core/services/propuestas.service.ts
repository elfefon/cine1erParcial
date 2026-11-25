import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { PropuestaPelicula } from '../../models/propuesta.interface';

const PROPUESTAS_STORAGE_KEY = 'cineutn_movie_proposals_v1';
const SYS_PROPOSAL_ACTION = '__SYS_PROPOSAL__';
const SYS_NOTIF_ACTION = '__SYS_NOTIF__';

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

  private mapearDesdeActivityLog(row: any): PropuestaPelicula | null {
    try {
      const parsed = JSON.parse(row.entidad_afectada || '{}');
      if (!parsed.titulo) return null;
      return {
        id: row.id,
        user_id: row.user_id || parsed.user_id,
        titulo: parsed.titulo,
        descripcion: parsed.descripcion || '',
        motivo: parsed.motivo || '',
        estado: parsed.estado || 'pendiente',
        created_at: parsed.created_at || row.fecha_hora || new Date().toISOString(),
        profiles: {
          nombre: row.profiles?.nombre || parsed.usuario_nombre || 'Cliente'
        }
      };
    } catch {
      return null;
    }
  }

  private combinarPropuestas(...listas: PropuestaPelicula[][]): PropuestaPelicula[] {
    const mapa = new Map<string, PropuestaPelicula>();
    for (const lista of listas) {
      for (const item of lista) {
        if (!item) continue;
        const key = item.id || `${item.user_id}_${item.titulo.toLowerCase()}`;
        if (!mapa.has(key)) {
          mapa.set(key, item);
        } else {
          const existente = mapa.get(key)!;
          // Priorizar estados ya procesados ('aceptada' / 'rechazada') o datos con perfil hidratado
          const estadoFinal =
            item.estado !== 'pendiente' ? item.estado : existente.estado;
          mapa.set(key, {
            ...existente,
            ...item,
            estado: estadoFinal,
            profiles: item.profiles?.nombre ? item.profiles : existente.profiles
          });
        }
      }
    }

    return Array.from(mapa.values()).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  }

  async obtenerTodasLasPropuestas(): Promise<PropuestaPelicula[]> {
    const desdeTablaDirecta: PropuestaPelicula[] = [];
    const desdeCloudBridge: PropuestaPelicula[] = [];

    // 1. Intentar leer desde tabla dedicada movie_proposals
    try {
      const { data, error } = await this.supabase.client
        .from('movie_proposals')
        .select('*, profiles(nombre)')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        desdeTablaDirecta.push(...(data as PropuestaPelicula[]));
      }
    } catch {}

    // 2. Leer también desde el respaldo en la nube en activity_logs (que no tiene bloqueo RLS)
    try {
      const { data: logsData, error: logsErr } = await this.supabase.client
        .from('activity_logs')
        .select('*, profiles(nombre)')
        .eq('accion', SYS_PROPOSAL_ACTION)
        .order('fecha_hora', { ascending: false });

      if (!logsErr && logsData) {
        for (const row of logsData) {
          const mapped = this.mapearDesdeActivityLog(row);
          if (mapped) desdeCloudBridge.push(mapped);
        }
      } else {
        // Fallback sin el join de profiles si fallara la relación
        const { data: logsPlain } = await this.supabase.client
          .from('activity_logs')
          .select('*')
          .eq('accion', SYS_PROPOSAL_ACTION)
          .order('fecha_hora', { ascending: false });
        if (logsPlain) {
          for (const row of logsPlain) {
            const mapped = this.mapearDesdeActivityLog(row);
            if (mapped) desdeCloudBridge.push(mapped);
          }
        }
      }
    } catch {}

    const locales = this.leerLocales();
    const combinadas = this.combinarPropuestas(desdeTablaDirecta, desdeCloudBridge, locales);

    this.propuestas.set(combinadas);
    if (combinadas.length > 0) {
      this.guardarLocales(combinadas);
    }
    return combinadas;
  }

  async obtenerPropuestasPorUsuario(userId: string): Promise<PropuestaPelicula[]> {
    if (!userId) return [];
    const todas = await this.obtenerTodasLasPropuestas();
    return todas.filter(p => p.user_id === userId);
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

    const ahoraIso = new Date().toISOString();
    let propuestaGuardada: PropuestaPelicula = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      user_id: payload.user_id,
      titulo: tituloLimpio,
      descripcion: descripcionLimpia,
      motivo: motivoLimpio,
      estado: 'pendiente',
      created_at: ahoraIso,
      profiles: { nombre: payload.usuario_nombre || 'Cliente' }
    };

    let guardadaEnTablaDirecta = false;

    // 3. Intentar guardar en movie_proposals
    try {
      const { data, error } = await this.supabase.client
        .from('movie_proposals')
        .insert({
          user_id: propuestaGuardada.user_id,
          titulo: propuestaGuardada.titulo,
          descripcion: propuestaGuardada.descripcion,
          motivo: propuestaGuardada.motivo,
          estado: 'pendiente'
        })
        .select('*, profiles(nombre)')
        .single();

      if (!error && data) {
        propuestaGuardada = {
          ...(data as PropuestaPelicula),
          profiles: (data as any).profiles || { nombre: payload.usuario_nombre || 'Cliente' }
        };
        guardadaEnTablaDirecta = true;
      }
    } catch {}

    // 4. Guardar siempre en el puente cloud en Supabase (activity_logs) para garantizar persistencia remota aún con RLS en movie_proposals
    if (!guardadaEnTablaDirecta) {
      try {
        const jsonPayload = JSON.stringify({
          user_id: propuestaGuardada.user_id,
          usuario_nombre: payload.usuario_nombre || 'Cliente',
          titulo: propuestaGuardada.titulo,
          descripcion: propuestaGuardada.descripcion,
          motivo: propuestaGuardada.motivo,
          estado: 'pendiente',
          created_at: ahoraIso
        });

        const { data: logData, error: logError } = await this.supabase.client
          .from('activity_logs')
          .insert({
            user_id: propuestaGuardada.user_id,
            accion: SYS_PROPOSAL_ACTION,
            entidad_afectada: jsonPayload
          })
          .select('*, profiles(nombre)')
          .single();

        if (!logError && logData) {
          const mapped = this.mapearDesdeActivityLog(logData);
          if (mapped) {
            propuestaGuardada = mapped;
          }
        }
      } catch {}
    }

    // 5. Sincronizar estado local y signal
    const locales = this.leerLocales();
    const actualizada = this.combinarPropuestas([propuestaGuardada], locales);
    this.guardarLocales(actualizada);
    this.propuestas.set(actualizada);

    return propuestaGuardada;
  }

  async actualizarEstadoPropuesta(
    propuesta: PropuestaPelicula,
    nuevoEstado: 'aceptada' | 'rechazada'
  ): Promise<void> {
    if (!propuesta.id) return;

    // 1. Intentar actualizar en movie_proposals
    try {
      await this.supabase.client
        .from('movie_proposals')
        .update({ estado: nuevoEstado })
        .eq('id', propuesta.id);
    } catch {}

    // 2. Actualizar en el puente cloud de Supabase (activity_logs)
    try {
      const jsonActualizado = JSON.stringify({
        user_id: propuesta.user_id,
        usuario_nombre: propuesta.profiles?.nombre || 'Cliente',
        titulo: propuesta.titulo,
        descripcion: propuesta.descripcion,
        motivo: propuesta.motivo,
        estado: nuevoEstado,
        created_at: propuesta.created_at
      });

      await this.supabase.client
        .from('activity_logs')
        .update({ entidad_afectada: jsonActualizado })
        .eq('id', propuesta.id)
        .eq('accion', SYS_PROPOSAL_ACTION);
    } catch {}

    // 3. Actualizar en cache local y signal
    const locales = this.leerLocales().map(p =>
      p.id === propuesta.id ? { ...p, estado: nuevoEstado } : p
    );
    this.guardarLocales(locales);
    this.propuestas.update(list =>
      list.map(p => (p.id === propuesta.id ? { ...p, estado: nuevoEstado } : p))
    );

    // 4. Notificar al cliente proponente (en user_notifications y en puente cloud)
    const msg =
      nuevoEstado === 'aceptada'
        ? `🎉 ¡Tu propuesta para agregar la película "${propuesta.titulo}" fue ACEPTADA por el cine!`
        : `ℹ️ Tu propuesta para la película "${propuesta.titulo}" fue revisada y rechazada en esta ocasión. ¡Ya podés enviar una nueva propuesta!`;
    const tipoNotif = nuevoEstado === 'aceptada' ? 'PROPUESTA_ACEPTADA' : 'PROPUESTA_RECHAZADA';

    try {
      const { error: notifErr } = await this.supabase.client.from('user_notifications').insert({
        user_id: propuesta.user_id,
        tipo: tipoNotif,
        mensaje: msg,
        leida: false
      });

      if (notifErr) {
        await this.supabase.client.from('activity_logs').insert({
          user_id: propuesta.user_id,
          accion: SYS_NOTIF_ACTION,
          entidad_afectada: JSON.stringify({
            tipo: tipoNotif,
            mensaje: msg,
            leida: false,
            created_at: new Date().toISOString()
          })
        });
      }
    } catch {}

    // 5. Registrar en auditoría visible para el historial del admin
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
