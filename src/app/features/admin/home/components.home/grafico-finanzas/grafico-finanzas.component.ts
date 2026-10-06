import { Component, inject, OnInit, AfterViewInit } from '@angular/core';
import { SupabaseService } from '../../../../../core/services/supabase.service';
import { Chart, registerables } from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

Chart.register(...registerables);

@Component({
  selector: 'app-grafico-finanzas',
  standalone: true,
  styleUrls: ['./grafico-finanzas.component.css'],
  templateUrl: './grafico-finanzas.component.html'
})
export class GraficoFinanzasComponent implements OnInit, AfterViewInit {
  private supabase = inject(SupabaseService);
  datosGrafico: any[] = [];
  chart: Chart | null = null;
  filtroActual: string = 'Última Semana';

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.cargarGraficoFinanzas('semana');
  }

  async cargarGraficoFinanzas(filtro: 'dia' | 'semana' | 'mes' | 'año') {
    const fecha_fin = new Date();
    const fecha_inicio = new Date();

    switch (filtro) {
      case 'dia':
        fecha_inicio.setHours(0, 0, 0, 0);
        this.filtroActual = 'Hoy';
        break;
      case 'semana':
        fecha_inicio.setDate(fecha_fin.getDate() - 7);
        this.filtroActual = 'Última Semana';
        break;
      case 'mes':
        fecha_inicio.setDate(fecha_fin.getDate() - 30);
        this.filtroActual = 'Último Mes';
        break;
      case 'año':
        fecha_inicio.setDate(fecha_fin.getDate() - 365);
        this.filtroActual = 'Último Año';
        break;
    }

    const { data, error } = await this.supabase.client.rpc('obtener_facturacion', {
      fecha_inicio: fecha_inicio.toISOString(),
      fecha_fin: fecha_fin.toISOString()
    });

    if (error) {
      console.error('Error obteniendo facturación:', error);
      this.datosGrafico = [];
      this.renderizarGrafico();
      return;
    }

    console.log('Datos de facturación recibidos:', data);
    this.datosGrafico = data || [];
    this.renderizarGrafico();
  }

  renderizarGrafico() {
    if (this.chart) {
      this.chart.destroy();
    }

    const canvas = document.getElementById('finanzasChart') as HTMLCanvasElement;
    if (!canvas) return;

    const labels = this.datosGrafico.map(item => item.fecha_agrupada);
    const valores = this.datosGrafico.map(item => item.ingresos_totales);

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ingresos ($)',
          data: valores,
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgba(16, 185, 129, 1)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#a0aec0'
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#a0aec0'
            }
          }
        }
      }
    });
  }

  exportar(formato: 'pdf' | 'excel') {
    if (formato === 'pdf') {
      const doc = new jsPDF();
      doc.text(`Finanzas - ${this.filtroActual}`, 14, 15);
      const bodyData = this.datosGrafico.map(item => [item.fecha_agrupada, `$${item.ingresos_totales}`]);
      autoTable(doc, {
        head: [['Fecha', 'Ingresos']],
        body: bodyData,
        startY: 20
      });
      doc.save(`finanzas_${this.filtroActual}.pdf`);
    } else {
      const data = this.datosGrafico.map(item => ({
        'Fecha': item.fecha_agrupada,
        'Ingresos': item.ingresos_totales
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Finanzas');
      XLSX.writeFile(wb, `finanzas_${this.filtroActual}.xlsx`);
    }
  }
}
