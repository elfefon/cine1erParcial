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
      case 'CANCEL_SHOWTIME': return 'Canceló Función (Reembolso Masivo)';
      case 'CREATE_COMBO': return 'Creó Combo';
      case 'UPDATE_COMBO': return 'Actualizó Combo';
      case 'DELETE_COMBO': return 'Eliminó Combo';
      case 'CREATE_CANDY_PRODUCT': return 'Creó Producto Candy';
      case 'UPDATE_CANDY_PRODUCT': return 'Actualizó Producto Candy';
      case 'DELETE_CANDY_PRODUCT': return 'Eliminó Producto Candy';
      case 'ACCEPT_MOVIE_PROPOSAL': return 'Aceptó Propuesta de Película';
      case 'REJECT_MOVIE_PROPOSAL': return 'Rechazó Propuesta de Película';
      case 'UPDATE_USER_ROLE': return 'Asignó Rol a Usuario';
      default: return value;
    }
  }
}
