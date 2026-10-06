import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../../core/services/supabase.service';
import { CombosStateService } from '../../services/combos-state.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-gc-crear-combo',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './gc-crear-combo.html'
})
export class GcCrearComboComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  state = inject(CombosStateService);
  private router = inject(Router);

  comboForm = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    descuento_porcentaje: [10, [Validators.required, Validators.min(0), Validators.max(100)]]
  });

  productosSeleccionados = signal<any[]>([]);
  filtro = signal('');

  disponibles = computed(() => {
    const s = this.filtro().toLowerCase();
    if (!s) return this.state.productos();
    return this.state.productos().filter(p => p.nombre.toLowerCase().includes(s));
  });

  onBuscar(e: Event) { this.filtro.set((e.target as HTMLInputElement).value); }

  agregar(p: any) { this.productosSeleccionados.update(l => [...l, p]); }
  quitar(index: number) { this.productosSeleccionados.update(l => { const n = [...l]; n.splice(index, 1); return n; }); }

  precioPartes = computed(() => {
    return this.productosSeleccionados().reduce((sum, p) => sum + (p.precio || 0), 0);
  });

  precioFinal = computed(() => {
    const total = this.precioPartes();
    const descuento = this.comboForm.get('descuento_porcentaje')?.value || 0;
    return Math.floor(total * (1 - descuento / 100));
  });

  async onSubmit() {
    if (this.comboForm.valid && this.productosSeleccionados().length > 0) {
      const f = this.comboForm.getRawValue();
      const precioCalculado = this.precioFinal();
      const combo = {
        nombre: f.nombre, categoria: 'Combo', precio: precioCalculado,
        costo_puntos: Math.floor(precioCalculado / 5), imagen_url: null, productos_incluidos: this.productosSeleccionados()
      };
      await this.supabase.insertData('candy_products', combo);
      await this.state.cargarCombos();
      await this.state.registrarAccion('CREATE_COMBO');
      this.router.navigate(['/admin/combos/menu']);
    } else if (this.productosSeleccionados().length === 0) {
      alert('Debes agregar al menos un producto al combo.');
    }
  }
}
