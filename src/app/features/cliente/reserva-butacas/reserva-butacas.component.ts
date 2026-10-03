import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { Pelicula } from '../../../models/pelicula.interface';

interface Butaca {
  id: string; // uuid de seats
  numero_butaca: string;
  fila: string;
  columna: number;
  tipo_butaca: string;
  estado: 'libre' | 'seleccionada' | 'ocupada';
}

import { MapaButacasComponent, ButacaItem } from '../../../shared/components/mapa-butacas/mapa-butacas.component';

@Component({
  selector: 'app-reserva-butacas',
  standalone: true,
  imports: [MapaButacasComponent],
  templateUrl: './reserva-butacas.component.html',
  styleUrl: './reserva-butacas.component.css'
})
export class ReservaButacasComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  private cart = inject(CartService);

  peliculaId = signal<string>('');
  pelicula = signal<Pelicula | null>(null);
  showtimeId = signal<string>('');
  showtimeRaw = signal<any>(null);
  
  butacas = signal<Butaca[]>([]);
  
  loading = signal(false);
  mensajeExito = signal('');

  precioBase = computed(() => {
    return this.showtimeRaw()?.precio_base || 5000;
  });

  butacasSeleccionadasCount = computed(() => {
    return this.butacas().filter(b => b.estado === 'seleccionada').length;
  });

  total = computed(() => {
    let sum = 0;
    const base = this.precioBase();
    this.butacas().filter(b => b.estado === 'seleccionada').forEach(b => {
      const tipo = (b.tipo_butaca || '').toLowerCase();
      if (tipo === 'vip') sum += base * 2;
      else if (tipo === 'discapacitado' || tipo === 'discapacitados') sum += base * 1.5;
      else sum += base;
    });
    return sum;
  });

  async ngOnInit() {
    this.peliculaId.set(this.route.snapshot.paramMap.get('id') || '');
    await this.cargarDatos();
  }

  async cargarDatos() {
    const resPeli = await this.supabase.client.from('movies').select('*').eq('id', this.peliculaId()).single();
    if (resPeli.data) {
      this.pelicula.set(resPeli.data);
    }

    const showtimeParam = this.route.snapshot.queryParamMap.get('showtime');

    let query = this.supabase.client.from('showtimes').select('*');
    if (showtimeParam) {
      query = query.eq('id', showtimeParam);
    } else {
      query = query.eq('movie_id', this.peliculaId()).order('fecha_hora', { ascending: true }).limit(1);
    }
    
    const resShowtime = await query.single();
    if (!resShowtime.data) return;
    
    const showtime = resShowtime.data;
    this.showtimeId.set(showtime.id);
    this.showtimeRaw.set(showtime);

    const resSeats = await this.supabase.client.from('seats').select('*').eq('room_id', showtime.room_id);
    const dbSeats = resSeats.data || [];

    const resReservations = await this.supabase.client.from('seat_reservations').select('seat_id').eq('showtime_id', showtime.id);
    const occupiedSeatIds = (resReservations.data || []).map(r => r.seat_id);

    const mappedButacas: Butaca[] = dbSeats.map(seat => ({
      id: seat.id,
      numero_butaca: seat.numero_butaca || seat.seat_number || `${seat.fila || ''}${seat.columna || ''}`,
      fila: seat.fila || '',
      columna: seat.columna || 0,
      tipo_butaca: seat.tipo_butaca || 'estandar',
      estado: occupiedSeatIds.includes(seat.id) ? 'ocupada' : 'libre'
    }));

    mappedButacas.sort((a, b) => (a.fila || '').localeCompare(b.fila || '') || a.columna - b.columna);
    this.butacas.set(mappedButacas);
  }

  butacasParaMapa = computed<ButacaItem[]>(() => {
    return this.butacas().map(b => ({
      id: b.id,
      numero_butaca: b.numero_butaca,
      fila: b.fila,
      columna: b.columna,
      tipo_butaca: b.tipo_butaca,
      ocupada: b.estado === 'ocupada'
    }));
  });

  butacasSeleccionadasIds = computed<string[]>(() => {
    return this.butacas().filter(b => b.estado === 'seleccionada').map(b => b.id);
  });

  toggleButaca(butaca: { id: string }) {
    this.butacas.update(lista => {
      const b = lista.find(item => item.id === butaca.id);
      if (b && b.estado !== 'ocupada') {
        b.estado = b.estado === 'libre' ? 'seleccionada' : 'libre';
      }
      return [...lista]; 
    });
  }

  agregarAlCarrito() {
    if (this.butacasSeleccionadasCount() === 0) {
      alert('Debe seleccionar al menos una butaca');
      return;
    }
    const seleccionadas = this.butacas().filter(b => b.estado === 'seleccionada');
    
    this.cart.addTickets({
      id_funcion: this.showtimeId(),
      pelicula_nombre: this.pelicula()?.nombre || 'Desconocida',
      butacas: seleccionadas.map(b => b.numero_butaca),
      precioButaca: this.precioBase(),
      precioTotal: this.total(),
      funcion_raw: this.showtimeRaw(),
      pelicula_raw: this.pelicula()
    });

    this.router.navigate(['/carrito']);
  }
}
