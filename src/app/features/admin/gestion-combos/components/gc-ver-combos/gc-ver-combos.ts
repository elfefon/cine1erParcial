import { Component, inject, signal, computed } from '@angular/core';
import { CombosStateService } from '../../services/combos-state.service';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../../core/services/supabase.service';

@Component({
  selector: 'app-gc-ver-combos',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './gc-ver-combos.html'
})
export class GcVerCombosComponent {
  state = inject(CombosStateService);
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);

  filtro = signal('');
  
  filtrados = computed(() => {
    const s = this.filtro().toLowerCase();
    if (!s) return this.state.combos();
    return this.state.combos().filter(c => c.nombre.toLowerCase().includes(s));
  });

  onBuscar(e: Event) { this.filtro.set((e.target as HTMLInputElement).value); }

  comboEditando = signal<any | null>(null);
  comboEditForm = this.fb.nonNullable.group({
    id: [''], nombre: ['', Validators.required], precio: [0, [Validators.required, Validators.min(0)]]
  });

  productosEdit = signal<any[]>([]);
  filtroProd = signal('');

  disponibles = computed(() => {
    const s = this.filtroProd().toLowerCase();
    if (!s) return this.state.productos();
    return this.state.productos().filter(p => p.nombre.toLowerCase().includes(s));
  });

  /**
   * Filtra los productos disponibles para agregar al combo basándose en el input local del modal.
   * @param e Evento del input
   */
  onBuscarProd(e: Event) { this.filtroProd.set((e.target as HTMLInputElement).value); }

  /**
   * Agrega un nuevo producto a la lista temporal del combo que se está editando.
   * @param p Producto a agregar
   */
  agregar(p: any) { this.productosEdit.update(l => [...l, p]); }

  /**
   * Elimina un producto de la lista temporal del combo que se está editando por su índice.
   * @param index Posición a eliminar
   */
  quitar(index: number) { this.productosEdit.update(l => { const n = [...l]; n.splice(index, 1); return n; }); }

  /**
   * Abre el modal de edición y precarga el formulario con los datos del combo.
   * @param c El combo seleccionado para editar
   */
  abrirModificar(c: any) {
    this.comboEditando.set(c);
    this.productosEdit.set(c.productos_incluidos || []);
    this.comboEditForm.patchValue({ id: c.id, nombre: c.nombre, precio: c.precio });
  }

  /**
   * Cierra el modal de edición.
   */
  cerrarModificar() { this.comboEditando.set(null); }

  /**
   * Guarda las modificaciones realizadas al combo en la base de datos de Supabase.
   * Actualiza el nombre, precio, productos incluidos y el costo en puntos (calculado automáticamente a 1/5 del precio).
   */
  async guardarModificacion() {
    if (this.comboEditForm.valid && this.productosEdit().length > 0) {
      const data = this.comboEditForm.getRawValue();
      await this.supabase.client.from('candy_products').update({
        nombre: data.nombre, precio: data.precio,
        costo_puntos: Math.floor(data.precio / 5), productos_incluidos: this.productosEdit()
      }).eq('id', data.id);
      this.cerrarModificar();
      await this.state.cargarCombos();
      await this.state.registrarAccion('UPDATE_COMBO');
    } else if (this.productosEdit().length === 0) {
      alert('Debes agregar al menos un producto al combo.');
    }
  }
  /**
   * Elimina un combo permanentemente de la base de datos.
   */
  async eliminar(id: string) {
    if (confirm("¿Estás seguro de que deseas eliminar este combo permanentemente?")) {
      const { error } = await this.supabase.client.from('candy_products').delete().eq('id', id);
      if (error) {
        alert("Error al eliminar el combo: " + error.message);
      } else {
        await this.state.cargarCombos();
        await this.state.registrarAccion('DELETE_COMBO');
      }
    }
  }
}
