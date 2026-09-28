export interface Pelicula {
  id?: string;
  nombre: string;
  sinopsis: string;
  imagen_url: string;
  activa?: boolean;
  duracion_min?: number;
  restriccion_edad?: number;
  generos?: string[];
  fecha_estreno?: string;
}
