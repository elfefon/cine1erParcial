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
      const res = await this.supabase.client.from('tickets')
        .select(`
          *,
          seat_reservations(*, showtimes(*, movies(*)))
        `)
        .eq('codigo_venta', this.codigo().trim())
        .single();

      if (res.error || !res.data) {
        this.error.set('Ticket no encontrado o inválido.');
      } else {
        const ticket = res.data;
        if (ticket.estado === 'cancelado') {
          this.error.set('❌ ACCESO DENEGADO: El ticket está CANCELADO.');
        } else {
          // Verificar horario si es ticket de cine
          if (ticket.seat_reservations && ticket.seat_reservations.length > 0) {
             const sh = ticket.seat_reservations[0].showtimes;
             const showDate = new Date(sh.fecha_hora);
             const now = new Date();
             const diffMinutes = (showDate.getTime() - now.getTime()) / 60000;
             
             // Permitimos acceso desde 30 min antes hasta 60 min después
             if (diffMinutes > 30) {
               this.error.set(`❌ ACCESO DENEGADO: Es muy temprano para la función. La película comienza a las ${showDate.toLocaleTimeString()}`);
             } else if (diffMinutes < -60) {
               this.error.set(`❌ ACCESO DENEGADO: La función ya terminó o pasó el tiempo límite de ingreso.`);
             } else {
               this.resultado.set({
                 valido: true,
                 mensaje: '✅ ACCESO PERMITIDO (CINE)',
                 detalles: ticket
               });
             }
          } else {
            // Es un ticket solo de candy
            this.resultado.set({
               valido: true,
               mensaje: '🍬 TICKET DE CANDY BAR - VÁLIDO',
               detalles: ticket
            });
          }
        }
      }
    } catch (e) {
      this.error.set('Error en la base de datos al validar.');
    } finally {
      this.loading.set(false);
    }
  }
}
