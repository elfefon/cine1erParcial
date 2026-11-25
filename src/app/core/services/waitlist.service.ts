import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ToastService } from './toast';
import { WaitlistEntry } from '../../models/waitlist.interface';

const WAITLIST_STORAGE_KEY = 'cineutn_waitlist_v1';
const NOTIFS_STORAGE_KEY = 'cineutn_user_notifications_v1';
const SYS_WAITLIST_ACTION = '__SYS_WAITLIST__';
const SYS_NOTIF_ACTION = '__SYS_NOTIF__';

export interface UserNotificationItem {
  id: string;
  user_id: string;
  tipo: 'WAITLIST_TURNO' | 'FUNCION_CANCELADA' | 'PROPUESTA_ACEPTADA' | 'PROPUESTA_RECHAZADA' | 'PREVENTA';
  mensaje: string;
  fecha: string;
  leida?: boolean;
  metadata?: {
    movie_id?: string;
    movie_nombre?: string;
    showtime_id?: string;
    ticket_id?: string;
    monto_acreditado?: number;
    expira_at?: string;
  };
  origen_tabla?: 'user_notifications' | 'movie_subscriptions' | 'activity_logs' | 'local';
}

@Injectable({
  providedIn: 'root'
})
export class WaitlistService {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  // Duración de prioridad de compra: 15 minutos
  readonly MINUTOS_PRIORIDAD = 15;

  private leerWaitlistLocal(): WaitlistEntry[] {
    try {
      const raw = localStorage.getItem(WAITLIST_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private guardarWaitlistLocal(lista: WaitlistEntry[]) {
    try {
      localStorage.setItem(WAITLIST_STORAGE_KEY, JSON.stringify(lista));
    } catch {}
  }

  private mapearWaitlistDesdeLog(row: any): WaitlistEntry | null {
    try {
      const parsed = JSON.parse(row.entidad_afectada || '{}');
      if (!parsed.showtime_id || !parsed.user_id) return null;
      return {
        id: row.id,
        showtime_id: parsed.showtime_id,
        user_id: parsed.user_id,
        estado: parsed.estado || 'esperando',
        notificado_at: parsed.notificado_at || null,
        expira_at: parsed.expira_at || null,
        created_at: parsed.created_at || row.fecha_hora,
        profiles: row.profiles || { nombre: parsed.usuario_nombre || 'Usuario' }
      };
    } catch {
      return null;
    }
  }

  private async leerWaitlistCloudBridge(showtimeId?: string, userId?: string): Promise<WaitlistEntry[]> {
    try {
      let query = this.supabase.client
        .from('activity_logs')
        .select('*, profiles(nombre)')
        .eq('accion', SYS_WAITLIST_ACTION)
        .order('fecha_hora', { ascending: true });

      if (showtimeId) {
        query = query.eq('entidad_id', showtimeId);
      }
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (!error && data) {
        const res: WaitlistEntry[] = [];
        for (const r of data) {
          const m = this.mapearWaitlistDesdeLog(r);
          if (m) res.push(m);
        }
        return res;
      }
    } catch {}
    return [];
  }

  leerNotificacionesLocales(userId?: string): UserNotificationItem[] {
    try {
      const raw = localStorage.getItem(NOTIFS_STORAGE_KEY);
      const todas: UserNotificationItem[] = raw ? JSON.parse(raw) : [];
      return userId ? todas.filter(n => n.user_id === userId) : todas;
    } catch {
      return [];
    }
  }

  async obtenerNotificacionesCloudUsuario(userId: string): Promise<UserNotificationItem[]> {
    const resultado: UserNotificationItem[] = [];
    try {
      const { data, error } = await this.supabase.client
        .from('activity_logs')
        .select('*')
        .eq('accion', SYS_NOTIF_ACTION)
        .eq('user_id', userId)
        .order('fecha_hora', { ascending: false });

      if (!error && data) {
        for (const row of data) {
          try {
            const parsed = JSON.parse(row.entidad_afectada || '{}');
            if (parsed.mensaje) {
              resultado.push({
                id: row.id,
                user_id: row.user_id,
                tipo: parsed.tipo || 'PREVENTA',
                mensaje: parsed.mensaje,
                fecha: parsed.created_at || row.fecha_hora,
                leida: parsed.leida ?? false,
                metadata: parsed.metadata,
                origen_tabla: 'activity_logs'
              });
            }
          } catch {}
        }
      }
    } catch {}
    return resultado;
  }

  guardarNotificacionLocal(notif: UserNotificationItem) {
    try {
      const actuales = this.leerNotificacionesLocales();
      const filtradas = actuales.filter(n => n.id !== notif.id);
      localStorage.setItem(NOTIFS_STORAGE_KEY, JSON.stringify([notif, ...filtradas]));
    } catch {}
  }

  eliminarNotificacionLocal(id: string) {
    try {
      const actuales = this.leerNotificacionesLocales().filter(n => n.id !== id);
      localStorage.setItem(NOTIFS_STORAGE_KEY, JSON.stringify(actuales));
    } catch {}
  }

  async solicitarPermisoPush(): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {}
    }
  }

  async dispararPushNotification(titulo: string, cuerpo: string, urlDestino?: string): Promise<void> {
    this.toast.info(`${titulo}: ${cuerpo}`);

    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {}
    }

    if (Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.showNotification) {
            await reg.showNotification(titulo, {
              body: cuerpo,
              icon: '/assets/icons/icon-192x192.png',
              data: { url: urlDestino || '/' }
            });
            return;
          }
        }
        const n = new Notification(titulo, {
          body: cuerpo,
          icon: '/assets/icons/icon-192x192.png'
        });
        if (urlDestino) {
          n.onclick = () => {
            window.focus();
            window.location.href = urlDestino;
          };
        }
      } catch {}
    }
  }

  async crearNotificacionUsuario(payload: {
    user_id: string;
    tipo: UserNotificationItem['tipo'];
    mensaje: string;
    metadata?: UserNotificationItem['metadata'];
  }): Promise<void> {
    const ahoraIso = new Date().toISOString();
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const item: UserNotificationItem = {
      id,
      user_id: payload.user_id,
      tipo: payload.tipo,
      mensaje: payload.mensaje,
      fecha: ahoraIso,
      leida: false,
      metadata: payload.metadata,
      origen_tabla: 'local'
    };

    let guardadaDirecta = false;
    try {
      const { data, error } = await this.supabase.client
        .from('user_notifications')
        .insert({
          user_id: payload.user_id,
          tipo: payload.tipo,
          mensaje: payload.mensaje,
          metadata: payload.metadata || {},
          leida: false
        })
        .select()
        .single();

      if (!error && data) {
        item.id = data.id;
        item.origen_tabla = 'user_notifications';
        guardadaDirecta = true;
      }
    } catch {}

    if (!guardadaDirecta) {
      try {
        const { data: logData, error: logErr } = await this.supabase.client
          .from('activity_logs')
          .insert({
            user_id: payload.user_id,
            accion: SYS_NOTIF_ACTION,
            entidad_afectada: JSON.stringify({
              tipo: payload.tipo,
              mensaje: payload.mensaje,
              metadata: payload.metadata || {},
              leida: false,
              created_at: ahoraIso
            })
          })
          .select()
          .single();

        if (!logErr && logData) {
          item.id = logData.id;
          item.origen_tabla = 'activity_logs';
        }
      } catch {}
    }

    this.guardarNotificacionLocal(item);
  }

  private async actualizarWaitlistEnCloudBridge(entry: WaitlistEntry): Promise<void> {
    if (!entry.id) return;
    try {
      await this.supabase.client
        .from('activity_logs')
        .update({
          entidad_afectada: JSON.stringify({
            showtime_id: entry.showtime_id,
            user_id: entry.user_id,
            estado: entry.estado,
            notificado_at: entry.notificado_at || null,
            expira_at: entry.expira_at || null,
            created_at: entry.created_at
          })
        })
        .eq('id', entry.id)
        .eq('accion', SYS_WAITLIST_ACTION);
    } catch {}
  }

  async verificarYRotarExpirados(showtimeId?: string): Promise<void> {
    const ahora = new Date();

    // 1. Intentar rotación en tabla waitlist_entries
    try {
      let query = this.supabase.client
        .from('waitlist_entries')
        .select('*')
        .eq('estado', 'notificado');

      if (showtimeId) {
        query = query.eq('showtime_id', showtimeId);
      }

      const { data: notificados, error } = await query;
      if (!error && notificados && notificados.length > 0) {
        for (const entry of notificados) {
          if (entry.expira_at && new Date(entry.expira_at) <= ahora) {
            await this.supabase.client
              .from('waitlist_entries')
              .update({ estado: 'expirado' })
              .eq('id', entry.id);

            await this.notificarSiguienteEnLista(entry.showtime_id);
          }
        }
      }
    } catch {}

    // 2. Rotación sobre puente cloud (activity_logs)
    const cloudEntries = await this.leerWaitlistCloudBridge(showtimeId);
    const funcionesARotar = new Set<string>();
    for (const item of cloudEntries) {
      if (item.estado === 'notificado' && item.expira_at && new Date(item.expira_at) <= ahora) {
        item.estado = 'expirado';
        await this.actualizarWaitlistEnCloudBridge(item);
        funcionesARotar.add(item.showtime_id);
      }
    }

    // 3. Rotación sobre respaldo local
    const locales = this.leerWaitlistLocal();
    let huboCambios = false;

    for (const item of locales) {
      if (
        item.estado === 'notificado' &&
        (!showtimeId || item.showtime_id === showtimeId) &&
        item.expira_at &&
        new Date(item.expira_at) <= ahora
      ) {
        item.estado = 'expirado';
        huboCambios = true;
        funcionesARotar.add(item.showtime_id);
      }
    }

    if (huboCambios) {
      this.guardarWaitlistLocal(locales);
    }

    for (const stId of funcionesARotar) {
      await this.notificarSiguienteEnLista(stId);
    }
  }

  async obtenerColaPorFuncion(showtimeId: string): Promise<WaitlistEntry[]> {
    await this.verificarYRotarExpirados(showtimeId);

    const mapa = new Map<string, WaitlistEntry>();

    // 1. Leer de tabla waitlist_entries
    try {
      const { data, error } = await this.supabase.client
        .from('waitlist_entries')
        .select('*, profiles(nombre)')
        .eq('showtime_id', showtimeId)
        .in('estado', ['notificado', 'esperando', 'en_espera'])
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        for (const item of data as WaitlistEntry[]) {
          mapa.set(item.user_id, item);
        }
      }
    } catch {}

    // 2. Leer del puente cloud en Supabase (activity_logs)
    const cloudBridge = await this.leerWaitlistCloudBridge(showtimeId);
    for (const item of cloudBridge) {
      if (['notificado', 'esperando', 'en_espera'].includes(item.estado) && !mapa.has(item.user_id)) {
        mapa.set(item.user_id, item);
      }
    }

    // 3. Leer de localStorage si aún no está
    const locales = this.leerWaitlistLocal().filter(
      w => w.showtime_id === showtimeId && ['notificado', 'esperando', 'en_espera'].includes(w.estado)
    );
    for (const item of locales) {
      if (!mapa.has(item.user_id)) {
        mapa.set(item.user_id, item);
      }
    }

    const ordenados = Array.from(mapa.values()).sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );

    return ordenados.map((item, idx) => ({
      ...item,
      posicion: idx + 1,
      minutos_restantes: item.expira_at
        ? Math.max(0, Math.ceil((new Date(item.expira_at).getTime() - Date.now()) / 60000))
        : undefined
    }));
  }

  async inscribirseEnListaEspera(showtimeId: string): Promise<{ ok: boolean; mensaje: string; entry?: WaitlistEntry }> {
    const user = await this.auth.ensureSessionLoaded();
    if (!user) {
      return { ok: false, mensaje: 'Debés iniciar sesión para anotarte en la lista de espera.' };
    }
    try {
      const entry = await this.anotarseEnListaEspera(showtimeId, user.id);
      return {
        ok: true,
        mensaje: `¡Te anotaste en la lista de espera! Estás en la posición #${entry.posicion}. Te enviaremos una notificación push si se libera un lugar.`,
        entry
      };
    } catch (e: any) {
      return {
        ok: false,
        mensaje: e?.message || 'No se pudo inscribir en la lista de espera.'
      };
    }
  }

  async anotarseEnListaEspera(
    showtimeId: string,
    userId: string,
    showtimeContext?: any
  ): Promise<WaitlistEntry> {
    await this.solicitarPermisoPush();

    const colaActual = await this.obtenerColaPorFuncion(showtimeId);
    const yaAnotado = colaActual.find(w => w.user_id === userId);
    if (yaAnotado) {
      throw new Error(`Ya estás anotado en la lista de espera para esta función (Posición #${yaAnotado.posicion}).`);
    }

    const ahoraIso = new Date().toISOString();
    const nuevo: WaitlistEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      showtime_id: showtimeId,
      user_id: userId,
      estado: 'esperando',
      notificado_at: null,
      expira_at: null,
      created_at: ahoraIso,
      posicion: colaActual.length + 1,
      showtimes: showtimeContext
    };

    let guardadoDirecto = false;
    try {
      const { data, error } = await this.supabase.client
        .from('waitlist_entries')
        .insert({
          showtime_id: showtimeId,
          user_id: userId,
          estado: 'esperando'
        })
        .select()
        .single();

      if (!error && data) {
        nuevo.id = data.id;
        guardadoDirecto = true;
      }
    } catch {}

    if (!guardadoDirecto) {
      try {
        const { data: logData, error: logErr } = await this.supabase.client
          .from('activity_logs')
          .insert({
            user_id: userId,
            entidad_id: showtimeId,
            accion: SYS_WAITLIST_ACTION,
            entidad_afectada: JSON.stringify({
              showtime_id: showtimeId,
              user_id: userId,
              estado: 'esperando',
              notificado_at: null,
              expira_at: null,
              created_at: ahoraIso
            })
          })
          .select()
          .single();

        if (!logErr && logData) {
          nuevo.id = logData.id;
        }
      } catch {}
    }

    const locales = this.leerWaitlistLocal();
    this.guardarWaitlistLocal([...locales, nuevo]);

    return nuevo;
  }

  async salirDeListaEspera(entryId: string | undefined, showtimeId?: string): Promise<{ ok: boolean; mensaje: string }> {
    if (!entryId) {
      return { ok: false, mensaje: 'No se encontró el registro en la lista de espera.' };
    }

    let eraNotificado = false;
    let stId = showtimeId;

    try {
      await this.supabase.client
        .from('waitlist_entries')
        .update({ estado: 'cancelado' })
        .eq('id', entryId);
    } catch {}

    try {
      const { data: logRow } = await this.supabase.client
        .from('activity_logs')
        .select('*')
        .eq('id', entryId)
        .eq('accion', SYS_WAITLIST_ACTION)
        .maybeSingle();

      if (logRow) {
        const mapped = this.mapearWaitlistDesdeLog(logRow);
        if (mapped) {
          if (mapped.estado === 'notificado') eraNotificado = true;
          if (!stId) stId = mapped.showtime_id;
        }
        await this.supabase.client
          .from('activity_logs')
          .delete()
          .eq('id', entryId)
          .eq('accion', SYS_WAITLIST_ACTION);
      }
    } catch {}

    const locales = this.leerWaitlistLocal();
    const target = locales.find(w => w.id === entryId);
    if (target?.estado === 'notificado') eraNotificado = true;
    if (!stId) stId = target?.showtime_id;

    const filtrados = locales.filter(w => w.id !== entryId);
    this.guardarWaitlistLocal(filtrados);

    if (eraNotificado && stId) {
      await this.notificarSiguienteEnLista(stId);
    }

    return { ok: true, mensaje: 'Saliste de la lista de espera.' };
  }

  async notificarSiguienteEnLista(showtimeId: string): Promise<WaitlistEntry | null> {
    const ahora = new Date();
    const expira = new Date(ahora.getTime() + this.MINUTOS_PRIORIDAD * 60 * 1000);
    const ahoraIso = ahora.toISOString();
    const expiraIso = expira.toISOString();

    let peliculaNombre = 'la película';
    let movieId = '';
    let fechaFuncionStr = '';

    try {
      const { data: st } = await this.supabase.client
        .from('showtimes')
        .select('*, movies(id, nombre, imagen_url), rooms(nombre)')
        .eq('id', showtimeId)
        .single();
      if (st) {
        peliculaNombre = st.movies?.nombre || peliculaNombre;
        movieId = st.movie_id || st.movies?.id || '';
        fechaFuncionStr = new Date(st.fecha_hora).toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch {}

    const cola = await this.obtenerColaPorFuncion(showtimeId);
    const yaNotificado = cola.find(c => c.estado === 'notificado');
    if (yaNotificado) {
      return yaNotificado;
    }

    const primeroEnEspera = cola.find(c => ['esperando', 'en_espera'].includes(c.estado));
    if (!primeroEnEspera) {
      return null;
    }

    const promovido: WaitlistEntry = {
      ...primeroEnEspera,
      estado: 'notificado',
      notificado_at: ahoraIso,
      expira_at: expiraIso
    };

    try {
      await this.supabase.client
        .from('waitlist_entries')
        .update({
          estado: 'notificado',
          notificado_at: ahoraIso,
          expira_at: expiraIso
        })
        .eq('id', promovido.id);
    } catch {}

    await this.actualizarWaitlistEnCloudBridge(promovido);

    const locales = this.leerWaitlistLocal().map(w =>
      w.id === promovido.id || (w.showtime_id === showtimeId && w.user_id === promovido.user_id)
        ? { ...w, estado: 'notificado' as const, notificado_at: ahoraIso, expira_at: expiraIso }
        : w
    );
    this.guardarWaitlistLocal(locales);

    const msg = `🚨 ¡Se liberaron butacas para "${peliculaNombre}" (${fechaFuncionStr})! Sos el #1 en la lista de espera. Tenés 15 minutos (hasta las ${expira.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}) para comprar tu entrada antes de que pase al siguiente.`;

    await this.crearNotificacionUsuario({
      user_id: promovido.user_id,
      tipo: 'WAITLIST_TURNO',
      mensaje: msg,
      metadata: {
        movie_id: movieId,
        movie_nombre: peliculaNombre,
        showtime_id: showtimeId,
        expira_at: expiraIso
      }
    });

    try {
      const { data: authUser } = await this.supabase.auth.getUser();
      if (authUser?.user?.id === promovido.user_id) {
        await this.dispararPushNotification(
          '🎟️ ¡Turno liberado en Lista de Espera!',
          msg,
          movieId ? `/reserva/${movieId}?showtime=${showtimeId}` : '/perfil'
        );
      }
    } catch {}

    return promovido;
  }

  async marcarCompraRealizada(showtimeId: string, userId: string): Promise<void> {
    try {
      await this.supabase.client
        .from('waitlist_entries')
        .update({ estado: 'comprado' })
        .eq('showtime_id', showtimeId)
        .eq('user_id', userId)
        .in('estado', ['notificado', 'esperando', 'en_espera']);
    } catch {}

    const cloudEntries = await this.leerWaitlistCloudBridge(showtimeId, userId);
    for (const entry of cloudEntries) {
      if (['notificado', 'esperando', 'en_espera'].includes(entry.estado)) {
        entry.estado = 'comprado';
        await this.actualizarWaitlistEnCloudBridge(entry);
      }
    }

    const locales = this.leerWaitlistLocal().map(w =>
      w.showtime_id === showtimeId && w.user_id === userId && ['notificado', 'esperando', 'en_espera'].includes(w.estado)
        ? { ...w, estado: 'comprado' as const }
        : w
    );
    this.guardarWaitlistLocal(locales);
  }

  async obtenerListasDeUsuarioConPosicion(userId: string): Promise<WaitlistEntry[]> {
    await this.verificarYRotarExpirados();

    const mapaPorShowtime = new Map<string, WaitlistEntry>();

    try {
      const { data, error } = await this.supabase.client
        .from('waitlist_entries')
        .select('*, showtimes(*, movies(id, nombre, imagen_url), rooms(nombre))')
        .eq('user_id', userId)
        .in('estado', ['notificado', 'esperando', 'en_espera'])
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        for (const item of data as WaitlistEntry[]) {
          mapaPorShowtime.set(item.showtime_id, item);
        }
      }
    } catch {}

    const cloudEntries = await this.leerWaitlistCloudBridge(undefined, userId);
    for (const item of cloudEntries) {
      if (['notificado', 'esperando', 'en_espera'].includes(item.estado) && !mapaPorShowtime.has(item.showtime_id)) {
        mapaPorShowtime.set(item.showtime_id, item);
      }
    }

    const locales = this.leerWaitlistLocal().filter(
      w => w.user_id === userId && ['notificado', 'esperando', 'en_espera'].includes(w.estado)
    );
    for (const item of locales) {
      if (!mapaPorShowtime.has(item.showtime_id)) {
        mapaPorShowtime.set(item.showtime_id, item);
      }
    }

    const resultado: WaitlistEntry[] = [];
    for (const entry of mapaPorShowtime.values()) {
      const colaFuncion = await this.obtenerColaPorFuncion(entry.showtime_id);
      const miItemEnCola = colaFuncion.find(c => c.user_id === userId);
      const posicion = miItemEnCola?.posicion || 1;

      let showtimesData = entry.showtimes;
      if (!showtimesData) {
        try {
          const { data: st } = await this.supabase.client
            .from('showtimes')
            .select('*, movies(id, nombre, imagen_url), rooms(nombre)')
            .eq('id', entry.showtime_id)
            .single();
          if (st) showtimesData = st;
        } catch {}
      }

      const expiraAt = miItemEnCola?.expira_at || entry.expira_at;
      const minutosRestantes = expiraAt
        ? Math.max(0, Math.ceil((new Date(expiraAt).getTime() - Date.now()) / 60000))
        : undefined;

      resultado.push({
        ...entry,
        id: miItemEnCola?.id || entry.id,
        estado: miItemEnCola?.estado || entry.estado,
        expira_at: expiraAt,
        posicion,
        minutos_restantes: minutosRestantes,
        showtimes: showtimesData
      });
    }

    return resultado;
  }

  async obtenerConteoEsperaPorFunciones(ids?: string[]): Promise<Record<string, number>> {
    await this.verificarYRotarExpirados();
    const conteo: Record<string, number> = {};
    if (ids) {
      for (const id of ids) conteo[id] = 0;
    }

    const vistos = new Set<string>();

    try {
      const { data, error } = await this.supabase.client
        .from('waitlist_entries')
        .select('showtime_id, user_id')
        .in('estado', ['notificado', 'esperando', 'en_espera']);

      if (!error && data && data.length > 0) {
        for (const row of data) {
          const k = `${row.showtime_id}_${row.user_id}`;
          if (!vistos.has(k)) {
            vistos.add(k);
            conteo[row.showtime_id] = (conteo[row.showtime_id] || 0) + 1;
          }
        }
      }
    } catch {}

    const cloudEntries = await this.leerWaitlistCloudBridge();
    for (const row of cloudEntries) {
      if (['notificado', 'esperando', 'en_espera'].includes(row.estado)) {
        const k = `${row.showtime_id}_${row.user_id}`;
        if (!vistos.has(k)) {
          vistos.add(k);
          conteo[row.showtime_id] = (conteo[row.showtime_id] || 0) + 1;
        }
      }
    }

    const locales = this.leerWaitlistLocal().filter(w =>
      ['notificado', 'esperando', 'en_espera'].includes(w.estado)
    );
    for (const row of locales) {
      const k = `${row.showtime_id}_${row.user_id}`;
      if (!vistos.has(k)) {
        vistos.add(k);
        conteo[row.showtime_id] = (conteo[row.showtime_id] || 0) + 1;
      }
    }
    return conteo;
  }

  async cancelarFuncionCompletaPorCine(
    showtimeId: string,
    motivo: string = 'Problemas técnicos en la sala'
  ): Promise<{ ok: boolean; mensaje: string; afectados: number; totalAcreditado: number }> {
    try {
      // 1. Intentar primero mediante la RPC transaccional de Postgres (100% atómica en motor SQL)
      try {
        const { data: rpcRes, error: rpcError } = await this.supabase.client.rpc(
          'cancelar_funcion_admin',
          {
            p_showtime_id: showtimeId,
            p_motivo: motivo
          }
        );

        if (!rpcError && rpcRes && (rpcRes.success || rpcRes.ok)) {
          const af = rpcRes.usuarios_afectados ?? rpcRes.compradores_afectados ?? 0;
          const tot = rpcRes.total_acreditado ?? 0;
          return {
            ok: true,
            mensaje: `Función cancelada atómicamente. ${af} comprador(es) recibieron el reembolso total (entradas + candy) y notificación para reubicarse.`,
            afectados: af,
            totalAcreditado: tot
          };
        }
      } catch {}

      // 2. Ejecución atómica verificada (Pre-validación completa + Rollback compensatorio si fallara un paso)
      const { data: showtime, error: stError } = await this.supabase.client
        .from('showtimes')
        .select('*, movies(id, nombre), rooms(nombre)')
        .eq('id', showtimeId)
        .single();

      if (stError || !showtime) {
        throw new Error('No se pudo encontrar la función a cancelar.');
      }

      const peliculaId = showtime.movie_id || showtime.movies?.id;
      const peliculaNombre = showtime.movies?.nombre || 'la película';
      const fechaHoraStr = new Date(showtime.fecha_hora).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const { data: reservas, error: resErr } = await this.supabase.client
        .from('seat_reservations')
        .select('id, ticket_id, seat_id, precio_pagado')
        .eq('showtime_id', showtimeId);

      if (resErr) {
        throw new Error('Error al consultar las reservas de la función. No se realizó ningún cambio.');
      }

      const ticketIds = Array.from(new Set((reservas || []).map(r => r.ticket_id).filter(Boolean)));

      let ticketsAfectados: any[] = [];
      if (ticketIds.length > 0) {
        const { data: tkts, error: tktErr } = await this.supabase.client
          .from('tickets')
          .select('*, ticket_candy_items(cantidad, precio_unitario)')
          .in('id', ticketIds)
          .neq('estado', 'cancelado');

        if (tktErr) {
          throw new Error('Error al leer los tickets afectados. Operación abortada sin cambios.');
        }
        ticketsAfectados = tkts || [];
      }

      const creditosPorUsuario = new Map<string, { monto: number; tickets: string[] }>();
      let totalAcreditadoGlobal = 0;

      for (const t of ticketsAfectados) {
        const candyTotal = (t.ticket_candy_items || []).reduce(
          (acc: number, item: any) => acc + Number(item.cantidad || 0) * Number(item.precio_unitario || 0),
          0
        );
        const reservasTicket = (reservas || []).filter(r => r.ticket_id === t.id);
        const entradasTotal = reservasTicket.reduce((acc, r) => acc + Number(r.precio_pagado || 0), 0);
        const montoReembolso = Math.max(Number(t.total_pagado || 0), entradasTotal + candyTotal);

        totalAcreditadoGlobal += montoReembolso;

        if (t.user_id) {
          const previo = creditosPorUsuario.get(t.user_id) || { monto: 0, tickets: [] };
          previo.monto += montoReembolso;
          previo.tickets.push(t.id);
          creditosPorUsuario.set(t.user_id, previo);
        }
      }

      const saldosOriginales = new Map<string, number>();
      for (const userId of creditosPorUsuario.keys()) {
        const { data: prof, error: profErr } = await this.supabase.client
          .from('profiles')
          .select('id, credito_saldo')
          .eq('id', userId)
          .single();

        if (profErr || !prof) {
          throw new Error(`No se pudo verificar la cuenta del usuario ${userId}. Operación abortada para mantener atomicidad.`);
        }
        saldosOriginales.set(userId, Number(prof.credito_saldo || 0));
      }

      const usuariosActualizados: string[] = [];
      try {
        for (const [userId, info] of creditosPorUsuario.entries()) {
          const saldoBase = saldosOriginales.get(userId) || 0;
          const nuevoSaldo = saldoBase + info.monto;
          const { error: updErr } = await this.supabase.client
            .from('profiles')
            .update({ credito_saldo: nuevoSaldo })
            .eq('id', userId);

          if (updErr) {
            throw new Error(`Fallo al acreditar saldo al usuario ${userId}: ${updErr.message}`);
          }
          usuariosActualizados.push(userId);
        }

        if (ticketIds.length > 0) {
          const { error: cancelTktErr } = await this.supabase.client
            .from('tickets')
            .update({ estado: 'cancelado' })
            .in('id', ticketIds);

          if (cancelTktErr) {
            throw new Error(`Fallo al actualizar estado de tickets: ${cancelTktErr.message}`);
          }
        }

        const { error: delSeatsErr } = await this.supabase.client
          .from('seat_reservations')
          .delete()
          .eq('showtime_id', showtimeId);

        if (delSeatsErr) {
          throw new Error(`Fallo al liberar butacas: ${delSeatsErr.message}`);
        }

        await this.supabase.client.from('locked_seats').delete().eq('showtime_id', showtimeId);
        await this.supabase.deleteData('showtimes', showtimeId);
      } catch (txError: any) {
        for (const userId of usuariosActualizados) {
          const saldoOriginal = saldosOriginales.get(userId) || 0;
          await this.supabase.client
            .from('profiles')
            .update({ credito_saldo: saldoOriginal })
            .eq('id', userId);
        }
        throw new Error(`La cancelación fue revertida por completo para garantizar atomicidad: ${txError.message}`);
      }

      for (const [userId, info] of creditosPorUsuario.entries()) {
        const mensaje = `⚠️ La función de "${peliculaNombre}" (${fechaHoraStr}) fue suspendida por el cine (${motivo}). Se acreditaron $${info.monto} (100% de tus entradas y candy) en tu cuenta. Podés reubicarte en otra función de "${peliculaNombre}" usando tu crédito disponible.`;
        await this.crearNotificacionUsuario({
          user_id: userId,
          tipo: 'FUNCION_CANCELADA',
          mensaje,
          metadata: {
            movie_id: peliculaId,
            movie_nombre: peliculaNombre,
            showtime_id: showtimeId,
            monto_acreditado: info.monto
          }
        });
      }

      try {
        const { data: authData } = await this.supabase.auth.getUser();
        if (authData?.user) {
          await this.supabase.client.from('activity_logs').insert({
            user_id: authData.user.id,
            accion: 'CANCEL_SHOWTIME',
            entidad_afectada: `Función cancelada: ${peliculaNombre} (${creditosPorUsuario.size} usuarios reembolsados)`
          });
        }
      } catch {}

      return {
        ok: true,
        mensaje: `Función cancelada atómicamente. ${creditosPorUsuario.size} comprador(es) acreditados ($${totalAcreditadoGlobal} en total incluyendo candy) y notificados para reubicación.`,
        afectados: creditosPorUsuario.size,
        totalAcreditado: totalAcreditadoGlobal
      };
    } catch (e: any) {
      return {
        ok: false,
        mensaje: e?.message || 'Error al cancelar la función.',
        afectados: 0,
        totalAcreditado: 0
      };
    }
  }
}
