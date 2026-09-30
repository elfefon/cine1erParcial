import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Combo } from '../../../models/combo.interface';

@Component({
  selector: 'app-gestion-combos',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './gestion-combos.component.html',
  styleUrl: './gestion-combos.component.css'
})
export class GestionCombosComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);

  vistaActual = signal<'menu' | 'crear-producto' | 'ver-productos' | 'modificar-producto' | 'crear-combo' | 'ver-combos' | 'modificar-combo'>('menu');

  combos = signal<Combo[]>([]);
  productos = signal<any[]>([]); // Placeholder for products

  filtroBusqueda = signal<string>('');

  comboForm = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]]
  });

  productosSeleccionados = signal<any[]>([]);
  filtroProductosCombo = signal<string>('');

  productoForm = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    categoria: ['Comida', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    imagen_url: ['']
  });

  comboEditando = signal<any | null>(null);
  comboEditForm = this.fb.nonNullable.group({
    id: [''],
    nombre: ['', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    imagen_url: ['']
  });

  productoEditando = signal<any | null>(null);
  productoEditForm = this.fb.nonNullable.group({
    id: [''],
    nombre: ['', Validators.required],
    categoria: ['Comida', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    imagen_url: ['']
  });

  async ngOnInit() {
    await this.cargarCombos();
  }

  async cargarCombos() {
    const data = await this.supabase.getTableData<any>('candy_products');
    if (data) {
      this.combos.set(data.filter((item: any) => item.categoria === 'Combo'));
      this.productos.set(data.filter((item: any) => item.categoria !== 'Combo'));
    } else {
      this.combos.set([]);
      this.productos.set([]);
    }
  }

  cambiarVista(vista: 'menu' | 'crear-producto' | 'ver-productos' | 'modificar-producto' | 'crear-combo' | 'ver-combos' | 'modificar-combo') {
    this.vistaActual.set(vista);
    this.filtroBusqueda.set(''); // Reset filter
  }

  onBuscar(event: Event) {
    const target = event.target as HTMLInputElement;
    this.filtroBusqueda.set(target.value.toLowerCase());
  }

  get combosFiltrados() {
    if (!this.filtroBusqueda()) return this.combos();
    return this.combos().filter(c =>
      c.nombre?.toLowerCase().includes(this.filtroBusqueda())
    );
  }

  get productosFiltrados() {
    if (!this.filtroBusqueda()) return this.productos();
    return this.productos().filter(p =>
      p.nombre?.toLowerCase().includes(this.filtroBusqueda()) ||
      p.categoria?.toLowerCase().includes(this.filtroBusqueda())
    );
  }

  // Helpers para buscar productos y armar el combo
  onBuscarProductoCombo(event: Event) {
    const target = event.target as HTMLInputElement;
    this.filtroProductosCombo.set(target.value.toLowerCase());
  }

  get productosDisponiblesParaCombo() {
    const filtro = this.filtroProductosCombo();
    if (!filtro) return this.productos();
    return this.productos().filter(p => p.nombre.toLowerCase().includes(filtro));
  }

  agregarProductoACombo(p: any) {
    this.productosSeleccionados.update(lista => [...lista, p]);
  }

  quitarProductoDeCombo(index: number) {
    this.productosSeleccionados.update(lista => {
      const nueva = [...lista];
      nueva.splice(index, 1);
      return nueva;
    });
  }

  async onSubmit() {
    if (this.comboForm.valid && this.productosSeleccionados().length > 0) {
      const formValue = this.comboForm.getRawValue();
      const combo = {
        nombre: formValue.nombre,
        categoria: 'Combo',
        precio: formValue.precio,
        costo_puntos: Math.floor(formValue.precio / 5),
        imagen_url: null,
        productos_incluidos: this.productosSeleccionados()
      };
      await this.supabase.insertData('candy_products', combo);
      this.comboForm.reset({ precio: 0 });
      this.productosSeleccionados.set([]);
      this.filtroProductosCombo.set('');
      await this.cargarCombos();
      await this.registrarAccion('CREATE_COMBO');
      this.cambiarVista('menu');
    } else if (this.productosSeleccionados().length === 0) {
      alert('Debes agregar al menos un producto al combo.');
    }
  }

  async onSubmitProducto() {
    if (this.productoForm.valid) {
      const formValue = this.productoForm.getRawValue();
      const producto = {
        nombre: formValue.nombre,
        categoria: formValue.categoria,
        precio: formValue.precio,
        costo_puntos: Math.floor(formValue.precio / 5),
        imagen_url: formValue.imagen_url,
        productos_incluidos: null // Va vacío/null porque es un producto individual
      };
      console.log('Producto a guardar:', producto);
      await this.supabase.insertData('candy_products', producto);
      this.productoForm.reset({ precio: 0, categoria: 'Comida', imagen_url: '' });
      await this.cargarCombos();
      await this.registrarAccion('CREATE_CANDY_PRODUCT');
      this.cambiarVista('menu');
    }
  }

  // MODIFICACION COMBO
  productosSeleccionadosEdit = signal<any[]>([]);
  filtroProductosComboEdit = signal<string>('');

  onBuscarProductoComboEdit(event: Event) {
    const target = event.target as HTMLInputElement;
    this.filtroProductosComboEdit.set(target.value.toLowerCase());
  }

  get productosDisponiblesParaComboEdit() {
    const filtro = this.filtroProductosComboEdit();
    if (!filtro) return this.productos();
    return this.productos().filter(p => p.nombre.toLowerCase().includes(filtro));
  }

  agregarProductoAComboEdit(p: any) {
    this.productosSeleccionadosEdit.update(lista => [...lista, p]);
  }

  quitarProductoDeComboEdit(index: number) {
    this.productosSeleccionadosEdit.update(lista => {
      const nueva = [...lista];
      nueva.splice(index, 1);
      return nueva;
    });
  }

  abrirModificarCombo(c: any) {
    this.comboEditando.set(c);
    this.productosSeleccionadosEdit.set(c.productos_incluidos || []);
    this.comboEditForm.patchValue({
      id: c.id,
      nombre: c.nombre,
      precio: c.precio
    });
  }

  cerrarModificarCombo() {
    this.comboEditando.set(null);
  }

  async guardarModificacionCombo() {
    if (this.comboEditForm.valid && this.productosSeleccionadosEdit().length > 0) {
      const data = this.comboEditForm.getRawValue();
      await this.supabase.client.from('candy_products').update({
        nombre: data.nombre,
        precio: data.precio,
        costo_puntos: Math.floor(data.precio / 5),
        productos_incluidos: this.productosSeleccionadosEdit()
      }).eq('id', data.id);

      this.cerrarModificarCombo();
      await this.cargarCombos();
      await this.registrarAccion('UPDATE_COMBO');
    } else if (this.productosSeleccionadosEdit().length === 0) {
      alert('Debes agregar al menos un producto al combo.');
    }
  }

  // MODIFICACION PRODUCTO
  abrirModificarProducto(p: any) {
    this.productoEditando.set(p);
    this.productoEditForm.patchValue({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria || 'Comida',
      precio: p.precio,
      imagen_url: p.imagen_url || ''
    });
  }

  cerrarModificarProducto() {
    this.productoEditando.set(null);
  }

  async guardarModificacionProducto() {
    if (this.productoEditForm.valid) {
      const data = this.productoEditForm.getRawValue();
      await this.supabase.client.from('candy_products').update({
        nombre: data.nombre,
        categoria: data.categoria,
        precio: data.precio,
        costo_puntos: Math.floor(data.precio / 5),
        imagen_url: data.imagen_url
      }).eq('id', data.id);

      this.cerrarModificarProducto();
      await this.cargarCombos();
      await this.registrarAccion('UPDATE_CANDY_PRODUCT');
    }
  }

  private async registrarAccion(tipo: string) {
    const user = await this.supabase.auth.getUser();
    if (user.data.user) {
      await this.supabase.insertData('activity_logs', {
        accion: tipo,
        entidad_afectada: 'Candy',
        user_id: user.data.user.id
      });
    }
  }
}
