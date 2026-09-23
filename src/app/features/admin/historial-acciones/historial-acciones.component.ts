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
    await this.cargarHistorial();
  }

  async cargarHistorial() {
    const data = await this.supabase.getTableData<Accion>('historial_acciones');
    this.historial.set(data);
  }
}
