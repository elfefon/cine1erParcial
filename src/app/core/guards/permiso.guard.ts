import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RolesService } from '../services/roles.service';
import { SeccionAdmin } from '../../models/rol.interface';

export function permisoGuard(seccion: SeccionAdmin): CanMatchFn {
  return () => {
    const authService = inject(AuthService);
    const rolesService = inject(RolesService);
    const router = inject(Router);

    const user = authService.usuarioActual();
    if (!user) {
      return router.createUrlTree(['/login']);
    }

    if (rolesService.tienePermiso(user.role, seccion)) {
      return true;
    }

    const rutaAlternativa = rolesService.obtenerPrimeraRutaPermitida(user.role);
    if (rutaAlternativa && rutaAlternativa !== `/admin/${seccion}`) {
      return router.parseUrl(rutaAlternativa);
    }

    return router.createUrlTree(['/']);
  };
}
