export type SeccionAdmin =
  | 'reportes'
  | 'peliculas'
  | 'combos'
  | 'salas'
  | 'cupones'
  | 'historial'
  | 'roles';

export interface RolConfig {
  id?: string;
  nombre: string;
  descripcion: string;
  permisos: SeccionAdmin[];
  es_sistema?: boolean;
  created_at?: string;
}

export const SECCIONES_ADMIN_CATALOGO: { id: SeccionAdmin; label: string; icon: string; icono: string; ruta: string }[] = [
  { id: 'reportes', label: 'Reportes y Estadísticas (Home)', icon: '📊', icono: '📊', ruta: 'home' },
  { id: 'peliculas', label: 'Películas, Funciones y Propuestas', icon: '🎬', icono: '🎬', ruta: 'peliculas' },
  { id: 'combos', label: 'Candy Bar y Combos', icon: '🍿', icono: '🍿', ruta: 'combos' },
  { id: 'salas', label: 'Salas de Cine', icon: '🪑', icono: '🪑', ruta: 'salas' },
  { id: 'cupones', label: 'Cupones de Descuento', icon: '🎟️', icono: '🎟️', ruta: 'cupones' },
  { id: 'historial', label: 'Historial de Auditoría', icon: '📋', icono: '📋', ruta: 'historial' },
  { id: 'roles', label: 'Gestión de Roles y Permisos', icon: '🔐', icono: '🔐', ruta: 'roles' }
];
