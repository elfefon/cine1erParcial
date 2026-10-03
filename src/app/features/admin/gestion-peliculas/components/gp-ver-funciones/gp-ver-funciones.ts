import { Component, inject, signal, computed } from '@angular/core';
import { PeliculasStateService } from '../../services/peliculas-state.service';
import { ModificarFuncion } from '../../../home/modificar-funcion/modificar-funcion';
import { CommonModule, DatePipe } from '@angular/common';

@Component({
  selector: 'app-gp-ver-funciones',
  standalone: true,
  imports: [ModificarFuncion, CommonModule],
  templateUrl: './gp-ver-funciones.html'
})
export class GpVerFuncionesComponent {
  state = inject(PeliculasStateService);
  
  filtro = signal('');
  funcionEdit = signal<any>(null);

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
    await this.state.registrarAccion('UPDATE_SHOWTIME');
  }
}
