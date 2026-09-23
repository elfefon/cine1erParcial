export interface Reserva {
  id?: string;
  usuario_id: string;
  pelicula_id: string;
  butacas: string[];
  combos: any[];
  total: number;
  fecha: string;
}
