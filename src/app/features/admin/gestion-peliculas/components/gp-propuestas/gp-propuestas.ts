import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { PropuestasService } from '../../../../../core/services/propuestas.service';
import { ToastService } from '../../../../../core/services/toast';
import { PropuestaPelicula } from '../../../../../models/propuesta.interface';

@Component({
  selector: 'app-gp-propuestas',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './gp-propuestas.html'
})
export class GpPropuestasComponent implements OnInit {
  private propuestasService = inject(PropuestasService);
  private router = inject(Router);
  private toast = inject(ToastService);

  propuestas = signal<PropuestaPelicula[]>([]);
  loading = signal<boolean>(true);
  filtroEstado = signal<'todas' | 'pendiente' | 'aceptada' | 'rechazada'>('pendiente');

  propuestasFiltradas = computed(() => {
    const estado = this.filtroEstado();
    const lista = this.propuestas();
    if (estado === 'todas') return lista;
    return lista.filter(p => p.estado === estado);
  });

  async ngOnInit() {
    await this.cargarPropuestas();
  }

  async cargarPropuestas() {
    this.loading.set(true);
    try {
      const data = await this.propuestasService.obtenerTodasLasPropuestas();
      this.propuestas.set(data);
    } finally {
      this.loading.set(false);
    }
  }

  async aceptarPropuesta(p: PropuestaPelicula) {
    try {
      await this.propuestasService.actualizarEstadoPropuesta(p, 'aceptada');
      this.toast.success(`Propuesta "${p.titulo}" aceptada. Redirigiendo a Crear Película...`);
      this.router.navigate(['/admin/peliculas/crear-pelicula'], {
        queryParams: {
          titulo: p.titulo,
          sinopsis: p.descripcion,
          motivo: p.motivo,
          propuestaId: p.id
        }
      });
    } catch (e: any) {
      this.toast.error(e.message || 'Error al aceptar la propuesta');
    }
  }

  async rechazarPropuesta(p: PropuestaPelicula) {
    if (!confirm(`¿Seguro que querés rechazar la propuesta "${p.titulo}"?`)) return;
    try {
      await this.propuestasService.actualizarEstadoPropuesta(p, 'rechazada');
      this.toast.info(`Propuesta "${p.titulo}" rechazada.`);
      await this.cargarPropuestas();
    } catch (e: any) {
      this.toast.error(e.message || 'Error al rechazar la propuesta');
    }
  }
}
