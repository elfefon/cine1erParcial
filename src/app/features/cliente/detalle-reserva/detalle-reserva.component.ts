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
}
