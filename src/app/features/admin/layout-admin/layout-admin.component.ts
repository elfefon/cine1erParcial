import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { RolesService } from '../../../core/services/roles.service';
import { PropuestasService } from '../../../core/services/propuestas.service';
import { SeccionAdmin } from '../../../models/rol.interface';

@Component({
  selector: 'app-layout-admin',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout-admin.component.html',
  styleUrl: './layout-admin.component.css'
})
export class LayoutAdminComponent implements OnInit {
  authService = inject(AuthService);
  rolesService = inject(RolesService);
  propuestasService = inject(PropuestasService);
  private router = inject(Router);
  
  isSidebarOpen = signal(false);

  propuestasPendientesCount = computed(() =>
    this.propuestasService.propuestas().filter(p => p.estado === 'pendiente').length
  );

  async ngOnInit() {
    await this.rolesService.cargarRolesDesdeDB();
    await this.propuestasService.obtenerTodasLasPropuestas();
  }

  tieneAccesoSeccion(seccion: SeccionAdmin): boolean {
    const rol = this.authService.usuarioActual()?.role;
    return this.rolesService.tienePermiso(rol, seccion);
  }

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }

  async logout() {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }
}
