import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../../core/services/supabase.service';
import { CombosStateService } from '../../services/combos-state.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-gc-crear-producto',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './gc-crear-producto.html'
})
export class GcCrearProductoComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private state = inject(CombosStateService);
  private router = inject(Router);

  productoForm = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    categoria: ['Comida', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    imagen_url: ['']
  });

  async onSubmit() {
    if (this.productoForm.valid) {
      const f = this.productoForm.getRawValue();
      const producto = {
        nombre: f.nombre,
        categoria: f.categoria,
        precio: f.precio,
        costo_puntos: Math.floor(f.precio / 5),
        imagen_url: f.imagen_url,
        productos_incluidos: null
      };
      await this.supabase.insertData('candy_products', producto);
      await this.state.cargarCombos();
      await this.state.registrarAccion('CREATE_CANDY_PRODUCT');
      this.router.navigate(['/admin/combos/menu']);
    }
  }
}
