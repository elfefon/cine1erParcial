import { Component, Input, Output, EventEmitter, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../core/services/supabase.service';

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
  
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);

  funcionForm = this.fb.nonNullable.group({
    pelicula_id: ['', Validators.required],
    horario: ['', Validators.required],
    sala_id: ['', Validators.required],
    idioma: ['', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    formato: [{value: '', disabled: true}]
  });

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

  ngOnInit() {
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
    }

    this.funcionForm.get('sala_id')?.valueChanges.subscribe(salaId => {
      const sala = this.salas.find(s => s.id === salaId);
      if (sala) {
        this.funcionForm.patchValue({ formato: sala.dimension || '2D' });
      }
    });
  }

  async onSubmit() {
    if (this.funcionForm.valid) {
      const formValue = this.funcionForm.getRawValue();

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

  onCancel() {
    this.close.emit();
  }
}
