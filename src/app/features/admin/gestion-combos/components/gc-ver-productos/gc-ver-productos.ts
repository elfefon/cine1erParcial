import { Component, inject, signal, computed } from '@angular/core';
import { CombosStateService } from '../../services/combos-state.service';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../../core/services/supabase.service';

@Component({
  selector: 'app-gc-ver-productos',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './gc-ver-productos.html'
})
export class GcVerProductosComponent {
  state = inject(CombosStateService);
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);

  filtro = signal('');
  
  filtrados = computed(() => {
    const s = this.filtro().toLowerCase();
    if (!s) return this.state.productos();
    return this.state.productos().filter(p => p.nombre.toLowerCase().includes(s) || p.categoria?.toLowerCase().includes(s));
  });

  onBuscar(e: Event) { this.filtro.set((e.target as HTMLInputElement).value); }

  productoEditando = signal<any | null>(null);
  productoEditForm = this.fb.nonNullable.group({
    id: [''], nombre: ['', Validators.required], categoria: ['Comida', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]], imagen_url: ['']
  });

  abrirModificar(p: any) {
    this.productoEditando.set(p);
    this.productoEditForm.patchValue({ id: p.id, nombre: p.nombre, categoria: p.categoria || 'Comida', precio: p.precio, imagen_url: p.imagen_url || '' });
  }

  cerrarModificar() { this.productoEditando.set(null); }

  async guardarModificacion() {
    if (this.productoEditForm.valid) {
      const data = this.productoEditForm.getRawValue();
      await this.supabase.client.from('candy_products').update({
        nombre: data.nombre, categoria: data.categoria, precio: data.precio,
        costo_puntos: Math.floor(data.precio / 5), imagen_url: data.imagen_url
      }).eq('id', data.id);
      this.cerrarModificar();
      await this.state.cargarCombos();
      await this.state.registrarAccion('UPDATE_CANDY_PRODUCT');
    }
  }
}
