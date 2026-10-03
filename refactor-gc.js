const fs = require('fs');

const tsPath = (name) => `src/app/features/admin/gestion-combos/components/${name}/${name}.ts`;
const htmlPath = (name) => `src/app/features/admin/gestion-combos/components/${name}/${name}.html`;

// 1. Menu
fs.writeFileSync(tsPath('gc-menu'), `import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-gc-menu',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './gc-menu.html'
})
export class GcMenuComponent {}
`);
fs.writeFileSync(htmlPath('gc-menu'), `<div class="menu-hub">
  <div class="page-header text-center">
    <h2>Gestión de Candy Store</h2>
    <p>Administrá los productos y combos de venta rápida</p>
  </div>

  <div class="hub-grid">
    <div class="hub-card">
      <h3>Productos Individuales</h3>
      <div class="hub-buttons">
        <button routerLink="../crear-producto">Crear</button>
        <button routerLink="../ver-productos">Modificar / Ver</button>
      </div>
    </div>
    <div class="hub-card">
      <h3>Combos Armados</h3>
      <div class="hub-buttons">
        <button routerLink="../crear-combo">Armar Combo</button>
        <button routerLink="../ver-combos">Modificar / Ver</button>
      </div>
    </div>
  </div>
</div>
`);

// 2. Crear Producto
fs.writeFileSync(tsPath('gc-crear-producto'), `import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../core/services/supabase.service';
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
`);
fs.writeFileSync(htmlPath('gc-crear-producto'), `<div class="form-card">
  <h3>Nuevo Producto Individual</h3>
  <form [formGroup]="productoForm" (ngSubmit)="onSubmit()">
    <div class="form-grid">
      <div class="form-group"><label>Nombre del Producto</label><input type="text" formControlName="nombre"></div>
      <div class="form-group">
        <label>Categoría</label>
        <select formControlName="categoria">
          <option value="Comida">Comida (Popcorn, Nachos, etc)</option>
          <option value="Bebida">Bebida</option>
          <option value="Golosina">Golosina</option>
        </select>
      </div>
      <div class="form-group"><label>Precio de Venta ($)</label><input type="number" formControlName="precio"></div>
      <div class="form-group"><label>URL de Imagen</label><input type="text" formControlName="imagen_url"></div>
    </div>
    <button type="submit" class="btn-save" [disabled]="productoForm.invalid">💾 Guardar Producto</button>
  </form>
</div>
`);

// 3. Ver Productos
fs.writeFileSync(tsPath('gc-ver-productos'), `import { Component, inject, signal, computed } from '@angular/core';
import { CombosStateService } from '../../services/combos-state.service';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../core/services/supabase.service';

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
`);
fs.writeFileSync(htmlPath('gc-ver-productos'), `<div class="table-card">
  <h3>Productos Disponibles</h3>
  <input type="text" class="search-bar" placeholder="Buscar producto..." (input)="onBuscar($event)">
  <table class="data-table">
    <thead><tr><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Puntos</th><th>Acciones</th></tr></thead>
    <tbody>
      @for (p of filtrados(); track p.id) {
        <tr>
          <td style="font-weight: 700;">{{ p.nombre }}</td>
          <td><span class="badge">{{ p.categoria }}</span></td>
          <td><span class="price-tag">\${{ p.precio }}</span></td>
          <td>{{ p.costo_puntos }} pts</td>
          <td><button class="btn-modificar" (click)="abrirModificar(p)">Modificar</button></td>
        </tr>
      } @empty {
        <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">No hay productos registrados aún.</td></tr>
      }
    </tbody>
  </table>
</div>

@if (productoEditando()) {
  <div class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Modificar Producto</h3>
        <button class="btn-close" (click)="cerrarModificar()">✕</button>
      </div>
      <form [formGroup]="productoEditForm" (ngSubmit)="guardarModificacion()">
        <div class="form-grid">
          <div class="form-group full-width"><label>Nombre</label><input type="text" formControlName="nombre"></div>
          <div class="form-group"><label>Categoría</label>
            <select formControlName="categoria"><option value="Comida">Comida</option><option value="Bebida">Bebida</option><option value="Golosina">Golosina</option></select>
          </div>
          <div class="form-group"><label>Precio</label><input type="number" formControlName="precio"></div>
          <div class="form-group full-width"><label>URL Imagen</label><input type="text" formControlName="imagen_url"></div>
        </div>
        <div class="modal-actions"><button type="submit" class="btn-save" [disabled]="productoEditForm.invalid">Guardar Cambios</button></div>
      </form>
    </div>
  </div>
}
`);

// 4. Crear Combo
fs.writeFileSync(tsPath('gc-crear-combo'), `import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../core/services/supabase.service';
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
    precio: [0, [Validators.required, Validators.min(0)]]
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

  async onSubmit() {
    if (this.comboForm.valid && this.productosSeleccionados().length > 0) {
      const f = this.comboForm.getRawValue();
      const combo = {
        nombre: f.nombre, categoria: 'Combo', precio: f.precio,
        costo_puntos: Math.floor(f.precio / 5), imagen_url: null, productos_incluidos: this.productosSeleccionados()
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
`);
fs.writeFileSync(htmlPath('gc-crear-combo'), `<div class="form-card">
  <h3>Armar Nuevo Combo</h3>
  <form [formGroup]="comboForm" (ngSubmit)="onSubmit()">
    <div class="form-grid">
      <div class="form-group"><label>Nombre del Combo</label><input type="text" formControlName="nombre"></div>
      <div class="form-group"><label>Precio de Venta ($)</label><input type="number" formControlName="precio"></div>
    </div>

    <div class="combo-builder-grid">
      <div class="cb-panel">
        <h4>Buscar Productos</h4>
        <input type="text" class="search-bar" placeholder="Ej. Pochoclos..." (input)="onBuscar($event)">
        <div class="cb-list">
          @for (p of disponibles(); track p.id) {
            <div class="cb-item" (click)="agregar(p)"><span>{{ p.nombre }}</span><span class="btn-add-mini">+</span></div>
          }
        </div>
      </div>
      <div class="cb-panel cb-selected">
        <h4>Contenido del Combo ({{ productosSeleccionados().length }})</h4>
        <div class="cb-list">
          @for (ps of productosSeleccionados(); track $index) {
            <div class="cb-item"><span>{{ ps.nombre }}</span><span class="btn-remove-mini" (click)="quitar($index)">✕</span></div>
          } @empty {
            <div style="text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 20px;">Combo vacío. Agregá productos.</div>
          }
        </div>
      </div>
    </div>
    <button type="submit" class="btn-save" [disabled]="comboForm.invalid || productosSeleccionados().length === 0">💾 Guardar Combo</button>
  </form>
</div>
`);

// 5. Ver Combos
fs.writeFileSync(tsPath('gc-ver-combos'), `import { Component, inject, signal, computed } from '@angular/core';
import { CombosStateService } from '../../services/combos-state.service';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../core/services/supabase.service';

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
`);
fs.writeFileSync(htmlPath('gc-ver-combos'), `<div class="table-card">
  <h3>Combos Armados</h3>
  <input type="text" class="search-bar" placeholder="Buscar combo..." (input)="onBuscar($event)">
  <table class="data-table">
    <thead><tr><th>Nombre</th><th>Contenido</th><th>Precio</th><th>Acciones</th></tr></thead>
    <tbody>
      @for (c of filtrados(); track c.id) {
        <tr>
          <td style="font-weight: 700;">{{ c.nombre }}</td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">
            @for (item of c.productos_incluidos; track $index) {
              {{ item.nombre }}<span *ngIf="!$last">, </span>
            }
          </td>
          <td><span class="price-tag">\${{ c.precio }}</span></td>
          <td><button class="btn-modificar" (click)="abrirModificar(c)">Modificar</button></td>
        </tr>
      } @empty {
        <tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">No hay combos armados.</td></tr>
      }
    </tbody>
  </table>
</div>

@if (comboEditando()) {
  <div class="modal-overlay">
    <div class="modal-content" style="max-width: 700px;">
      <div class="modal-header">
        <h3>Modificar Combo</h3>
        <button class="btn-close" (click)="cerrarModificar()">✕</button>
      </div>
      <form [formGroup]="comboEditForm" (ngSubmit)="guardarModificacion()">
        <div class="form-grid" style="margin-bottom: 20px;">
          <div class="form-group"><label>Nombre del Combo</label><input type="text" formControlName="nombre"></div>
          <div class="form-group"><label>Precio</label><input type="number" formControlName="precio"></div>
        </div>
        
        <div class="combo-builder-grid">
          <div class="cb-panel">
            <h4>Buscar</h4>
            <input type="text" class="search-bar" style="margin-bottom: 10px;" placeholder="Buscar..." (input)="onBuscarProd($event)">
            <div class="cb-list">
              @for (p of disponibles(); track p.id) {
                <div class="cb-item" (click)="agregar(p)"><span>{{ p.nombre }}</span><span class="btn-add-mini">+</span></div>
              }
            </div>
          </div>
          <div class="cb-panel cb-selected">
            <h4>Contenido ({{ productosEdit().length }})</h4>
            <div class="cb-list">
              @for (ps of productosEdit(); track $index) {
                <div class="cb-item"><span>{{ ps.nombre }}</span><span class="btn-remove-mini" (click)="quitar($index)">✕</span></div>
              }
            </div>
          </div>
        </div>
        <div class="modal-actions" style="margin-top: 20px;"><button type="submit" class="btn-save" [disabled]="comboEditForm.invalid || productosEdit().length === 0">Guardar Cambios</button></div>
      </form>
    </div>
  </div>
}
`);

console.log('Combos Refactored');
