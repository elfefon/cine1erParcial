import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../../core/services/supabase.service';
import { PeliculasStateService } from '../../services/peliculas-state.service';
import { Router } from '@angular/router';
import { BuscadorAutocompleteComponent } from '../../../../../shared/components/buscador-autocomplete/buscador-autocomplete.component';

@Component({
  selector: 'app-gp-crear-funcion',
  standalone: true,
  imports: [ReactiveFormsModule, BuscadorAutocompleteComponent],
  templateUrl: './gp-crear-funcion.html'
})
export class GpCrearFuncionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  state = inject(PeliculasStateService);
  private router = inject(Router);

  funcionForm = this.fb.nonNullable.group({
    pelicula_id: ['', Validators.required],
    horario: ['', Validators.required],
    sala_id: ['', Validators.required],
    idioma: ['', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    formato: [{ value: '', disabled: true }]
  });

  ngOnInit() {
    this.funcionForm.get('sala_id')?.valueChanges.subscribe(sId => {
      const s = this.state.salas().find(x => x.id === sId);
      if (s) this.funcionForm.patchValue({ formato: s.dimension || '2D' });
    });
  }

  onPelicula(id: string) { this.funcionForm.patchValue({ pelicula_id: id }); }

  async onSubmit() {
    if (this.funcionForm.valid) {
      const f = this.funcionForm.getRawValue();
      const pelicula = this.state.peliculas().find(p => p.id === f.pelicula_id);
      
      const inicio = new Date(f.horario).getTime();
      const hoyMs = new Date().getTime();

      // Regla 1: No viajar al pasado
      if (inicio < hoyMs) {
        alert('Error: La fecha de la función no puede ser en el pasado.');
        return;
      }

      // Regla 2: Tope máximo 1 semana (y mínimo si es pre-venta)
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
      
      const fin = inicio + ((pelicula?.duracion_min || 120) * 60000);
      const enSala = this.state.funciones().filter(x => x.room_id === f.sala_id);
      
      for (const ex of enSala) {
        const exIni = new Date(ex.fecha_hora).getTime();
        const exFin = exIni + ((ex.movies?.duracion_min || 120) * 60000);
        if (inicio < (exFin + 1800000) && exIni < (fin + 1800000)) {
          alert('Error: Choca con otra función o no respeta 30 min.'); return;
        }
      }
      
      await this.supabase.insertData('showtimes', {
        movie_id: f.pelicula_id, room_id: f.sala_id, fecha_hora: f.horario,
        idioma: f.idioma, precio_base: f.precio, formato: f.formato
      });
      await this.state.cargarFunciones();
      await this.state.registrarAccion('CREATE_SHOWTIME');
      this.router.navigate(['/admin/peliculas/menu']);
    }
  }
}
