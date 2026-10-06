import { Component, inject, signal, OnInit } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Accion } from '../../../models/accion.interface';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { TraducirAccionPipe } from '../../../shared/pipes/traducir-accion.pipe';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

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

  exportToPdf() {
    const doc = new jsPDF();
    doc.text('Historial de Acciones - CineUTN', 14, 15);
    const bodyData = this.historial().map(h => [
      new Date(h.fecha_hora).toLocaleString(),
      h.profiles?.nombre || 'Desconocido',
      h.profiles?.role || 'N/A',
      h.accion,
      h.entidad_afectada
    ]);
    (doc as any).autoTable({
      head: [['Fecha/Hora', 'Usuario', 'Rol', 'Acción', 'Entidad']],
      body: bodyData,
      startY: 20
    });
    doc.save('historial_acciones.pdf');
  }

  exportToExcel() {
    const data = this.historial().map(h => ({
      'Fecha/Hora': new Date(h.fecha_hora).toLocaleString(),
      'Usuario': h.profiles?.nombre || 'Desconocido',
      'Rol': h.profiles?.role || 'N/A',
      'Acción': h.accion,
      'Entidad': h.entidad_afectada
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial');
    XLSX.writeFile(wb, 'historial_acciones.xlsx');
  }
}
