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
      case 'CREATE_COMBO': return 'Creó Combo';
      case 'UPDATE_COMBO': return 'Actualizó Combo';
      case 'DELETE_COMBO': return 'Eliminó Combo';
      default: return value;
    }
  }
}
