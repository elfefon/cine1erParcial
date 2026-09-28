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
    console.log('--- [CARGAR DATOS RESERVA] ---');
    console.log('peliculaId:', this.peliculaId());

    // 1. Traer la peli
    const resPeli = await this.supabase.client.from('movies').select('*').eq('id', this.peliculaId()).single();
    if (resPeli.error) {
      console.error('Error al traer pelicula:', resPeli.error);
    } else {
      console.log('Pelicula cargada:', resPeli.data);
      this.pelicula.set(resPeli.data);
    }

    // 2. Traer Combos
    const dataCombos = await this.supabase.getTableData<Combo>('candy_products');
    this.combosDisponibles.set(dataCombos);

    // 3. Traer la función específica si viene por query param, o la primera por defecto
    const showtimeParam = this.route.snapshot.queryParamMap.get('showtime');
    console.log('Query param showtime:', showtimeParam);

    let query = this.supabase.client.from('showtimes').select('*');
    
    if (showtimeParam) {
      query = query.eq('id', showtimeParam);
    } else {
      query = query.eq('movie_id', this.peliculaId()).order('fecha_hora', { ascending: true }).limit(1);
    }
    
    const resShowtime = await query.single();

    if (resShowtime.error) {
      console.error('Error al traer showtime/función:', resShowtime.error);
      return;
    }

    if (!resShowtime.data) {
      console.warn('No hay funciones (showtimes) para esta película.');
      return;
    }
    
    const showtime = resShowtime.data;
    console.log('Showtime seleccionado:', showtime);
    this.showtimeId.set(showtime.id);

    // 4. Traer los asientos físicos (seats) de la sala (room) de esa función
    console.log('Buscando asientos para room_id:', showtime.room_id);
    const resSeats = await this.supabase.client.from('seats')
      .select('*')
      .eq('room_id', showtime.room_id);

    if (resSeats.error) {
      console.error('Error al traer asientos (seats):', resSeats.error);
      return;
    }

    console.log('Asientos (seats) encontrados en la BDD:', resSeats.data);
    const dbSeats = resSeats.data || [];

    if (dbSeats.length === 0) {
      console.warn('La tabla "seats" no devolvió ninguna butaca para el room_id:', showtime.room_id);
      
      // Diagnóstico: consultar si hay asientos en general en la tabla 'seats'
      const checkAllSeats = await this.supabase.client.from('seats').select('*').limit(5);
      console.log('Muestra general de tabla "seats" (sin filtro de sala):', checkAllSeats.data, 'Error:', checkAllSeats.error);
    }

    // 5. Traer las reservas ya hechas (seat_reservations) para esta función
    const resReservations = await this.supabase.client.from('seat_reservations')
      .select('seat_id')
      .eq('showtime_id', showtime.id);

    if (resReservations.error) {
      console.error('Error al traer seat_reservations:', resReservations.error);
    }

    const occupiedSeatIds = (resReservations.data || []).map(r => r.seat_id);

    // 6. Mapear al modelo que usa el HTML y ordenar
    const mappedButacas: Butaca[] = dbSeats.map(seat => ({
      id: seat.id,
      numero_butaca: seat.numero_butaca || seat.seat_number || `${seat.fila || ''}${seat.columna || ''}`,
      fila: seat.fila || '',
      columna: seat.columna || 0,
      tipo_butaca: seat.tipo_butaca || 'estandar',
      estado: occupiedSeatIds.includes(seat.id) ? 'ocupada' : 'libre'
    }));

    mappedButacas.sort((a, b) => (a.fila || '').localeCompare(b.fila || '') || a.columna - b.columna);

    console.log('Butacas finales mapeadas para renderizar:', mappedButacas);
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
      
      // Generar código de venta y qr únicos
      const randomCode = Math.random().toString(36).substring(2, 9).toUpperCase();
      const codigoVenta = `TKT-${Date.now()}-${randomCode}`;
      const qrData = JSON.stringify({
        codigo: codigoVenta,
        user_id: usuario.id,
        showtime_id: this.showtimeId(),
        seats: seleccionadas.map(b => b.numero_butaca),
        total: this.total()
      });

      // 1. Insertamos el Ticket con el schema exacto de la tabla tickets
      const payloadTicket = {
        user_id: usuario.id,
        total_pagado: this.total(),
        puntos_generados: Math.floor(this.total() / 100),
        codigo_venta: codigoVenta,
        qr_codigo: qrData,
        estado: 'valido',
        fecha_compra: new Date().toISOString()
      };

      console.log('Enviando ticket a Supabase:', payloadTicket);
      const ticketInsertado = await this.supabase.insertData<any>('tickets', payloadTicket);
      console.log('Ticket creado con éxito:', ticketInsertado);

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
