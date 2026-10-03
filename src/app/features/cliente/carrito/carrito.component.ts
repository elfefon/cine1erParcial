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
    let emailComprador = '';
    let userId = null;

    if (!usuario) {
      const email = prompt('Estás comprando como invitado. Por favor, ingresá tu email para enviarte los tickets:');
      if (!email) return;
      if (!email.includes('@')) {
        alert('Email inválido.');
        return;
      }
      emailComprador = email;
    } else {
      userId = usuario.id;
      emailComprador = usuario.email || '';
    }

    let total = this.cart.totalGeneral();
    const puntosUsuario = usuario?.puntos || 0;
    const saldoUsuario = usuario?.credito_saldo || 0;
    
    let saldoUsado = 0;
    if (usuario && saldoUsuario > 0) {
      if (confirm(`Tenés un saldo a favor de $${saldoUsuario}. ¿Querés descontarlo del total de tu compra ($${total})?`)) {
        if (saldoUsuario >= total) {
          saldoUsado = total;
          total = 0;
        } else {
          saldoUsado = saldoUsuario;
          total -= saldoUsuario;
        }
      }
    }

    let usaPuntos = false;
    if (usuario && total > 0 && puntosUsuario >= total) {
      usaPuntos = confirm(`🎁 ¡Tenés ${puntosUsuario} puntos acumulados! ¿Querés usarlos para pagar el resto de tu compra ($${total})?`);
      if (usaPuntos) {
        total = 0;
      }
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
        
        // Proporción del saldo usado para este ticket si son varios
        let prop = 1;
        if (this.cart.totalGeneral() > 0 && saldoUsado > 0) {
          prop = subtotalTicket / this.cart.totalGeneral();
        }
        const descuentoSaldo = saldoUsado * prop;
        const totalParaTicket = usaPuntos ? 0 : Math.max(0, subtotalTicket - descuentoSaldo);
        const puntosTicket = (usaPuntos || totalParaTicket === 0) ? 0 : Math.floor(totalParaTicket / 5);
        totalPuntosAGenerar += puntosTicket;

        const qrData = JSON.stringify({
          codigo: codigoVenta,
          user_id: userId,
          email: emailComprador,
          showtime_id: t.id_funcion,
          seats: t.butacas,
          total: totalParaTicket
        });

        const payloadTicket = {
          user_id: userId, // si es anonimo queda null
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
            user_id: userId,
            email: emailComprador,
            total: this.cart.totalCandy(),
            is_candy_only: true
          });

          const subtotalCandy = this.cart.totalCandy();
          
          let prop = 1;
          if (this.cart.totalGeneral() > 0 && saldoUsado > 0) {
            prop = subtotalCandy / this.cart.totalGeneral();
          }
          const descuentoSaldo = saldoUsado * prop;
          
          const totalCandyPagado = usaPuntos ? 0 : Math.max(0, subtotalCandy - descuentoSaldo);
          const puntosCandy = (usaPuntos || totalCandyPagado === 0) ? 0 : Math.floor(totalCandyPagado / 5);
          totalPuntosAGenerar += puntosCandy;

          const payloadTicket = {
            user_id: userId,
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
      
      // Actualizar saldo a favor
      if (usuario && saldoUsado > 0) {
        const nuevoSaldo = saldoUsuario - saldoUsado;
        await this.supabase.client.from('profiles').update({ credito_saldo: nuevoSaldo }).eq('id', usuario.id);
        this.auth.usuarioActual.update(u => u ? { ...u, credito_saldo: nuevoSaldo } : null);
      }
      
      // Actualizar puntos del usuario en Supabase y localmente
      if (usuario) {
        if (usaPuntos) {
          const costoEnPuntos = this.cart.totalGeneral() - saldoUsado;
          const nuevosPuntos = puntosUsuario - costoEnPuntos;
          await this.supabase.client.from('profiles').update({ puntos: nuevosPuntos }).eq('id', usuario.id);
          this.auth.usuarioActual.update(u => u ? { ...u, puntos: nuevosPuntos } : null);
        } else if (totalPuntosAGenerar > 0) {
          const nuevosPuntos = puntosUsuario + totalPuntosAGenerar;
          await this.supabase.client.from('profiles').update({ puntos: nuevosPuntos }).eq('id', usuario.id);
          this.auth.usuarioActual.update(u => u ? { ...u, puntos: nuevosPuntos } : null);
        }
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
