export interface Accion {
  id?: string;
  user_id: string;
  accion: string;
  entidad_afectada: string;
  fecha_hora?: string;
  created_at?: string;
  profiles?: {
    nombre: string;
    role?: string;
    rol?: string;
  };
}
