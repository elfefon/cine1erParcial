import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ButacaItem {
  id: string;
  numero_butaca: string;
  fila: string; // "A" hasta "T"
  columna: number; // 1 hasta 30
  tipo_butaca: string; // "general", "discapacitado", "vip"
  ocupada: boolean;
}

@Component({
  selector: 'app-mapa-butacas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa-butacas.component.html',
  styleUrl: './mapa-butacas.component.css'
})
export class MapaButacasComponent {
  @Input({ required: true }) butacas: ButacaItem[] = [];
  @Input() butacasSeleccionadasIds: string[] = [];

  @Output() seleccionarButaca = new EventEmitter<ButacaItem>();

  obtenerFila(filaLetra: string): number {
    const letra = (filaLetra || '').trim().toUpperCase();
    if (!letra) return 1;
    // Letras de A a Z -> 1 a 26
    const code = letra.charCodeAt(0) - 64;
    return code > 0 ? code : 1;
  }



  isSeleccionada(id: string): boolean {
    return this.butacasSeleccionadasIds.includes(id);
  }

  determinarCategoria(butaca: ButacaItem): 'vip' | 'discapacitado' | 'general' {
    const letra = (butaca.fila || '').trim().toUpperCase();
    const tipo = (butaca.tipo_butaca || '').toLowerCase();

    if (['R', 'S', 'T'].includes(letra) || tipo === 'vip') {
      return 'vip';
    }
    if (letra === 'J' || tipo === 'discapacitado') {
      return 'discapacitado';
    }
    return 'general';
  }

  onButacaClick(butaca: ButacaItem): void {
    if (butaca.ocupada) return;
    this.seleccionarButaca.emit(butaca);
  }
}
