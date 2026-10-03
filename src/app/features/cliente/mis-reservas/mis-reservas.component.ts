import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './mis-reservas.component.html',
  styleUrl: './mis-reservas.component.css'
})
export class MisReservasComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);

  tickets = signal<any[]>([]);
  loading = signal(true);

  async ngOnInit() {
    await this.cargarTickets();
  }

  async cargarTickets() {
    const user = this.auth.usuarioActual();
    if (!user) {
      this.loading.set(false);
      return;
    }

    try {
      // Intentamos traer todo relacionado
      const { data, error } = await this.supabase.client
        .from('tickets')
        .select(`
          *,
          seat_reservations(
            *,
            showtimes(
              *,
              movies(nombre, imagen_url),
              rooms(nombre)
            )
          ),
          ticket_candy_items(
            *,
            candy_products(nombre, imagen_url)
          )
        `)
        .eq('user_id', user.id)
        .order('fecha_compra', { ascending: false });

      if (error) {
        console.error('Error fetching tickets:', error);
      } else {
        // Post-procesar para simplificar la tarjeta
        const procesados = (data || []).map((t: any) => {
          const titulo = `Ticket - N° ${t.codigo_venta}`;
          let imagen = '';

          const hasMovie = t.seat_reservations && t.seat_reservations.length > 0;
          const hasCandy = t.ticket_candy_items && t.ticket_candy_items.length > 0;

          // Obtener la imagen priorizando la de la peli
          if (hasMovie) {
            imagen = t.seat_reservations[0].showtimes?.movies?.imagen_apaisada_url || t.seat_reservations[0].showtimes?.movies?.imagen_url || '';
          } else if (hasCandy && t.ticket_candy_items[0].candy_products) {
            imagen = t.ticket_candy_items[0].candy_products.imagen_url || '';
          }

          return { ...t, titulo, imagen };
        });

        this.tickets.set(procesados);
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }


}
