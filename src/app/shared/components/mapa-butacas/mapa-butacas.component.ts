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

  // Mapa de filas A-T a índices de grid (1 a 20).
  // La fila K no existe físicamente, por lo que la fila 11 queda vacía como pasillo central.
  private filaGridMap: Record<string, number> = {
    'A': 1,
    'B': 2,
    'C': 3,
    'D': 4,
    'E': 5,
    'F': 6,
    'G': 7,
    'H': 8,
    'I': 9,
    'J': 10,
    // Fila 11: Pasillo horizontal central (sin fila física)
    'L': 12,
    'M': 13,
    'N': 14,
    'O': 15,
    'P': 16,
    'Q': 17,
    'R': 18,
    'S': 19,
    'T': 20
  };

  obtenerFila(filaLetra: string): number {
    const letra = (filaLetra || '').trim().toUpperCase();
    return this.filaGridMap[letra] ?? 1;
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
