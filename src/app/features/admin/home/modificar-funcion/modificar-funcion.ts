import { Component, Input, Output, EventEmitter, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { WaitlistService } from '../../../../core/services/waitlist.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  imports: [CommonModule, ReactiveFormsModule],
  selector: 'app-modificar-funcion',
  styleUrl: './modificar-funcion.css',
  templateUrl: './modificar-funcion.html',
  standalone: true
})
export class ModificarFuncion implements OnInit {
  @Input() funcion: any;
  @Input() peliculas: any[] = [];
  @Input() salas: any[] = [];
  // Para las colisiones necesitamos saber las funciones existentes
  @Input() funciones: any[] = [];
  
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private waitlistService = inject(WaitlistService);
  private toastService = inject(ToastService);

  funcionForm = this.fb.nonNullable.group({
    pelicula_id: ['', Validators.required],
    horario: ['', Validators.required],
    sala_id: ['', Validators.required],
    idioma: ['', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    formato: [{value: '', disabled: true}]
  });

  entradasVendidas = 0;
  personasEnEspera = signal(0);
  cancelandoFuncion = signal(false);

  getNombrePelicula(id: string | null | undefined): string {
    if (!id) return '';
    return this.peliculas.find(p => p.id === id)?.nombre || '';
  }

  onSeleccionarPeliculaList(event: Event) {
    const target = event.target as HTMLInputElement;
    const nombre = target.value;
    const p = this.peliculas.find(x => x.nombre === nombre);
    if (p) {
      this.funcionForm.patchValue({ pelicula_id: p.id });
    } else {
      this.funcionForm.patchValue({ pelicula_id: '' });
    }
  }

  async ngOnInit() {
    if (this.funcion) {
      // Formatear fecha para el input datetime-local: YYYY-MM-DDThh:mm
      const rawDate = this.funcion.fecha_hora;
      let dateString = rawDate;
      if (rawDate) {
        const d = new Date(rawDate);
        dateString = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      }

      this.funcionForm.patchValue({
        pelicula_id: this.funcion.movie_id,
        horario: dateString,
        sala_id: this.funcion.room_id,
        idioma: this.funcion.idioma,
        precio: this.funcion.precio_base,
        formato: this.funcion.formato || '2D'
      });

      const conteos = await this.waitlistService.obtenerConteoEsperaPorFunciones([this.funcion.id]);
      this.personasEnEspera.set(conteos[this.funcion.id] || 0);
    }

    this.verificarEntradasVendidas();

    this.funcionForm.get('sala_id')?.valueChanges.subscribe(salaId => {
      const sala = this.salas.find(s => s.id === salaId);
      if (sala) {
        this.funcionForm.patchValue({ formato: sala.dimension || '2D' });
      }
    });
  }

  async verificarEntradasVendidas() {
    const { data } = await this.supabase.client.from('seat_reservations').select('id').eq('showtime_id', this.funcion.id);
    if (data && data.length > 0) {
      this.entradasVendidas = data.length;
      // Bloquear todo excepto el precio si ya hay ventas
      this.funcionForm.get('pelicula_id')?.disable();
      this.funcionForm.get('horario')?.disable();
      this.funcionForm.get('sala_id')?.disable();
      this.funcionForm.get('idioma')?.disable();
    }
  }

  async onSubmit() {
    if (this.funcionForm.valid) {
      const formValue = this.funcionForm.getRawValue();
      const pelicula = this.peliculas.find(p => p.id === formValue.pelicula_id);

      // Si no hay ventas, validamos fechas y colisiones
      if (this.entradasVendidas === 0) {
        const inicio = new Date(formValue.horario).getTime();
        const hoyMs = new Date().getTime();

        if (inicio < hoyMs) {
          alert('Error: La fecha de la función no puede ser en el pasado.');
          return;
        }

        let fechaBaseMs = hoyMs;
        if (pelicula?.fecha_estreno) {
          const estrenoMs = new Date(pelicula.fecha_estreno).getTime();
          if (estrenoMs > hoyMs) {
            fechaBaseMs = estrenoMs;
            if (inicio < estrenoMs) {
              alert('Error: La función no puede programarse para ANTES de la fecha de estreno (Pre-venta).');
              return;
            }
          }
        }
        
        const maxMs = fechaBaseMs + (7 * 24 * 60 * 60 * 1000);
        if (inicio > maxMs) { 
          alert('Error: La función solo puede programarse como máximo hasta 1 semana (desde hoy o desde su estreno).'); 
          return; 
        }

        // Colisiones
        const fin = inicio + ((pelicula?.duracion_min || 120) * 60000);
        const enSala = (this.funciones || []).filter(x => x.room_id === formValue.sala_id && x.id !== this.funcion.id);
        
        for (const ex of enSala) {
          const exIni = new Date(ex.fecha_hora).getTime();
          const exFin = exIni + ((ex.movies?.duracion_min || 120) * 60000);
          if (inicio < (exFin + 1800000) && exIni < (fin + 1800000)) {
            alert('Error: Choca con otra función o no respeta los 30 min de limpieza en la misma sala.'); 
            return;
          }
        }
      }

      const updateData = {
        movie_id: formValue.pelicula_id,
        room_id: formValue.sala_id,
        fecha_hora: formValue.horario,
        idioma: formValue.idioma,
        precio_base: formValue.precio,
        formato: formValue.formato
      };

      try {
        await this.supabase.updateData('showtimes', this.funcion.id, updateData);
        this.saved.emit();
      } catch (err) {
        console.error(err);
        alert('Error al modificar la función');
      }
    }
  }

  async onEliminar() {
    if (this.entradasVendidas > 0) {
      await this.onCancelarFuncionPorCine();
      return;
    }
    const confirmacion = confirm('¿Estás seguro que deseas eliminar esta función de forma permanente?');
    if (confirmacion) {
      try {
        await this.supabase.deleteData('showtimes', this.funcion.id);
        this.saved.emit();
      } catch (err) {
        console.error(err);
        alert('Error al eliminar la función. Puede que tenga tickets asociados.');
      }
    }
  }

  async onCancelarFuncionPorCine() {
    const motivo = prompt(
      `⚠️ CANCELACIÓN ATÓMICA DE FUNCIÓN POR EL CINE\n\n` +
      `Butacas vendidas: ${this.entradasVendidas} | Personas en lista de espera: ${this.personasEnEspera()}\n` +
      `Se acreditará de forma atómica el monto total (entradas + candy) en la cuenta de todos los compradores, se liberarán las butacas y se notificará a cada usuario para reubicarse en otra función.\n\n` +
      `Ingresá el motivo de la suspensión:`,
      'Problema técnico en la sala'
    );
    if (motivo === null) return;

    this.cancelandoFuncion.set(true);
    try {
      const res = await this.waitlistService.cancelarFuncionCompletaPorCine(
        this.funcion.id,
        motivo.trim() || 'Problema técnico en la sala'
      );
      if (res.ok) {
        this.toastService.success(res.mensaje);
        this.saved.emit();
      } else {
        this.toastService.error(res.mensaje);
      }
    } finally {
      this.cancelandoFuncion.set(false);
    }
  }

  onCancel() {
    this.close.emit();
  }
}
