import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Pelicula } from '../../../models/pelicula.interface';

@Component({
  selector: 'app-gestion-peliculas',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './gestion-peliculas.component.html',
  styleUrl: './gestion-peliculas.component.css'
})
export class GestionPeliculasComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);

  vistaActual = signal<'menu' | 'crear-funcion' | 'modificar-funcion' | 'ver-funciones' | 'crear-pelicula' | 'ver-peliculas'>('menu');

  peliculas = signal<Pelicula[]>([]);
  salas = signal<any[]>([]);
  funciones = signal<any[]>([]);
  
  filtroBusqueda = signal<string>('');

  peliculaForm = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    sinopsis: ['', Validators.required],
    imagen_url: ['', Validators.required],
    activa: [true]
  });

  funcionForm = this.fb.nonNullable.group({
    pelicula_id: ['', Validators.required],
    horario: ['', Validators.required],
    sala_id: ['', Validators.required],
    idioma: ['', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    formato: [{value: '', disabled: true}]
  });

  async ngOnInit() {
    await this.cargarPeliculas();
    await this.cargarSalas();
    await this.cargarFunciones();
    
    this.funcionForm.get('sala_id')?.valueChanges.subscribe(salaId => {
      const sala = this.salas().find(s => s.id === salaId);
      if (sala) {
        this.funcionForm.patchValue({ formato: sala.dimension || '2D' });
      }
    });
  }

  async cargarPeliculas() {
    const data = await this.supabase.getTableData<Pelicula>('movies');
    this.peliculas.set(data || []);
  }

  async cargarSalas() {
    const data = await this.supabase.getTableData<any>('rooms');
    this.salas.set(data || []);
  }

  async cargarFunciones() {
    const { data, error } = await this.supabase.client
      .from('showtimes')
      .select(`*, movies (nombre, duracion), rooms (nombre, dimension)`);
    if (!error) {
      this.funciones.set(data || []);
    }
  }

  cambiarVista(vista: 'menu' | 'crear-funcion' | 'modificar-funcion' | 'ver-funciones' | 'crear-pelicula' | 'ver-peliculas') {
    this.vistaActual.set(vista);
    this.filtroBusqueda.set(''); // reset search
  }

  onBuscar(event: Event) {
    const target = event.target as HTMLInputElement;
    this.filtroBusqueda.set(target.value.toLowerCase());
  }

  get funcionesFiltradas() {
    if (!this.filtroBusqueda()) return this.funciones();
    return this.funciones().filter(f => {
      const s = this.filtroBusqueda();
      return f.movies?.nombre?.toLowerCase().includes(s) ||
             f.rooms?.nombre?.toLowerCase().includes(s);
    });
  }

  async onSubmit() {
    if (this.peliculaForm.valid) {
      const pelicula = this.peliculaForm.getRawValue();
      await this.supabase.insertData('movies', pelicula);
      this.peliculaForm.reset({ activa: true });
      await this.cargarPeliculas();
      await this.registrarAccion('CREATE_MOVIE');
      this.cambiarVista('menu');
    }
  }

  async onSubmitFuncion() {
    if (this.funcionForm.valid) {
      const formValue = this.funcionForm.getRawValue();
      const funcionData = {
        movie_id: formValue.pelicula_id,
        room_id: formValue.sala_id,
        horario: formValue.horario,
        idioma: formValue.idioma,
        precio: formValue.precio
      };
      await this.supabase.insertData('showtimes', funcionData);
      this.funcionForm.reset();
      await this.cargarFunciones();
      await this.registrarAccion('CREATE_SHOWTIME');
      this.cambiarVista('menu');
    }
  }

  private async registrarAccion(tipo: string) {
    const user = await this.supabase.auth.getUser();
    if (user.data.user) {
      await this.supabase.insertData('activity_logs', {
        tipo,
        entidad: 'Pelicula',
        administrador: user.data.user.email,
        fecha: new Date().toISOString()
      });
    }
  }
}
