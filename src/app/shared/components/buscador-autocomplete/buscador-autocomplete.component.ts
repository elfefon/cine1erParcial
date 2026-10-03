import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-buscador-autocomplete',
  standalone: true,
  template: `
    <input type="text" 
           class="search-bar" 
           [placeholder]="placeholder" 
           [attr.list]="listId"
           [value]="getLabelFromId(seleccionId)"
           (change)="onSeleccion($event)"
           style="margin-bottom: 0; flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-dark); color: white;">
           
    <datalist [id]="listId">
      @for (item of opciones; track item.id) {
        <option [value]="item.label"></option>
      }
    </datalist>
  `
})
export class BuscadorAutocompleteComponent {
  @Input() listId: string = 'lista-default';
  @Input() placeholder: string = 'Buscar...';
  @Input() opciones: { id: string, label: string }[] = [];
  @Input() seleccionId: string = '';

  @Output() seleccionChange = new EventEmitter<string>();

  onSeleccion(event: Event) {
    const texto = (event.target as HTMLInputElement).value;
    const encontrado = this.opciones.find(o => o.label === texto);
    
    this.seleccionChange.emit(encontrado ? encontrado.id : '');
  }

  getLabelFromId(id: string): string {
    return this.opciones.find(o => o.id === id)?.label || '';
  }
}
