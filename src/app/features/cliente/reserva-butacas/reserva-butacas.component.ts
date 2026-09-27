import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { Pelicula } from '../../../models/pelicula.interface';
import { Combo } from '../../../models/combo.interface';

interface Butaca {
  id: string; // uuid de seats
  numero_butaca: string;
  fila: string;
  columna: number;
  tipo_butaca: string;
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
  showtimeId = signal<string>('');
  
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
    await this.cargarDatos();
  }

  async cargarDatos() {
    // 1. Traer la peli
    const resPeli = await this.supabase.client.from('movies').select('*').eq('id', this.peliculaId()).single();
    if (resPeli.data) this.pelicula.set(resPeli.data);

    // 2. Traer Combos
    const dataCombos = await this.supabase.getTableData<Combo>('candy_products');
    this.combosDisponibles.set(dataCombos);

    // 3. Traer la primera función (showtime) para esta peli
    const resShowtime = await this.supabase.client.from('showtimes')
      .select('*')
      .eq('movie_id', this.peliculaId())
      .order('fecha_hora', { ascending: true })
      .limit(1)
      .single();

    if (!resShowtime.data) {
      console.warn('No hay funciones (showtimes) creadas para esta película.');
      return;
    }
    
    const showtime = resShowtime.data;
    this.showtimeId.set(showtime.id);

    // 4. Traer los asientos físicos (seats) de la sala (room) de esa función
    const resSeats = await this.supabase.client.from('seats')
      .select('*')
      .eq('room_id', showtime.room_id);

    const dbSeats = resSeats.data || [];

    // 5. Traer las reservas ya hechas (seat_reservations) para esta función
    const resReservations = await this.supabase.client.from('seat_reservations')
      .select('seat_id')
      .eq('showtime_id', showtime.id);

    const occupiedSeatIds = (resReservations.data || []).map(r => r.seat_id);

    // 6. Mapear al modelo que usa el HTML y ordenar
    const mappedButacas: Butaca[] = dbSeats.map(seat => ({
      id: seat.id,
      numero_butaca: seat.numero_butaca,
      fila: seat.fila,
      columna: seat.columna,
      tipo_butaca: seat.tipo_butaca,
      estado: occupiedSeatIds.includes(seat.id) ? 'ocupada' : 'libre'
    }));

    // Ordenar por fila (A, B, C) y luego por columna (1, 2, 3...)
    mappedButacas.sort((a, b) => a.fila.localeCompare(b.fila) || a.columna - b.columna);

    this.butacas.set(mappedButacas);
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

    if (!this.showtimeId()) {
      alert('No hay función asignada para reservar.');
      return;
    }

    const usuario = this.auth.usuarioActual();
    if (!usuario) {
      this.router.navigate(['/login']);
      return;
    }

    this.loading.set(true);

    try {
      const seleccionadas = this.butacas().filter(b => b.estado === 'seleccionada');
      
      // 1. Insertamos el Ticket General
      const payloadTicket = {
        usuario_id: usuario.id,
        pelicula_id: this.peliculaId(),
        butacas: seleccionadas.map(b => b.numero_butaca), // Guardamos un array de strings (A1, A2) por compatibilidad
        combos: this.carritoCombos(),
        total: this.total(),
        fecha: new Date().toISOString()
      };

      const ticketInsertado = await this.supabase.insertData<any>('tickets', payloadTicket);

      // 2. Insertamos la ocupación real en seat_reservations para bloquearlas
      const reservasPayload = seleccionadas.map(b => ({
        showtime_id: this.showtimeId(),
        ticket_id: ticketInsertado.id,
        tipo_butaca: b.tipo_butaca,
        precio_pagado: this.precioButaca,
        seat_id: b.id
      }));

      const resReservas = await this.supabase.client.from('seat_reservations').insert(reservasPayload);
      if (resReservas.error) throw resReservas.error;

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
