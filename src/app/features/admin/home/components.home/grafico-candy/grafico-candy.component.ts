import { Component, inject, OnInit, AfterViewInit } from '@angular/core';
import { SupabaseService } from '../../../../../core/services/supabase.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-grafico-candy',
  standalone: true,
  styleUrls: ['./grafico-candy.component.css'],
  templateUrl: './grafico-candy.component.html'
})
export class GraficoCandyComponent implements OnInit, AfterViewInit {
  private supabase = inject(SupabaseService);
  datosGrafico: any[] = [];
  chart: Chart | null = null;
  filtroActual: string = 'Última Semana';

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.cargarGraficoCandy('semana');
  }

  async cargarGraficoCandy(filtro: 'dia' | 'semana' | 'mes' | 'año') {
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

    const { data, error } = await this.supabase.client.rpc('obtener_top_candy', {
      fecha_inicio: fecha_inicio.toISOString(),
      fecha_fin: fecha_fin.toISOString()
    });

    if (error) {
      console.error('Error obteniendo top candy:', error);
      return;
    }

    this.datosGrafico = data || [];
    this.renderizarGrafico();
  }

  renderizarGrafico() {
    if (this.chart) {
      this.chart.destroy();
    }

    const canvas = document.getElementById('topCandyChart') as HTMLCanvasElement;
    if (!canvas) return;

    const labels = this.datosGrafico.map(item => item.producto_nombre);
    const valores = this.datosGrafico.map(item => item.cantidad_vendida);

    this.chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: valores,
          backgroundColor: [
            'rgba(244, 63, 94, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(139, 92, 246, 0.8)'
          ],
          borderColor: '#1e1e2f',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#f1f5f9'
            }
          }
        }
      }
    });
  }

  exportar(formato: 'pdf' | 'excel') {
    console.log(`Exportando candy a: ${formato}`);
  }
}
