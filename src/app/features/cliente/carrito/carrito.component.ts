import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carrito.component.html',
  styleUrl: './carrito.component.css'
})
export class CarritoComponent {
  cart = inject(CartService);
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  mensajeExito = signal('');

  actualizarCantidadCandy(id: string, cant: number) {
    this.cart.updateCandyQuantity(id, cant);
  }

  removerCandy(id: string) {
    this.cart.removeCandy(id);
  }

  removerTickets(index: number) {
    this.cart.removeTickets(index);
  }

  async confirmarCompra() {
    if (this.cart.totalGeneral() === 0) {
      alert('El carrito está vacío');
      return;
    }

    if (this.cart.tickets().length === 0 && this.cart.candy().length > 0) {
      alert('No podés comprar solo productos del Candy Bar sin una entrada de cine.');
      return;
    }

    const usuario = this.auth.usuarioActual();
    if (!usuario) {
      this.router.navigate(['/login']);
      return;
    }

    const total = this.cart.totalGeneral();
    const puntosUsuario = usuario.puntos || 0;
    let usaPuntos = false;

    if (puntosUsuario >= total) {
      usaPuntos = confirm(`🎁 ¡Tenés ${puntosUsuario} puntos acumulados! ¿Querés usarlos para pagar el total de tu compra ($${total})?`);
    }

    this.loading.set(true);

    try {
      const tickets = this.cart.tickets();
      let mainTicketId: string | null = null;
      let totalPuntosAGenerar = 0;
      
      // Proceso tickets de cine
      for (let i = 0; i < tickets.length; i++) {
        const t = tickets[i];
        const randomCode = Math.random().toString(36).substring(2, 9).toUpperCase();
        const codigoVenta = `TKT-${Date.now()}-${randomCode}`;
        
        const subtotalTicket = t.precioTotal + (i === 0 ? this.cart.totalCandy() : 0);
        const totalParaTicket = usaPuntos ? 0 : subtotalTicket;
        const puntosTicket = usaPuntos ? 0 : Math.floor(subtotalTicket / 5);
        totalPuntosAGenerar += puntosTicket;

        const qrData = JSON.stringify({
          codigo: codigoVenta,
          user_id: usuario.id,
          showtime_id: t.id_funcion,
          seats: t.butacas,
          total: totalParaTicket
        });

        const payloadTicket = {
          user_id: usuario.id,
          total_pagado: totalParaTicket,
          puntos_generados: puntosTicket,
          codigo_venta: codigoVenta,
          qr_codigo: qrData,
          estado: 'valido',
          fecha_compra: new Date().toISOString()
        };

        const ticketInsertado = await this.supabase.insertData<any>('tickets', payloadTicket);
        if (i === 0) mainTicketId = ticketInsertado.id;

        // Fetch seat IDs to reserve them
        const resSeats = await this.supabase.client.from('seats').select('*').eq('room_id', t.funcion_raw.room_id).in('numero_butaca', t.butacas);
        if (resSeats.data) {
          const reservasPayload = resSeats.data.map((seat: any) => ({
            showtime_id: t.id_funcion,
            ticket_id: ticketInsertado.id,
            tipo_butaca: seat.tipo_butaca,
            precio_pagado: t.precioButaca,
            seat_id: seat.id
          }));
          await this.supabase.client.from('seat_reservations').insert(reservasPayload);
        }

        // Actualizar ventas pelicula
        if (t.pelicula_raw) {
          const ventasActuales = t.pelicula_raw.ventas_totales || 0;
          await this.supabase.client.from('movies').update({ ventas_totales: ventasActuales + t.butacas.length }).eq('id', t.pelicula_raw.id);
        }
      }

      // Proceso Candy
      if (this.cart.candy().length > 0) {
        if (!mainTicketId) {
          // Compra exclusiva de Candy (sin tickets de cine)
          const randomCode = Math.random().toString(36).substring(2, 9).toUpperCase();
          const codigoVenta = `CANDY-${Date.now()}-${randomCode}`;
          const qrData = JSON.stringify({
            codigo: codigoVenta,
            user_id: usuario.id,
            total: this.cart.totalCandy(),
            is_candy_only: true
          });

          const subtotalCandy = this.cart.totalCandy();
          const totalCandyPagado = usaPuntos ? 0 : subtotalCandy;
          const puntosCandy = usaPuntos ? 0 : Math.floor(subtotalCandy / 5);
          totalPuntosAGenerar += puntosCandy;

          const payloadTicket = {
            user_id: usuario.id,
            total_pagado: totalCandyPagado,
            puntos_generados: puntosCandy,
            codigo_venta: codigoVenta,
            qr_codigo: qrData,
            estado: 'valido',
            fecha_compra: new Date().toISOString()
          };

          const ticketInsertado = await this.supabase.insertData<any>('tickets', payloadTicket);
          mainTicketId = ticketInsertado.id;
        }

        const candyPayload = this.cart.candy().map(c => ({
          ticket_id: mainTicketId,
          product_id: c.producto.id,
          cantidad: c.cantidad,
          precio_unitario: c.producto.precio
        }));

        await this.supabase.client.from('ticket_candy_items').insert(candyPayload);
      }
      
      // Actualizar puntos del usuario en Supabase y localmente
      if (usaPuntos) {
        const nuevosPuntos = puntosUsuario - total;
        await this.supabase.client.from('profiles').update({ puntos: nuevosPuntos }).eq('id', usuario.id);
        this.auth.usuarioActual.update(u => u ? { ...u, puntos: nuevosPuntos } : null);
      } else if (totalPuntosAGenerar > 0) {
        const nuevosPuntos = puntosUsuario + totalPuntosAGenerar;
        await this.supabase.client.from('profiles').update({ puntos: nuevosPuntos }).eq('id', usuario.id);
        this.auth.usuarioActual.update(u => u ? { ...u, puntos: nuevosPuntos } : null);
      }

      this.mensajeExito.set('¡Compra confirmada con éxito!');
      this.cart.clearCart();
      
      setTimeout(() => {
        this.router.navigate(['/cartelera']);
      }, 3000);
      
    } catch (e) {
      console.error(e);
      alert('Error al procesar la compra');
    } finally {
      this.loading.set(false);
    }
  }
}
