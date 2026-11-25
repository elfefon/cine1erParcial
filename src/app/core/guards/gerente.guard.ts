import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RolesService } from '../services/roles.service';

export const gerenteGuard: CanMatchFn = async () => {
  const authService = inject(AuthService);
  const rolesService = inject(RolesService);
  const router = inject(Router);

  const user = await authService.ensureSessionLoaded();
  if (!rolesService.cargado()) {
    await rolesService.cargarRoles();
  }

  if (user && rolesService.tieneAccesoAlPanelAdmin(user.role)) {
    return true;
  }

  return router.createUrlTree(['/']);
};
