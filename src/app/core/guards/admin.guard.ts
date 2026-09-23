import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanMatchFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const user = authService.usuarioActual();
  if (user && user.rol === 'admin') {
    return true;
  }
  
  return router.createUrlTree(['/']);
};
