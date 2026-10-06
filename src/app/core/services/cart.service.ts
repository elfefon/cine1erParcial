import { Injectable, signal, computed, effect } from '@angular/core';

export interface CartTicket {
  id_funcion: string;
  pelicula_nombre: string;
  butacas: string[];
  precioButaca: number;
  precioTotal: number;
  funcion_raw?: any;
  pelicula_raw?: any;
}

export interface CartCandy {
  producto: any;
  cantidad: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  tickets = signal<CartTicket[]>([]);
  candy = signal<CartCandy[]>([]);

  totalTickets = computed(() => this.tickets().reduce((sum, t) => sum + t.precioTotal, 0));
  totalCandy = computed(() => this.candy().reduce((sum, c) => sum + (c.producto.precio * c.cantidad), 0));
  totalGeneral = computed(() => this.totalTickets() + this.totalCandy());

  constructor() {
    // Restaurar desde localStorage si existe
    const savedTickets = localStorage.getItem('cineutn_cart_tickets');
    const savedCandy = localStorage.getItem('cineutn_cart_candy');
    
    if (savedTickets) {
      try { this.tickets.set(JSON.parse(savedTickets)); } catch (e) {}
    }
    if (savedCandy) {
      try { this.candy.set(JSON.parse(savedCandy)); } catch (e) {}
    }

    // Efecto para sincronizar con localStorage cuando los signals cambian
    effect(() => {
      localStorage.setItem('cineutn_cart_tickets', JSON.stringify(this.tickets()));
      localStorage.setItem('cineutn_cart_candy', JSON.stringify(this.candy()));
    });
  }

  addTickets(ticket: CartTicket) {
    this.tickets.update(t => [...t, ticket]);
  }

  removeTickets(index: number) {
    this.tickets.update(t => t.filter((_, i) => i !== index));
  }

  addCandy(producto: any, cantidad: number = 1) {
    this.candy.update(c => {
      const existingIndex = c.findIndex(item => item.producto.id === producto.id);
      if (existingIndex > -1) {
        const copy = [...c];
        copy[existingIndex].cantidad += cantidad;
        return copy;
      } else {
        return [...c, { producto, cantidad }];
      }
    });
  }

  removeCandy(productoId: string) {
    this.candy.update(c => c.filter(item => item.producto.id !== productoId));
  }

  updateCandyQuantity(productoId: string, cantidad: number) {
    if (cantidad <= 0) {
      this.removeCandy(productoId);
      return;
    }
    this.candy.update(c => {
      const copy = [...c];
      const index = copy.findIndex(item => item.producto.id === productoId);
      if (index > -1) {
        copy[index].cantidad = cantidad;
      }
      return copy;
    });
  }

  clearCart() {
    this.tickets.set([]);
    this.candy.set([]);
  }
}
