export type RolBase = 'admin' | 'cliente' | 'gerente' | 'empleado';

export interface Usuario {
  id: string;
  email: string;
  role: RolBase | string;
  nombre: string;
  puntos?: number;
  credito_saldo?: number;
  fecha_nacimiento?: string;
  permisos?: string[];
}
