export interface Usuario {
  id: string;
  email: string;
  rol: 'admin' | 'cliente' | 'gerente' | 'empleado';
  nombre: string;
  puntos?: number;
  credito_saldo?: number;
  fecha_nacimiento?: string;
}
