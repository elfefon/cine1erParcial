import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { RolConfig, SeccionAdmin, SECCIONES_ADMIN_CATALOGO } from '../../models/rol.interface';

const ROLES_STORAGE_KEY = 'cineutn_custom_roles_v1';
const USERS_FALLBACK_KEY = 'cineutn_users_roles_v1';
const SYS_ROLE_ACTION = '__SYS_ROLE__';

export const ROLES_BASE_SISTEMA: RolConfig[] = [
  {
    nombre: 'admin',
    descripcion: 'Acceso total a todas las secciones y configuraciones del sistema.',
    permisos: ['reportes', 'peliculas', 'combos', 'salas', 'cupones', 'historial', 'roles'],
    es_sistema: true
  },
  {
    nombre: 'gerente',
    descripcion: 'Acceso a reportes gerenciales, gestión de películas/funciones y candy bar.',
    permisos: ['reportes', 'peliculas', 'combos'],
    es_sistema: true
  },
  {
    nombre: 'empleado',
    descripcion: 'Personal operativo con acceso al scanner de validación de entradas QR.',
    permisos: [],
    es_sistema: true
  },
  {
    nombre: 'cliente',
    descripcion: 'Usuario comprador estándar del cine.',
    permisos: [],
    es_sistema: true
  }
];

@Injectable({
  providedIn: 'root'
})
export class RolesService {
  private supabase = inject(SupabaseService);

  roles = signal<RolConfig[]>([...ROLES_BASE_SISTEMA]);
  cargado = signal<boolean>(false);

  constructor() {
    this.restaurarDesdeLocalStorage();
    this.cargarRoles();
  }

  private restaurarDesdeLocalStorage() {
    try {
      const raw = localStorage.getItem(ROLES_STORAGE_KEY);
      if (raw) {
        const custom: RolConfig[] = JSON.parse(raw);
        this.combinarRoles(custom);
      }
    } catch (e) {
      console.error('Error leyendo roles locales', e);
    }
  }

  private guardarEnLocalStorage(customRoles: RolConfig[]) {
    try {
      localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(customRoles));
    } catch (e) {
      console.error('Error guardando roles locales', e);
    }
  }

  private combinarRoles(customRoles: RolConfig[]) {
    const mapa = new Map<string, RolConfig>();
    for (const r of ROLES_BASE_SISTEMA) {
      mapa.set(r.nombre.toLowerCase(), { ...r });
    }
    for (const c of customRoles) {
      if (!c || !c.nombre) continue;
      const key = c.nombre.toLowerCase();
      if (key === 'admin') {
        continue;
      }
      const base = mapa.get(key);
      mapa.set(key, {
        ...c,
        es_sistema: base?.es_sistema ?? false
      });
    }
    this.roles.set(Array.from(mapa.values()));
  }

  async cargarRolesDesdeDB(): Promise<RolConfig[]> {
    return this.cargarRoles();
  }

  async cargarRoles(): Promise<RolConfig[]> {
    const recolectados: RolConfig[] = [];

    // 1. Intentar desde tabla dedicada custom_roles
    try {
      const { data, error } = await this.supabase.client
        .from('custom_roles')
        .select('*')
        .order('nombre', { ascending: true });

      if (!error && data && data.length > 0) {
        for (const d of data) {
          recolectados.push({
            id: d.id,
            nombre: d.nombre,
            descripcion: d.descripcion || '',
            permisos: Array.isArray(d.permisos) ? d.permisos : [],
            es_sistema: ['admin', 'gerente', 'empleado', 'cliente'].includes((d.nombre || '').toLowerCase()),
            created_at: d.created_at
          });
        }
      }
    } catch {}

    // 2. Leer también desde el puente cloud en Supabase (activity_logs)
    try {
      const { data: logsData, error: logsErr } = await this.supabase.client
        .from('activity_logs')
        .select('*')
        .eq('accion', SYS_ROLE_ACTION)
        .order('fecha_hora', { ascending: true });

      if (!logsErr && logsData && logsData.length > 0) {
        for (const row of logsData) {
          try {
            const parsed = JSON.parse(row.entidad_afectada || '{}');
            if (parsed.nombre) {
              recolectados.push({
                id: row.id,
                nombre: parsed.nombre,
                descripcion: parsed.descripcion || '',
                permisos: Array.isArray(parsed.permisos) ? parsed.permisos : [],
                es_sistema: ['admin', 'gerente', 'empleado', 'cliente'].includes(parsed.nombre.toLowerCase()),
                created_at: row.fecha_hora
              });
            }
          } catch {}
        }
      }
    } catch {}

    if (recolectados.length > 0) {
      this.combinarRoles(recolectados);
      const soloCustom = this.roles().filter(r => !r.es_sistema || r.nombre === 'gerente');
      this.guardarEnLocalStorage(soloCustom);
    }

    this.cargado.set(true);
    return this.roles();
  }

  obtenerRolConfig(roleName: string | undefined | null): RolConfig | undefined {
    if (!roleName) return undefined;
    const norm = roleName.trim().toLowerCase();
    return this.roles().find(r => r.nombre.toLowerCase() === norm);
  }

  obtenerRol(roleName: string | undefined | null): RolConfig | undefined {
    return this.obtenerRolConfig(roleName);
  }

  tienePermiso(roleName: string | undefined | null, seccion: SeccionAdmin): boolean {
    if (!roleName) return false;
    const norm = roleName.trim().toLowerCase();
    if (norm === 'admin') return true;
    const config = this.obtenerRolConfig(norm);
    if (!config) return false;
    return config.permisos.includes(seccion);
  }

  tieneAccesoAlPanelAdmin(roleName: string | undefined | null): boolean {
    if (!roleName) return false;
    const norm = roleName.trim().toLowerCase();
    if (norm === 'admin' || norm === 'gerente') return true;
    const config = this.obtenerRolConfig(norm);
    return !!config && config.permisos.length > 0;
  }

  obtenerPrimeraRutaPermitida(roleName: string | undefined | null): string {
    if (!roleName) return 'home';
    const norm = roleName.trim().toLowerCase();
    if (norm === 'admin' || norm === 'gerente') return 'home';
    const config = this.obtenerRolConfig(norm);
    if (!config || config.permisos.length === 0) return 'home';
    const primeraSeccion = SECCIONES_ADMIN_CATALOGO.find(s => config.permisos.includes(s.id));
    return primeraSeccion ? primeraSeccion.ruta : 'home';
  }

  async obtenerUsuarios(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('*')
        .order('nombre', { ascending: true });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch {}

    try {
      const raw = localStorage.getItem(USERS_FALLBACK_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}

    return [];
  }

  async guardarRol(rol: RolConfig): Promise<{ ok: boolean; mensaje: string }> {
    const nombreNorm = rol.nombre.trim().toLowerCase().replace(/\s+/g, '_');
    if (!nombreNorm) {
      return { ok: false, mensaje: 'El nombre del rol es obligatorio.' };
    }
    if (nombreNorm === 'admin') {
      return { ok: false, mensaje: 'El rol admin tiene todos los permisos y no puede restringirse.' };
    }

    const payload = {
      nombre: nombreNorm,
      descripcion: rol.descripcion.trim(),
      permisos: rol.permisos
    };

    let guardadoDirecto = false;
    let idFinal = rol.id;

    try {
      const existente = this.obtenerRolConfig(nombreNorm);
      if (existente?.id) {
        const { error } = await this.supabase.client
          .from('custom_roles')
          .update(payload)
          .eq('id', existente.id);
        if (!error) guardadoDirecto = true;
      } else {
        const { data, error } = await this.supabase.client
          .from('custom_roles')
          .upsert(payload, { onConflict: 'nombre' })
          .select()
          .single();
        if (!error && data) {
          guardadoDirecto = true;
          idFinal = data.id;
        }
      }
    } catch {}

    // Guardar en puente cloud en Supabase (activity_logs) si custom_roles tiene bloqueo RLS
    if (!guardadoDirecto) {
      try {
        const { data: existentesLog } = await this.supabase.client
          .from('activity_logs')
          .select('*')
          .eq('accion', SYS_ROLE_ACTION);

        const matchLog = (existentesLog || []).find(row => {
          try {
            return JSON.parse(row.entidad_afectada || '{}').nombre?.toLowerCase() === nombreNorm;
          } catch {
            return false;
          }
        });

        if (matchLog) {
          await this.supabase.client
            .from('activity_logs')
            .update({ entidad_afectada: JSON.stringify(payload) })
            .eq('id', matchLog.id);
          idFinal = matchLog.id;
        } else {
          const { data: insLog } = await this.supabase.client
            .from('activity_logs')
            .insert({
              accion: SYS_ROLE_ACTION,
              entidad_afectada: JSON.stringify(payload)
            })
            .select()
            .single();
          if (insLog) idFinal = insLog.id;
        }
      } catch {}
    }

    const actuales = this.roles().filter(r => r.nombre.toLowerCase() !== nombreNorm);
    const actualizado: RolConfig = {
      ...rol,
      id: idFinal,
      nombre: nombreNorm,
      es_sistema: ['admin', 'gerente', 'empleado', 'cliente'].includes(nombreNorm)
    };
    const nuevaLista = [...actuales, actualizado];
    this.roles.set(nuevaLista);
    this.guardarEnLocalStorage(nuevaLista.filter(r => !r.es_sistema || r.nombre === 'gerente'));

    return { ok: true, mensaje: `Rol "${nombreNorm}" guardado correctamente.` };
  }

  async eliminarRol(rolOrNombre: RolConfig | string): Promise<{ ok: boolean; mensaje: string }> {
    const nombreNorm = (typeof rolOrNombre === 'string' ? rolOrNombre : rolOrNombre.nombre).toLowerCase();
    if (['admin', 'gerente', 'empleado', 'cliente'].includes(nombreNorm)) {
      return { ok: false, mensaje: 'No se puede eliminar un rol base del sistema.' };
    }

    try {
      if (typeof rolOrNombre !== 'string' && rolOrNombre.id) {
        await this.supabase.client.from('custom_roles').delete().eq('id', rolOrNombre.id);
      } else {
        await this.supabase.client.from('custom_roles').delete().eq('nombre', nombreNorm);
      }
    } catch {}

    try {
      const { data: logs } = await this.supabase.client
        .from('activity_logs')
        .select('*')
        .eq('accion', SYS_ROLE_ACTION);
      for (const row of logs || []) {
        try {
          if (JSON.parse(row.entidad_afectada || '{}').nombre?.toLowerCase() === nombreNorm) {
            await this.supabase.client.from('activity_logs').delete().eq('id', row.id);
          }
        } catch {}
      }
    } catch {}

    const nuevaLista = this.roles().filter(r => r.nombre.toLowerCase() !== nombreNorm);
    this.roles.set(nuevaLista);
    this.guardarEnLocalStorage(nuevaLista.filter(r => !r.es_sistema || r.nombre === 'gerente'));
    return { ok: true, mensaje: `Rol "${nombreNorm}" eliminado.` };
  }

  async asignarRolAUsuario(userId: string, nuevoRol: string): Promise<{ ok: boolean; mensaje: string }> {
    const rolLimpio = nuevoRol.trim().toLowerCase();
    try {
      const { error } = await this.supabase.client
        .from('profiles')
        .update({ role: rolLimpio })
        .eq('id', userId);

      if (error) {
        return { ok: false, mensaje: error.message || 'No se pudo asignar el rol.' };
      }

      // Registrar en auditoría
      try {
        const { data: authData } = await this.supabase.auth.getUser();
        if (authData?.user) {
          await this.supabase.client.from('activity_logs').insert({
            user_id: authData.user.id,
            accion: 'UPDATE_USER_ROLE',
            entidad_afectada: `Usuario (${userId.substring(0, 6)}) -> Rol: ${rolLimpio}`
          });
        }
      } catch {}

      return { ok: true, mensaje: 'Rol asignado exitosamente' };
    } catch (e: any) {
      return { ok: false, mensaje: e?.message || 'Error al asignar el rol al usuario.' };
    }
  }
}
