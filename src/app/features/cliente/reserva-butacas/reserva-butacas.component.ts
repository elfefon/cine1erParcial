import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { WaitlistService } from '../../../core/services/waitlist.service';
import { ToastService } from '../../../core/services/toast.service';
import { Pelicula } from '../../../models/pelicula.interface';
import { WaitlistEntry } from '../../../models/waitlist.interface';
import { MapaButacasComponent, ButacaItem } from '../../../shared/components/mapa-butacas/mapa-butacas.component';

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
  imports: [CommonModule, MapaButacasComponent],
  templateUrl: './reserva-butacas.component.html',
  styleUrl: './reserva-butacas.component.css'
})
export class ReservaButacasComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabase = inject(SupabaseService);
  auth = inject(AuthService);
  private cart = inject(CartService);
  private waitlistService = inject(WaitlistService);
  private toastService = inject(ToastService);

  peliculaId = signal<string>('');
  pelicula = signal<Pelicula | null>(null);
  showtimeId = signal<string>('');
  showtimeRaw = signal<any>(null);
  modoReubicacion = signal(false);

  butacas = signal<Butaca[]>([]);
  colaEspera = signal<WaitlistEntry[]>([]);
  procesandoWaitlist = signal(false);

  warningPreventa = signal('');
  mensajeExito = signal('');
  loading = signal(false);

  private realtimeChannel: any;
  private timerWaitlist: any;
  private myLockedSeatIds: string[] = [];

  butacasLibresCount = computed(() => {
    return this.butacas().filter(b => b.estado === 'libre' || b.estado === 'seleccionada').length;
  });

  funcionAgotada = computed(() => {
    const lista = this.butacas();
    if (lista.length === 0) return false;
    return lista.every(b => b.estado === 'ocupada');
  });

  miEntradaEspera = computed<WaitlistEntry | null>(() => {
    const user = this.auth.usuarioActual();
    if (!user) return null;
    return this.colaEspera().find(e => e.user_id === user.id) || null;
  });

  turnoReservadoParaOtro = computed<boolean>(() => {
    const user = this.auth.usuarioActual();
    const notificado = this.colaEspera().find(e => e.estado === 'notificado');
    if (!notificado) return false;
    return !user || notificado.user_id !== user.id;
  });

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
    this.modoReubicacion.set(this.route.snapshot.queryParamMap.get('reubicar') === 'true');
    await this.cargarDatos();

    this.timerWaitlist = setInterval(() => {
      if (this.showtimeId()) {
        this.cargarListaEspera();
      }
    }, 30000);
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

    if (showtime.es_preventa) {
      const showDate = new Date(showtime.fecha_hora);
      const now = new Date();
      const diffDays = (showDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
      if (diffDays > 10) {
        this.warningPreventa.set('Las entradas en preventa no admiten reembolso de puntos.');
      }
    }

    const resSeats = await this.supabase.client.from('seats').select('*').eq('room_id', showtime.room_id);
    const dbSeats = resSeats.data || [];

    const resReservations = await this.supabase.client.from('seat_reservations').select('seat_id').eq('showtime_id', showtime.id);
    const occupiedSeatIds = (resReservations.data || []).map(r => r.seat_id);

    const resLocks = await this.supabase.client.from('locked_seats').select('seat_id, user_id').eq('showtime_id', showtime.id);
    const lockedSeats = resLocks.data || [];
    
    const currentUser = this.auth.usuarioActual();
    
    lockedSeats.forEach(l => {
      if (currentUser && l.user_id === currentUser.id) {
        this.myLockedSeatIds.push(l.seat_id);
      } else {
        occupiedSeatIds.push(l.seat_id);
      }
    });

    const mappedButacas: Butaca[] = dbSeats.map(seat => ({
      id: seat.id,
      numero_butaca: seat.numero_butaca || seat.seat_number || `${seat.fila || ''}${seat.columna || ''}`,
      fila: seat.fila || '',
      columna: seat.columna || 0,
      tipo_butaca: seat.tipo_butaca || 'estandar',
      estado: occupiedSeatIds.includes(seat.id) ? 'ocupada' : (this.myLockedSeatIds.includes(seat.id) ? 'seleccionada' : 'libre')
    }));

    mappedButacas.sort((a, b) => (a.fila || '').localeCompare(b.fila || '') || a.columna - b.columna);
    this.butacas.set(mappedButacas);
    
    await this.cargarListaEspera();
    this.iniciarRealtime();
  }

  async cargarListaEspera() {
    if (!this.showtimeId()) return;
    const cola = await this.waitlistService.obtenerColaPorFuncion(this.showtimeId());
    this.colaEspera.set(cola);
  }

  async anotarseEnListaEspera() {
    const user = this.auth.usuarioActual();
    if (!user) {
      this.toastService.warning('Debés iniciar sesión para anotarte en la lista de espera.');
      this.router.navigate(['/login']);
      return;
    }

    await this.waitlistService.solicitarPermisoPush();
    this.procesandoWaitlist.set(true);
    try {
      const res = await this.waitlistService.inscribirseEnListaEspera(this.showtimeId());
      if (res.ok) {
        this.toastService.success(res.mensaje);
        await this.cargarListaEspera();
      } else {
        this.toastService.warning(res.mensaje);
      }
    } finally {
      this.procesandoWaitlist.set(false);
    }
  }

  async salirDeListaEspera() {
    const entrada = this.miEntradaEspera();
    if (!entrada) return;
    if (!confirm('¿Seguro que querés salir de la lista de espera para esta función?')) return;

    this.procesandoWaitlist.set(true);
    try {
      const res = await this.waitlistService.salirDeListaEspera(entrada.id, this.showtimeId());
      if (res.ok) {
        this.toastService.info(res.mensaje);
        await this.cargarListaEspera();
      } else {
        this.toastService.error(res.mensaje);
      }
    } finally {
      this.procesandoWaitlist.set(false);
    }
  }

  iniciarRealtime() {
    const showtime = this.showtimeId();
    if (!showtime) return;
    
    this.realtimeChannel = this.supabase.client
      .channel(`locked_seats_${showtime}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'locked_seats', filter: `showtime_id=eq.${showtime}` }, payload => {
        const newLock = payload.new as any;
        const currentUser = this.auth.usuarioActual();
        if (!currentUser || newLock.user_id !== currentUser.id) {
          this.butacas.update(lista => {
            const b = lista.find(item => item.id === newLock.seat_id);
            if (b) b.estado = 'ocupada';
            return [...lista];
          });
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'locked_seats', filter: `showtime_id=eq.${showtime}` }, payload => {
        const oldLock = payload.old as any;
        this.butacas.update(lista => {
          const b = lista.find(item => item.id === oldLock.seat_id);
          if (b && b.estado === 'ocupada') b.estado = 'libre';
          return [...lista];
        });
        this.cargarListaEspera();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'seat_reservations', filter: `showtime_id=eq.${showtime}` }, payload => {
        const newRes = payload.new as any;
        this.butacas.update(lista => {
          const b = lista.find(item => item.id === newRes.seat_id);
          if (b) b.estado = 'ocupada';
          return [...lista];
        });
        this.cargarListaEspera();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'seat_reservations', filter: `showtime_id=eq.${showtime}` }, payload => {
        const oldRes = payload.old as any;
        this.butacas.update(lista => {
          const b = lista.find(item => item.id === oldRes.seat_id);
          if (b) b.estado = 'libre';
          return [...lista];
        });
        this.cargarListaEspera();
      })
      .subscribe();
  }

  async ngOnDestroy() {
    if (this.timerWaitlist) {
      clearInterval(this.timerWaitlist);
    }
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
    }
    const currentUser = this.auth.usuarioActual();
    if (currentUser && this.myLockedSeatIds.length > 0) {
      await this.supabase.client.from('locked_seats').delete()
        .eq('showtime_id', this.showtimeId())
        .eq('user_id', currentUser.id)
        .in('seat_id', this.myLockedSeatIds);
    }
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

  async toggleButaca(butaca: { id: string }) {
    const user = this.auth.usuarioActual();
    if (!user) {
      alert('Debes iniciar sesión para seleccionar butacas (el bloqueo en tiempo real requiere tu usuario).');
      this.router.navigate(['/login']);
      return;
    }

    if (this.turnoReservadoParaOtro()) {
      this.toastService.warning('Las butacas liberadas están reservadas durante 15 minutos para el primer usuario en la lista de espera.');
      return;
    }

    let aSeleccionar = false;
    const bActual = this.butacas().find(item => item.id === butaca.id);
    if (!bActual || bActual.estado === 'ocupada') return;

    if (bActual.estado === 'libre') aSeleccionar = true;

    this.butacas.update(lista => {
      const b = lista.find(item => item.id === butaca.id);
      if (b && b.estado !== 'ocupada') {
        b.estado = aSeleccionar ? 'seleccionada' : 'libre';
      }
      return [...lista]; 
    });

    if (aSeleccionar) {
      const { error } = await this.supabase.client.from('locked_seats').insert({
        showtime_id: this.showtimeId(),
        seat_id: butaca.id,
        user_id: user.id
      });
      if (error) {
        alert('Esta butaca acaba de ser reservada por otra persona.');
        this.butacas.update(lista => {
          const b = lista.find(item => item.id === butaca.id);
          if (b) b.estado = 'ocupada';
          return [...lista]; 
        });
      } else {
        this.myLockedSeatIds.push(butaca.id);
      }
    } else {
      this.myLockedSeatIds = this.myLockedSeatIds.filter(id => id !== butaca.id);
      await this.supabase.client.from('locked_seats').delete()
        .eq('showtime_id', this.showtimeId())
        .eq('seat_id', butaca.id)
        .eq('user_id', user.id);
    }
  }

  agregarAlCarrito() {
    if (this.butacasSeleccionadasCount() === 0) {
      alert('Debe seleccionar al menos una butaca');
      return;
    }
    
    const p = this.pelicula();
    const user = this.auth.usuarioActual();
    
    if (p && p.restriccion_edad && p.restriccion_edad > 0) {
      let userAge = 999;
      
      if (user && user.fecha_nacimiento) {
        const fechaNac = new Date(user.fecha_nacimiento);
        const hoy = new Date();
        userAge = hoy.getFullYear() - fechaNac.getFullYear();
        if (hoy.getMonth() < fechaNac.getMonth() || (hoy.getMonth() === fechaNac.getMonth() && hoy.getDate() < fechaNac.getDate())) {
          userAge--;
        }
      }

      if (user && userAge < p.restriccion_edad) {
        if (!confirm(`🔞 ATENCIÓN: Esta película es para mayores de ${p.restriccion_edad} años y vos tenés ${userAge}. ¿Confirmás que vas a asistir con un adulto responsable? El personal podría denegarte el acceso en la puerta.`)) {
          return;
        }
      } else if (!user) {
        if (!confirm(`🔞 ATENCIÓN: Esta película es para mayores de ${p.restriccion_edad} años. Al continuar como invitado, confirmás que cumplís con la edad mínima o asistirás con un adulto responsable.`)) {
          return;
        }
      }
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
