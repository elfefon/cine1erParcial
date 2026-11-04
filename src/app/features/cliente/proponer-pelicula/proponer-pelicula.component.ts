import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { PropuestasService } from '../../../core/services/propuestas.service';
import { ToastService } from '../../../core/services/toast';
import { PropuestaPelicula } from '../../../models/propuesta.interface';

@Component({
  selector: 'app-proponer-pelicula',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './proponer-pelicula.component.html',
  styleUrl: './proponer-pelicula.component.css'
})
export class ProponerPeliculaComponent implements OnInit {
  private fb = inject(FormBuilder);
  authService = inject(AuthService);
  private propuestasService = inject(PropuestasService);
  private toast = inject(ToastService);

  loading = signal<boolean>(true);
  enviando = signal<boolean>(false);
  propuestaPendiente = signal<PropuestaPelicula | null>(null);
  historialPropuestas = signal<PropuestaPelicula[]>([]);

  propuestaForm = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(600)]],
    motivo: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(600)]]
  });

  async ngOnInit() {
    await this.cargarEstadoPropuestas();
  }

  async cargarEstadoPropuestas() {
    const user = this.authService.usuarioActual();
    if (!user) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    try {
      const todas = await this.propuestasService.obtenerPropuestasPorUsuario(user.id);
      const activa = todas.find(p => p.estado === 'pendiente') || null;
      this.propuestaPendiente.set(activa);
      this.historialPropuestas.set(todas.filter(p => p.estado !== 'pendiente'));
    } catch (e) {
      console.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  async enviarPropuesta() {
    if (this.propuestaForm.invalid) {
      this.propuestaForm.markAllAsTouched();
      return;
    }

    const user = this.authService.usuarioActual();
    if (!user) {
      this.toast.error('Debés iniciar sesión para enviar una propuesta.');
      return;
    }

    this.enviando.set(true);
    try {
      const raw = this.propuestaForm.getRawValue();
      const creada = await this.propuestasService.enviarPropuesta({
        user_id: user.id,
        usuario_nombre: user.nombre,
        titulo: raw.titulo,
        descripcion: raw.descripcion,
        motivo: raw.motivo
      });

      this.propuestaPendiente.set(creada);
      this.propuestaForm.reset();
      this.toast.success('¡Tu propuesta fue enviada a la administración del cine!');
    } catch (e: any) {
      this.toast.error(e.message || 'No se pudo enviar la propuesta.');
    } finally {
      this.enviando.set(false);
    }
  }
}
