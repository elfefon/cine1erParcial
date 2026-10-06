import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scanner.html',
  styleUrl: './scanner.css'
})
export class ScannerComponent {
  private supabase = inject(SupabaseService);
  
  codigo = signal('');
  loading = signal(false);
  resultado = signal<any>(null);
  error = signal('');

  async escanear() {
    if (!this.codigo().trim()) return;
    
    this.loading.set(true);
    this.resultado.set(null);
    this.error.set('');

    try {
      // 1. Llamar a la RPC
      const { data, error } = await this.supabase.client.rpc('validar_qr', { p_codigo: this.codigo().trim() });
      
      if (error) {
        this.error.set(error.message || 'Error validando ticket.');
        this.loading.set(false);
        return;
      }

      if (!data.success) {
        if (data.reason === 'already_used') {
          this.error.set('❌ ACCESO DENEGADO: El ticket ya fue utilizado.');
        } else if (data.reason === 'cancelled') {
          this.error.set('❌ ACCESO DENEGADO: El ticket está CANCELADO.');
        } else if (data.reason === 'too_early') {
          this.error.set(`❌ ACCESO DENEGADO: Es muy temprano para la función. La película comienza a las ${new Date(data.showtime).toLocaleTimeString()}`);
        } else if (data.reason === 'too_late') {
          this.error.set(`❌ ACCESO DENEGADO: La función ya terminó o pasó el tiempo límite de ingreso.`);
        } else {
          this.error.set('❌ ACCESO DENEGADO: Ticket no encontrado o inválido.');
        }
        this.loading.set(false);
        return;
      }

      // 2. Si fue exitoso, traemos los datos adicionales para mostrarlos
      const res = await this.supabase.client.from('tickets')
        .select(`
          *,
          seat_reservations(*, showtimes(*, movies(*))),
          ticket_candy_items(*)
        `)
        .eq('id', data.ticket_id)
        .single();

      if (res.data) {
        const ticket = res.data;
        if (ticket.seat_reservations && ticket.seat_reservations.length > 0) {
          this.resultado.set({
            valido: true,
            mensaje: '✅ ACCESO PERMITIDO (CINE)',
            detalles: ticket
          });
        } else if (ticket.ticket_candy_items && ticket.ticket_candy_items.length > 0) {
          // Candy Bar verificado (T3.4)
          this.resultado.set({
            valido: true,
            mensaje: '🍬 TICKET DE CANDY BAR - VÁLIDO',
            detalles: ticket
          });
        } else {
          this.resultado.set({
             valido: true,
             mensaje: '✅ TICKET VÁLIDO (SIN DETALLES)',
             detalles: ticket
          });
        }
      }
    } catch (e) {
      this.error.set('Error en la base de datos al validar.');
    } finally {
      this.loading.set(false);
    }
  }
}
