export interface PropuestaPelicula {
  id?: string;
  user_id: string;
  titulo: string;
  descripcion: string;
  motivo: string;
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  created_at?: string;
  profiles?: {
    nombre?: string;
    email?: string;
  };
}
