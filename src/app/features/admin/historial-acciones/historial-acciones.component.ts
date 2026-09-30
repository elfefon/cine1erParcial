import { Component, inject, signal, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Accion } from '../../../models/accion.interface';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { TraducirAccionPipe } from '../../../shared/pipes/traducir-accion.pipe';

@Component({
  selector: 'app-historial-acciones',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, TraducirAccionPipe],
  templateUrl: './historial-acciones.component.html',
  styleUrl: './historial-acciones.component.css'
})
export class HistorialAccionesComponent implements OnInit {
  private supabase = inject(SupabaseService);
  historial = signal<Accion[]>([]);

  async ngOnInit() {
    await this.cargarDatos();
  }

  async cargarDatos() {
    const { data, error } = await this.supabase.client
      .from('activity_logs')
      .select('*, profiles(role, nombre)')
      .order('fecha_hora', { ascending: false });
    
    if (error) {
      console.error('Error fetching activity logs:', error);
      // Try fallback without profiles in case of relation error
      const fallback = await this.supabase.client.from('activity_logs').select('*').order('fecha_hora', { ascending: false });
      if (fallback.data) this.historial.set(fallback.data as any[]);
    } else if (data) {
      this.historial.set(data as any[]);
    }
  }
}
