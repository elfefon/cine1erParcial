export interface Accion {
  id?: string;
  user_id: string;
  accion: string;
  entidad_afectada: string;
  fecha_hora: string;
  profiles?: {
    email: string;
    nombre: string;
  };
}
