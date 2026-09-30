export interface Combo {
  id?: string;
  nombre: string;
  precio: number;
  descripcion?: string;
  categoria?: string;
  costo_puntos?: number;
  imagen_url?: string;
  productos_incluidos?: any[];
}
