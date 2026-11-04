export interface WaitlistEntry {
  id?: string;
  showtime_id: string;
  user_id: string;
  estado: 'esperando' | 'en_espera' | 'notificado' | 'comprado' | 'expirado' | 'cancelado';
  notificado_at?: string | null;
  expira_at?: string | null;
  created_at?: string;
  posicion?: number;
  minutos_restantes?: number;
  showtimes?: {
    id: string;
    movie_id: string;
    room_id: string;
    fecha_hora: string;
    idioma?: string;
    formato?: string;
    movies?: {
      id: string;
      nombre: string;
      imagen_url?: string;
    };
    rooms?: {
      nombre: string;
    };
  };
  profiles?: {
    nombre?: string;
    email?: string;
  };
}
