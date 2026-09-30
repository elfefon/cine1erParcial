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

  vistaActual = signal<'menu' | 'crear-funcion' | 'modificar-funcion' | 'ver-funciones' | 'crear-pelicula' | 'ver-peliculas' | 'recomendaciones'>('menu');

  peliculas = signal<Pelicula[]>([]);
  salas = signal<any[]>([]);
  funciones = signal<any[]>([]);
  
  // Lista de recomendadas en proceso (para editar antes de guardar)
  recomendadasBorrador = signal<Pelicula[]>([]);
  peliculasDisponiblesParaRecomendar = computed(() => {
    return this.peliculas().filter(p => !this.recomendadasBorrador().some(r => r.id === p.id) && p.activa);
  });

  filtroBusqueda = signal<string>('');
  
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
    } catch(e: any) {
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

  cambiarVista(vista: 'menu' | 'crear-funcion' | 'modificar-funcion' | 'ver-funciones' | 'crear-pelicula' | 'ver-peliculas' | 'recomendaciones') {
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

      // Validación de choque de horarios
      const peliculaSeleccionada = this.peliculas().find(p => p.id === formValue.pelicula_id);
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
