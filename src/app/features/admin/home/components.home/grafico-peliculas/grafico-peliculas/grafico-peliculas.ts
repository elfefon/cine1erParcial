import { Component, inject, OnInit, AfterViewInit } from '@angular/core';
import { SupabaseService } from '../../../../../../core/services/supabase.service';
import { Chart, registerables } from 'chart.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

Chart.register(...registerables);

@Component({
  imports: [],
  selector: 'app-grafico-peliculas',
  styleUrl: './grafico-peliculas.css',
  templateUrl: './grafico-peliculas.html',
})
export class GraficoPeliculas implements OnInit, AfterViewInit {
  private supabase = inject(SupabaseService);
  datosGraficoPeliculas: any[] = [];
  chart: Chart | null = null;
  filtroActual: string = 'Última Semana';

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    // Por defecto cargamos la semana
    this.cargarGraficoPeliculas('semana');
  }

  async cargarGraficoPeliculas(filtro: 'dia' | 'semana' | 'mes' | 'año') {
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

    const { data, error } = await this.supabase.client.rpc('obtener_top_peliculas', {
      fecha_inicio: fecha_inicio.toISOString(),
      fecha_fin: fecha_fin.toISOString()
    });

    if (error) {
      console.error('Error obteniendo top películas:', error);
      return;
    }

    this.datosGraficoPeliculas = data || [];
    this.renderizarGrafico();
  }

  renderizarGrafico() {
    if (this.chart) {
      this.chart.destroy();
    }

    const canvas = document.getElementById('topMoviesChart') as HTMLCanvasElement;
    if (!canvas) return;

    const labels = this.datosGraficoPeliculas.map(item => item.pelicula_nombre);
    const valores = this.datosGraficoPeliculas.map(item => item.entradas_vendidas);

    this.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Entradas Vendidas',
          data: valores,
          backgroundColor: 'rgba(99, 102, 241, 0.8)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 1,
          borderRadius: 4
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
      doc.text(`Top Películas - ${this.filtroActual}`, 14, 15);
      const bodyData = this.datosGraficoPeliculas.map(item => [item.pelicula_nombre, item.entradas_vendidas]);
      autoTable(doc, {
        head: [['Película', 'Entradas Vendidas']],
        body: bodyData,
        startY: 20
      });
      doc.save(`top_peliculas_${this.filtroActual}.pdf`);
    } else {
      const data = this.datosGraficoPeliculas.map(item => ({
        'Película': item.pelicula_nombre,
        'Entradas Vendidas': item.entradas_vendidas
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Películas');
      XLSX.writeFile(wb, `top_peliculas_${this.filtroActual}.xlsx`);
    }
  }
}
