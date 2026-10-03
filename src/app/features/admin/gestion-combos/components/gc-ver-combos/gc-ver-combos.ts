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

  onBuscarProd(e: Event) { this.filtroProd.set((e.target as HTMLInputElement).value); }
  agregar(p: any) { this.productosEdit.update(l => [...l, p]); }
  quitar(index: number) { this.productosEdit.update(l => { const n = [...l]; n.splice(index, 1); return n; }); }

  abrirModificar(c: any) {
    this.comboEditando.set(c);
    this.productosEdit.set(c.productos_incluidos || []);
    this.comboEditForm.patchValue({ id: c.id, nombre: c.nombre, precio: c.precio });
  }

  cerrarModificar() { this.comboEditando.set(null); }

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
}
