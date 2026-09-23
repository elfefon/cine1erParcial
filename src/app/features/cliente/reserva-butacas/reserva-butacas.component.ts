import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { Pelicula } from '../../../models/pelicula.interface';
import { Combo } from '../../../models/combo.interface';

interface Butaca {
  id: string;
  estado: 'libre' | 'seleccionada' | 'ocupada';
}

@Component({
  selector: 'app-reserva-butacas',
  standalone: true,
  templateUrl: './reserva-butacas.component.html',
  styleUrl: './reserva-butacas.component.css'
})
export class ReservaButacasComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);

  peliculaId = signal<string>('');
  pelicula = signal<Pelicula | null>(null);
  
  // Butacas: 5 filas x 10 columnas
  filas = ['A', 'B', 'C', 'D', 'E'];
  columnas = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  butacas = signal<Butaca[]>([]);
  
  // Combos
  combosDisponibles = signal<Combo[]>([]);
  carritoCombos = signal<Combo[]>([]);

  loading = signal(false);
  mensajeExito = signal('');

  precioButaca = 5000;

  butacasSeleccionadasCount = computed(() => {
    return this.butacas().filter(b => b.estado === 'seleccionada').length;
  });

  total = computed(() => {
    const totalButacas = this.butacasSeleccionadasCount() * this.precioButaca;
    const totalCombos = this.carritoCombos().reduce((acc, combo) => acc + combo.precio, 0);
    return totalButacas + totalCombos;
  });

  async ngOnInit() {
    this.peliculaId.set(this.route.snapshot.paramMap.get('id') || '');
    this.generarButacas();
    await this.cargarDatos();
  }

  generarButacas() {
    const generadas: Butaca[] = [];
    for (const f of this.filas) {
      for (const c of this.columnas) {
        // Simulación de algunas ocupadas
        const estado = (f === 'A' && c <= 2) ? 'ocupada' : 'libre';
        generadas.push({ id: `${f}${c}`, estado });
      }
    }
    this.butacas.set(generadas);
  }

  async cargarDatos() {
    const resPeli = await this.supabase.client.from('movies').select('*').eq('id', this.peliculaId()).single();
    if (resPeli.data) this.pelicula.set(resPeli.data);

    const dataCombos = await this.supabase.getTableData<Combo>('candy_products');
    this.combosDisponibles.set(dataCombos);
  }

  toggleButaca(butaca: Butaca) {
    if (butaca.estado === 'ocupada') return;
    
    this.butacas.update(lista => {
      const b = lista.find(item => item.id === butaca.id);
      if (b) {
        b.estado = b.estado === 'libre' ? 'seleccionada' : 'libre';
      }
      return [...lista]; 
    });
  }

  agregarCombo(combo: Combo) {
    this.carritoCombos.update(lista => [...lista, combo]);
  }

  removerCombo(index: number) {
    this.carritoCombos.update(lista => lista.filter((_, i) => i !== index));
  }

  async confirmarReserva() {
    if (this.butacasSeleccionadasCount() === 0) {
      alert('Debe seleccionar al menos una butaca');
      return;
    }

    const usuario = this.auth.usuarioActual();
    if (!usuario) {
      this.router.navigate(['/login']);
      return;
    }

    this.loading.set(true);

    try {
      const seleccionadas = this.butacas().filter(b => b.estado === 'seleccionada').map(b => b.id);
      const payload = {
        usuario_id: usuario.id,
        pelicula_id: this.peliculaId(),
        butacas: seleccionadas,
        combos: this.carritoCombos(),
        total: this.total(),
        fecha: new Date().toISOString()
      };

      await this.supabase.insertData('tickets', payload);
      this.mensajeExito.set('¡Reserva confirmada con éxito!');
      
      setTimeout(() => {
        this.router.navigate(['/cartelera']);
      }, 3000);
      
    } catch (e) {
      console.error(e);
      alert('Error al procesar reserva');
    } finally {
      this.loading.set(false);
    }
  }
}
