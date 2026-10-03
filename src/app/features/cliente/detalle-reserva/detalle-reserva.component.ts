import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-detalle-reserva',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './detalle-reserva.component.html',
  styleUrl: './detalle-reserva.component.css'
})
export class DetalleReservaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private supabase = inject(SupabaseService);

  ticketId = signal<string>('');
  ticket = signal<any>(null);
  loading = signal(true);

  async ngOnInit() {
    this.ticketId.set(this.route.snapshot.paramMap.get('id') || '');
    if (this.ticketId()) {
      await this.cargarDetalle();
    }
  }

  async cargarDetalle() {
    try {
      const { data, error } = await this.supabase.client
        .from('tickets')
        .select(`
          *,
          seat_reservations(
            *,
            showtimes(
              *,
              movies(nombre, imagen_url, imagen_apaisada_url),
              rooms(nombre)
            ),
            seats(numero_butaca)
          ),
          ticket_candy_items(
            cantidad,
            precio_unitario,
            candy_products(nombre, imagen_url)
          )
        `)
        .eq('id', this.ticketId())
        .single();

      if (data) {
        this.ticket.set(data);
      } else {
        console.error('No se encontró el ticket', error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  puedeCancelar(): boolean {
    const t = this.ticket();
    if (!t || t.estado === 'cancelado') return false;
    
    // Solo permitir cancelar si tiene al menos 1 película. (Candy solo no se cancela)
    if (!t.seat_reservations || t.seat_reservations.length === 0) return false;
    
    const showtimeStr = t.seat_reservations[0].showtimes?.fecha_hora;
    if (!showtimeStr) return false;
    
    const showtimeDate = new Date(showtimeStr);
    const now = new Date();
    const diffHours = (showtimeDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return diffHours >= 2;
  }

  async cancelarReserva() {
    if (!confirm('¿Estás seguro de que querés cancelar esta reserva? El dinero se acreditará a tu saldo a favor automáticamente.')) {
      return;
    }
    this.loading.set(true);
    
    try {
      const t = this.ticket();
      const devolucion = t.total_pagado || 0;
      
      // 1. Marcar ticket como cancelado
      await this.supabase.client.from('tickets').update({ estado: 'cancelado' }).eq('id', t.id);
      
      // 2. Liberar butacas (borrar de seat_reservations)
      await this.supabase.client.from('seat_reservations').delete().eq('ticket_id', t.id);
      
      // 3. Sumar saldo al usuario
      if (devolucion > 0) {
        const { data: profile } = await this.supabase.client.from('profiles').select('credito_saldo').eq('id', t.user_id).single();
        const saldoActual = profile?.credito_saldo || 0;
        await this.supabase.client.from('profiles').update({ credito_saldo: saldoActual + devolucion }).eq('id', t.user_id);
      }
      
      alert(`Reserva cancelada. Se han devuelto $${devolucion} a tu saldo a favor.`);
      await this.cargarDetalle();
    } catch (e) {
      console.error(e);
      alert('Error al cancelar reserva.');
    } finally {
      this.loading.set(false);
    }
  }
}
