import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { PeliculasStateService } from '../../services/peliculas-state.service';
import { ModificarFuncion } from '../../../home/modificar-funcion/modificar-funcion';
import { CommonModule } from '@angular/common';
import { WaitlistService } from '../../../../../core/services/waitlist.service';
import { ToastService } from '../../../../../core/services/toast.service';

@Component({
  selector: 'app-gp-ver-funciones',
  standalone: true,
  imports: [ModificarFuncion, CommonModule],
  templateUrl: './gp-ver-funciones.html'
})
export class GpVerFuncionesComponent implements OnInit {
  state = inject(PeliculasStateService);
  waitlistService = inject(WaitlistService);
  private toastService = inject(ToastService);
  
  filtro = signal('');
  funcionEdit = signal<any>(null);
  conteoEspera = signal<Record<string, number>>({});
  cancelandoId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const funcs = this.state.funciones();
      if (funcs.length > 0) {
        this.cargarConteosEspera(funcs.map(f => f.id));
      }
    });
  }

  async ngOnInit() {
    const funcs = this.state.funciones();
    if (funcs.length > 0) {
      await this.cargarConteosEspera(funcs.map(f => f.id));
    }
  }

  async cargarConteosEspera(ids: string[]) {
    const conteos = await this.waitlistService.obtenerConteoEsperaPorFunciones(ids);
    this.conteoEspera.set(conteos);
  }

  filtradas = computed(() => {
    const s = this.filtro().toLowerCase();
    if (!s) return this.state.funciones();
    return this.state.funciones().filter(f => 
      f.movies?.nombre?.toLowerCase().includes(s) || f.rooms?.nombre?.toLowerCase().includes(s)
    );
  });

  onBuscar(e: Event) { this.filtro.set((e.target as HTMLInputElement).value); }
  
  async onSaved() {
    this.funcionEdit.set(null);
    await this.state.cargarFunciones();
    const funcs = this.state.funciones();
    await this.cargarConteosEspera(funcs.map(f => f.id));
    await this.state.registrarAccion('UPDATE_SHOWTIME');
  }

  async cancelarFuncionCompleta(funcion: any) {
    const motivo = prompt(
      `¿Seguro que deseás CANCELAR la función de "${funcion.movies?.nombre}" (${funcion.rooms?.nombre})?\n\n` +
      `Se acreditará de forma ATÓMICA el 100% del monto (entradas + candy) a todos los compradores, se liberarán las butacas y se les notificará para reubicarse en otra función.\n\n` +
      `Ingresá el motivo de la cancelación:`,
      'Problema técnico en la sala'
    );
    if (motivo === null) return;

    this.cancelandoId.set(funcion.id);
    try {
      const res = await this.waitlistService.cancelarFuncionCompletaPorCine(
        funcion.id,
        motivo.trim() || 'Problema técnico en la sala'
      );
      if (res.ok) {
        this.toastService.success(res.mensaje);
        await this.state.cargarFunciones();
      } else {
        this.toastService.error(res.mensaje);
      }
    } finally {
      this.cancelandoId.set(null);
    }
  }
}
