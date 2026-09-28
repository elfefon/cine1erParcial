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
    precio: [0, [Validators.required, Validators.min(0)]],
    descripcion: ['', Validators.required]
  });

  productoForm = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]]
  });

  async ngOnInit() {
    await this.cargarCombos();
  }

  async cargarCombos() {
    // Currently fetching from candy_products
    const data = await this.supabase.getTableData<Combo>('candy_products');
    this.combos.set(data || []);
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
      c.nombre?.toLowerCase().includes(this.filtroBusqueda()) ||
      c.descripcion?.toLowerCase().includes(this.filtroBusqueda())
    );
  }

  async onSubmit() {
    if (this.comboForm.valid) {
      const combo = this.comboForm.getRawValue();
      await this.supabase.insertData('candy_products', combo);
      this.comboForm.reset({ precio: 0 });
      await this.cargarCombos();
      await this.registrarAccion('CREATE_COMBO');
      this.cambiarVista('menu');
    }
  }

  async onSubmitProducto() {
    if (this.productoForm.valid) {
      const producto = this.productoForm.getRawValue();
      console.log('Producto a guardar:', producto);
      // await this.supabase.insertData('...', producto);
      this.productoForm.reset({ precio: 0 });
      this.cambiarVista('menu');
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
