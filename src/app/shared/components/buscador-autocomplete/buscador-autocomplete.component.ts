import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-buscador-autocomplete',
  standalone: true,
  template: `
    <input type="text" 
           class="search-bar" 
           [placeholder]="placeholder" 
           [attr.list]="listId"
           [value]="textoVisible"
           (input)="onInput($event)"
           style="margin-bottom: 0; flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-dark); color: white;">
           
    <datalist [id]="listId">
      @for (item of opciones; track item.id) {
        <option [value]="item.label"></option>
      }
    </datalist>
  `
})
export class BuscadorAutocompleteComponent implements OnChanges {
  @Input() listId: string = 'lista-default';
  @Input() placeholder: string = 'Buscar...';
  @Input() opciones: { id: string, label: string }[] = [];
  @Input() seleccionId: string = '';

  @Output() seleccionChange = new EventEmitter<string>();

  textoVisible: string = '';

  /**
   * Se ejecuta cuando cambian los inputs del componente.
   * Mantiene sincronizado el texto visible con el ID seleccionado externamente.
   * @param changes Cambios detectados por Angular
   */
  ngOnChanges(changes: SimpleChanges) {
    if (changes['seleccionId'] || changes['opciones']) {
      const match = this.opciones.find(o => o.id === this.seleccionId);
      if (match) {
        this.textoVisible = match.label;
      } else if (!this.seleccionId) {
        this.textoVisible = '';
      }
    }
  }

  /**
   * Se ejecuta cada vez que el usuario escribe en el input.
   * Busca si el texto coincide exactamente con alguna opción y emite el ID encontrado o vacío.
   * @param event El evento input
   */
  onInput(event: Event) {
    const texto = (event.target as HTMLInputElement).value;
    this.textoVisible = texto;
    const encontrado = this.opciones.find(o => o.label === texto);
    this.seleccionChange.emit(encontrado ? encontrado.id : '');
  }
}
