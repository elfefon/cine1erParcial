import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Pelicula } from '../../../models/pelicula.interface';
import { ModificarFuncion } from '../home/modificar-funcion/modificar-funcion';

@Component({
  selector: 'app-gestion-peliculas',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, ModificarFuncion],
  templateUrl: './gestion-peliculas.component.html',
  styleUrl: './gestion-peliculas.component.css'
})
export class GestionPeliculasComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);

  funcionSeleccionadaParaModificar = signal<any>(null);

  vistaActual = signal<'menu' | 'crear-funcion' | 'modificar-funcion' | 'ver-funciones' | 'crear-pelicula' | 'ver-peliculas' | 'recomendaciones' | 'proximamente'>('menu');

  peliculas = signal<Pelicula[]>([]);
  salas = signal<any[]>([]);
  funciones = signal<any[]>([]);

  // Lista de recomendadas en proceso (para editar antes de guardar)
  recomendadasBorrador = signal<Pelicula[]>([]);
  peliculasDisponiblesParaRecomendar = computed(() => {
    return this.peliculas().filter(p => !this.recomendadasBorrador().some(r => r.id === p.id) && p.activa);
  });

  // Lista para Próximamente (backdrop url)
  peliculasProximamenteAdmin = computed(() => {
    const hoy = new Date().toISOString().split('T')[0];
    return this.peliculas().filter(p => p.fecha_estreno && p.fecha_estreno > hoy);
  });

  filtroBusqueda = signal<string>('');
  filtroPeliculaDropdown = signal<string>('');
  filtroPeliculaTabla = signal<string>('');

  peliculasDropdownFiltradas = computed(() => {
    const s = this.filtroPeliculaDropdown().toLowerCase();
    if (!s) return this.peliculas();
    return this.peliculas().filter(p => p.nombre.toLowerCase().includes(s));
  });

  peliculasTablaFiltradas = computed(() => {
    const s = this.filtroPeliculaTabla().toLowerCase();
    if (!s) return this.peliculas();
    return this.peliculas().filter(p => p.nombre.toLowerCase().includes(s));
  });

  tmdbNombreInput = signal<string>('');

  async importarYRecomendar() {
    const nombre = this.tmdbNombreInput().trim();
    if (!nombre) {
      alert('Ingresa el nombre de una película');
      return;
    }
    try {
      const peliculaGuardada = await this.supabase.buscarEImportarPeliculaPorNombre(nombre);
      if (peliculaGuardada) {
        // Marcarla como recomendada directamente en la base de datos
        const { error } = await this.supabase.client.from('movies').update({ recomendada: true }).eq('id', peliculaGuardada.id);
        if (error) {
          console.error("Error BD:", error);
          alert(`La película se importó, pero ocurrió un error al recomendarla en BD (¿Existe la columna 'recomendada'?): ${error.message}`);
        }

        const pFinal = { ...peliculaGuardada, recomendada: true };
        this.peliculas.update(lista => {
          const existe = lista.find(x => x.id === pFinal.id);
          return existe ? lista.map(x => x.id === pFinal.id ? pFinal : x) : [...lista, pFinal];
        });

        this.recomendadasBorrador.update(lista => {
          const existe = lista.find(x => x.id === pFinal.id);
          return existe ? lista : [...lista, pFinal];
        });

        this.tmdbNombreInput.set('');
        if (!error) {
          alert(`Película "${peliculaGuardada.nombre}" importada y añadida a recomendaciones.`);
        }
      } else {
        alert('No se pudo importar la película. Puede que ya exista o haya ocurrido un error.');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Error importando la película.');
    }
  }

  peliculaForm = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    sinopsis: ['', Validators.required],
    imagen_url: ['', Validators.required],
    duracion_min: [0, [Validators.required, Validators.min(1)]],
    restriccion_edad: [0, [Validators.required, Validators.min(0)]],
    generos: ['', Validators.required],
    fecha_estreno: [''],
    activa: [true]
  });

  funcionForm = this.fb.nonNullable.group({
    pelicula_id: ['', Validators.required],
    horario: ['', Validators.required],
    sala_id: ['', Validators.required],
    idioma: ['', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    formato: [{ value: '', disabled: true }]
  });

  preventaForm = this.fb.nonNullable.group({
    pelicula_id: ['', Validators.required],
    imagen_apaisada_url: ['', Validators.required]
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
    // Inicializar borrador de recomendadas
    this.recomendadasBorrador.set((data || []).filter(p => p.recomendada));
  }

  async cargarSalas() {
    const data = await this.supabase.getTableData<any>('rooms');
    this.salas.set(data || []);
  }

  async cargarFunciones() {
    const { data, error } = await this.supabase.client.from('showtimes').select('*, movies(*), rooms(*)');
    if (!error) {
      this.funciones.set(data || []);
    } else {
      console.error('Error cargando funciones:', error);
    }
  }

  // --- RECOMENDACIONES ---

  async agregarARecomendadas(p: Pelicula) {
    if (this.recomendadasBorrador().length >= 10) {
      alert('Solo puedes tener hasta 10 películas recomendadas.');
      return;
    }
    // Guardar en BD inmediatamente
    const { error } = await this.supabase.client.from('movies').update({ recomendada: true }).eq('id', p.id);
    if (error) {
      console.error("Error BD:", error);
      alert(`Error al recomendar en BD (¿Falta columna 'recomendada'?): ${error.message}`);
    }

    // Actualizar estado local
    this.recomendadasBorrador.update(lista => [...lista, { ...p, recomendada: true }]);
    this.peliculas.update(lista => lista.map(item => item.id === p.id ? { ...item, recomendada: true } : item));
  }

  async quitarDeRecomendadas(p: Pelicula) {
    // Guardar en BD inmediatamente
    const { error } = await this.supabase.client.from('movies').update({ recomendada: false }).eq('id', p.id);
    if (error) {
      console.error("Error BD:", error);
      alert(`Error al quitar recomendación en BD: ${error.message}`);
    }

    // Actualizar estado local
    this.recomendadasBorrador.update(lista => lista.filter(item => item.id !== p.id));
    this.peliculas.update(lista => lista.map(item => item.id === p.id ? { ...item, recomendada: false } : item));
  }

  // --- FIN RECOMENDACIONES ---

  onSeleccionarPeliculaPreventa(event: Event) {
    const target = event.target as HTMLInputElement;
    const nombre = target.value;
    const p = this.peliculas().find(x => x.nombre === nombre);
    if (p) {
      this.preventaForm.patchValue({ pelicula_id: p.id, imagen_apaisada_url: p.imagen_apaisada_url || '' });
    } else {
      this.preventaForm.patchValue({ pelicula_id: '', imagen_apaisada_url: '' });
    }
  }

  async onSubmitPreventa() {
    if (this.preventaForm.valid) {
      const { pelicula_id, imagen_apaisada_url } = this.preventaForm.getRawValue();
      const { error } = await this.supabase.client.from('movies').update({ imagen_apaisada_url: imagen_apaisada_url.trim() }).eq('id', pelicula_id);
      
      if (error) {
        alert(`Error al guardar la imagen panorámica: ${error.message}`);
      } else {
        this.peliculas.update(lista => lista.map(p => p.id === pelicula_id ? { ...p, imagen_apaisada_url: imagen_apaisada_url.trim() } : p));
        alert(`Imagen guardada con éxito.`);
        this.preventaForm.reset();
        // Reset autocompletar si es necesario, pero bastará con que el usuario lo cambie.
      }
    }
  }

  cambiarVista(vista: 'menu' | 'crear-funcion' | 'modificar-funcion' | 'ver-funciones' | 'crear-pelicula' | 'ver-peliculas' | 'recomendaciones' | 'proximamente') {
    this.vistaActual.set(vista);
    this.filtroBusqueda.set(''); // reset search
    if (vista === 'recomendaciones') {
      // reset borrador
      this.recomendadasBorrador.set(this.peliculas().filter(p => p.recomendada));
    }
  }

  onBuscar(event: Event) {
    const target = event.target as HTMLInputElement;
    this.filtroBusqueda.set(target.value.toLowerCase());
  }

  onBuscarPeliculaTabla(event: Event) {
    const target = event.target as HTMLInputElement;
    this.filtroPeliculaTabla.set(target.value.toLowerCase());
  }

  getNombrePelicula(id: string | null | undefined): string {
    if (!id) return '';
    return this.peliculas().find(p => p.id === id)?.nombre || '';
  }

  onSeleccionarPeliculaList(event: Event) {
    const target = event.target as HTMLInputElement;
    const nombre = target.value;
    const p = this.peliculas().find(x => x.nombre === nombre);
    if (p) {
      this.funcionForm.patchValue({ pelicula_id: p.id });
    } else {
      this.funcionForm.patchValue({ pelicula_id: '' });
    }
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
      const rawValues = this.peliculaForm.getRawValue();
      const generosArray = rawValues.generos.split(',').map(g => g.trim()).filter(g => g !== '');

      const pelicula = {
        nombre: rawValues.nombre,
        sinopsis: rawValues.sinopsis,
        imagen_url: rawValues.imagen_url,
        duracion_min: rawValues.duracion_min,
        restriccion_edad: rawValues.restriccion_edad,
        generos: generosArray,
        fecha_estreno: rawValues.fecha_estreno ? rawValues.fecha_estreno : null,
        activa: rawValues.activa
      };

      await this.supabase.insertData('movies', pelicula);
      this.peliculaForm.reset({ activa: true, duracion_min: 0, restriccion_edad: 0, generos: '', fecha_estreno: '' });
      await this.cargarPeliculas();
      await this.registrarAccion('CREATE_MOVIE');
      this.cambiarVista('menu');
    }
  }

  async onSubmitFuncion() {
    if (this.funcionForm.valid) {
      const formValue = this.funcionForm.getRawValue();

      // Validación de fecha de estreno (Pre-venta máxima 1 semana)
      const peliculaSeleccionada = this.peliculas().find(p => p.id === formValue.pelicula_id);
      
      if (peliculaSeleccionada?.fecha_estreno) {
        const fechaEstreno = new Date(peliculaSeleccionada.fecha_estreno).getTime();
        const hoyDate = new Date();
        hoyDate.setHours(0, 0, 0, 0); // Establecer a la medianoche de hoy
        const limiteMaximo = hoyDate.getTime() + (7 * 24 * 60 * 60 * 1000); // Hoy + 7 días en milisegundos
        
        if (fechaEstreno > limiteMaximo) {
          alert('Error: No se puede crear la función. La película pertenece a "Próximamente" y su estreno es en más de 1 semana.');
          return;
        }
      }
      const duracionNuevo = peliculaSeleccionada?.duracion_min || 120; // 120 min fallback
      const inicioNuevo = new Date(formValue.horario).getTime();
      const finNuevo = inicioNuevo + (duracionNuevo * 60000); // ms

      const funcionesEnMismaSala = this.funciones().filter(f => f.room_id === formValue.sala_id);

      for (const fExistente of funcionesEnMismaSala) {
        const duracionExistente = fExistente.movies?.duracion_min || 120;
        const inicioExistente = new Date(fExistente.fecha_hora).getTime();
        const finExistente = inicioExistente + (duracionExistente * 60000);

        // Se requiere 30 minutos (1800000 ms) de brecha entre funciones
        const nuevoEmpiezaAntesQueTermineExistente = inicioNuevo < (finExistente + 1800000);
        const existenteEmpiezaAntesQueTermineNuevo = inicioExistente < (finNuevo + 1800000);

        if (nuevoEmpiezaAntesQueTermineExistente && existenteEmpiezaAntesQueTermineNuevo) {
          alert('Error: No se puede crear la función. Choca con una existente o no respeta los 30 minutos de descanso en esta sala.');
          return;
        }
      }

      const funcionData = {
        movie_id: formValue.pelicula_id,
        room_id: formValue.sala_id,
        fecha_hora: formValue.horario,
        idioma: formValue.idioma,
        precio_base: formValue.precio,
        formato: formValue.formato
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
        accion: tipo,
        entidad_afectada: 'Pelicula',
        user_id: user.data.user.id
      });
    }
  }

  abrirModificarFuncion(f: any) {
    this.funcionSeleccionadaParaModificar.set(f);
  }

  cerrarModificarFuncion() {
    this.funcionSeleccionadaParaModificar.set(null);
  }

  async onFuncionModificada() {
    this.cerrarModificarFuncion();
    await this.cargarFunciones();
    await this.registrarAccion('UPDATE_SHOWTIME');
  }
}
