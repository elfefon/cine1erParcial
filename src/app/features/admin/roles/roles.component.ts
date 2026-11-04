import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RolesService } from '../../../core/services/roles.service';
import { ToastService } from '../../../core/services/toast.service';
import { RolConfig, SECCIONES_ADMIN_CATALOGO, SeccionAdmin } from '../../../models/rol.interface';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.css'
})
export class RolesComponent implements OnInit {
  rolesService = inject(RolesService);
  private toastService = inject(ToastService);

  seccionesCatalogo = SECCIONES_ADMIN_CATALOGO;

  // Formulario de Rol
  editandoId = signal<string | null>(null);
  nombreRol = signal('');
  descripcionRol = signal('');
  permisosSeleccionados = signal<SeccionAdmin[]>(['reportes']);
  guardandoRol = signal(false);

  // Gestión de usuarios y asignación de roles
  usuarios = signal<any[]>([]);
  cargandoUsuarios = signal(false);
  filtroUsuario = signal('');
  rolesPorUsuario = signal<Record<string, string>>({});
  asignandoUserId = signal<string | null>(null);

  usuariosFiltrados = computed(() => {
    const q = this.filtroUsuario().trim().toLowerCase();
    const lista = this.usuarios();
    if (!q) return lista;
    return lista.filter(u =>
      (u.nombre || '').toLowerCase().includes(q) ||
      (u.apellido || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  async ngOnInit() {
    await this.rolesService.cargarRolesDesdeDB();
    await this.cargarUsuarios();
  }

  async cargarUsuarios() {
    this.cargandoUsuarios.set(true);
    try {
      const data = await this.rolesService.obtenerUsuarios();
      this.usuarios.set(data);
      const mapa: Record<string, string> = {};
      for (const u of data) {
        mapa[u.id] = u.role || 'cliente';
      }
      this.rolesPorUsuario.set(mapa);
    } finally {
      this.cargandoUsuarios.set(false);
    }
  }

  tienePermisoSeleccionado(seccion: SeccionAdmin): boolean {
    return this.permisosSeleccionados().includes(seccion);
  }

  togglePermiso(seccion: SeccionAdmin) {
    this.permisosSeleccionados.update(actuales => {
      if (actuales.includes(seccion)) {
        return actuales.filter(s => s !== seccion);
      }
      return [...actuales, seccion];
    });
  }

  aplicarPlantillaSoloReportes() {
    this.nombreRol.set('analista_reportes');
    this.descripcionRol.set('Acceso exclusivo a la sección de Reportes y métricas del cine');
    this.permisosSeleccionados.set(['reportes']);
  }

  editarRol(rol: RolConfig) {
    if (rol.es_sistema) {
      this.toastService.warning('Los roles base del sistema no se pueden modificar, pero podés crear roles personalizados.');
      return;
    }
    this.editandoId.set(rol.id || null);
    this.nombreRol.set(rol.nombre);
    this.descripcionRol.set(rol.descripcion);
    this.permisosSeleccionados.set([...rol.permisos]);
  }

  cancelarEdicion() {
    this.editandoId.set(null);
    this.nombreRol.set('');
    this.descripcionRol.set('');
    this.permisosSeleccionados.set(['reportes']);
  }

  async guardarRol() {
    if (!this.nombreRol().trim()) {
      this.toastService.warning('Ingresá un nombre para el rol.');
      return;
    }
    if (this.permisosSeleccionados().length === 0) {
      this.toastService.warning('Seleccioná al menos una sección del panel de administración para este rol.');
      return;
    }

    this.guardandoRol.set(true);
    try {
      const res = await this.rolesService.guardarRol({
        id: this.editandoId() || undefined,
        nombre: this.nombreRol(),
        descripcion: this.descripcionRol() || 'Rol personalizado de administración',
        permisos: this.permisosSeleccionados()
      });

      if (res.ok) {
        this.toastService.success(res.mensaje);
        this.cancelarEdicion();
      } else {
        this.toastService.error(res.mensaje);
      }
    } finally {
      this.guardandoRol.set(false);
    }
  }

  async eliminarRol(rol: RolConfig) {
    if (rol.es_sistema) return;
    if (!confirm(`¿Seguro que querés eliminar el rol "${rol.nombre}"?`)) return;

    const res = await this.rolesService.eliminarRol(rol.nombre);
    if (res.ok) {
      this.toastService.success(res.mensaje);
    } else {
      this.toastService.error(res.mensaje);
    }
  }

  onCambioRolSelect(userId: string, event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    this.rolesPorUsuario.update(m => ({ ...m, [userId]: val }));
  }

  async asignarRol(usuario: any) {
    const nuevoRol = this.rolesPorUsuario()[usuario.id] || usuario.role;
    this.asignandoUserId.set(usuario.id);
    try {
      const res = await this.rolesService.asignarRolAUsuario(usuario.id, nuevoRol);
      if (res.ok) {
        this.toastService.success(`${res.mensaje} (${usuario.nombre} ${usuario.apellido} → ${nuevoRol})`);
        this.usuarios.update(lista =>
          lista.map(u => (u.id === usuario.id ? { ...u, role: nuevoRol } : u))
        );
      } else {
        this.toastService.error(res.mensaje);
      }
    } finally {
      this.asignandoUserId.set(null);
    }
  }

  obtenerEtiquetaSeccion(id: SeccionAdmin): string {
    const sec = this.seccionesCatalogo.find(s => s.id === id);
    return sec ? `${sec.icono} ${sec.label}` : id;
  }
}
