import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
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
  cuponCodigo = signal('');

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
      const ticketsPayload = this.cart.tickets().map(t => ({
        showtime_id: t.id_funcion,
        pelicula_nombre: t.pelicula_nombre,
        butacas: t.butacas,
        precioTotal: t.precioTotal,
        precioButaca: t.precioButaca,
        room_id: t.funcion_raw?.room_id,
        id_pelicula: t.pelicula_raw?.id
      }));

      const candyPayload = this.cart.candy().map(c => ({
        product_id: c.producto.id,
        cantidad: c.cantidad,
        precio_unitario: c.producto.precio
      }));

      const payload = {
        p_user_id: userId,
        p_email_invitado: emailComprador,
        p_tickets: ticketsPayload,
        p_candy: candyPayload,
        p_usa_saldo: saldoUsado > 0,
        p_usa_puntos: usaPuntos,
        p_cupon_codigo: this.cuponCodigo().trim() || null,
        p_idempotency_key: Date.now().toString() + '-' + Math.random().toString(36).substring(2)
      };

      const { data, error } = await this.supabase.client.rpc('comprar_checkout', payload);

      if (error) {
        throw error;
      }

      // Actualizar state local (si usuario autenticado)
      // Idealmente recargar desde base, o calcular aca, por ahora asumimos que la RPC maneja todo, recargamos la sesion:
      if (usuario) {
        const { data: profile } = await this.supabase.client.from('profiles').select('*').eq('id', usuario.id).single();
        if (profile) {
          this.auth.usuarioActual.set(profile as any);
        }
      }

      this.mensajeExito.set('¡Compra confirmada con éxito!');
      this.cart.clearCart();
      
      setTimeout(() => {
        this.router.navigate(['/cartelera']);
      }, 3000);
      
    } catch (e: any) {
      console.error(e);
      // T9.1 usar alert/toast (por ahora mantendremos simple pero capturando el mensaje real)
      alert(e.message || 'Error al procesar la compra');
    } finally {
      this.loading.set(false);
    }
  }
}
