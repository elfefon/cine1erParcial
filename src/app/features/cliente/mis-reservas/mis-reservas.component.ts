import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [CommonModule],
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
        // Post-procesar para agrupar
        const procesados = (data || []).map((t: any) => {
          let tipo = 'Desconocido';
          let titulo = '';
          let imagen = '';
          let extra = '';

          const hasMovie = t.seat_reservations && t.seat_reservations.length > 0;
          const hasCandy = t.ticket_candy_items && t.ticket_candy_items.length > 0;

          if (hasMovie && hasCandy) {
            tipo = 'Película + Candy';
          } else if (hasMovie) {
            tipo = 'Película';
          } else if (hasCandy) {
            tipo = 'Candy Bar';
          }

          if (hasMovie) {
            const firstRes = t.seat_reservations[0];
            const movie = firstRes.showtimes?.movies;
            titulo = movie?.nombre || 'Película Desconocida';
            imagen = movie?.imagen_url || '';
            extra = `Función: ${new Date(firstRes.showtimes?.fecha_hora).toLocaleString()} - ${t.seat_reservations.length} Butaca(s)`;
          } else if (hasCandy) {
            titulo = 'Compra en Candy Bar';
            extra = `${t.ticket_candy_items.length} producto(s)`;
            // Usamos imagen del primer producto si existe
            if (t.ticket_candy_items[0].candy_products) {
              imagen = t.ticket_candy_items[0].candy_products.imagen_url;
            }
          }

          return { ...t, tipo, titulo, imagen, extra };
        });

        this.tickets.set(procesados);
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  parseQR(qrString: string): any {
    try {
      return JSON.parse(qrString);
    } catch {
      return null;
    }
  }
}
