export interface Usuario {
  id: string;
  email: string;
  rol: 'admin' | 'cliente' | 'gerente' | 'empleado';
  nombre: string;
}
