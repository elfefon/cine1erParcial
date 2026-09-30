import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'traducirAccion',
  standalone: true
})
export class TraducirAccionPipe implements PipeTransform {
  transform(value: string): string {
    switch (value) {
      case 'CREATE_MOVIE': return 'Creó Película';
      case 'UPDATE_MOVIE': return 'Actualizó Película';
      case 'DELETE_MOVIE': return 'Eliminó Película';
      case 'CREATE_SHOWTIME': return 'Creó Función';
      case 'UPDATE_SHOWTIME': return 'Actualizó Función';
      case 'DELETE_SHOWTIME': return 'Eliminó Función';
      case 'CREATE_COMBO': return 'Creó Combo';
      case 'UPDATE_COMBO': return 'Actualizó Combo';
      case 'DELETE_COMBO': return 'Eliminó Combo';
      case 'CREATE_CANDY_PRODUCT': return 'Creó Producto Candy';
      case 'UPDATE_CANDY_PRODUCT': return 'Actualizó Producto Candy';
      case 'DELETE_CANDY_PRODUCT': return 'Eliminó Producto Candy';
      default: return value;
    }
  }
}
