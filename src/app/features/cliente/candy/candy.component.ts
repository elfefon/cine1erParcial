import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CartService } from '../../../core/services/cart.service';

@Component({
  selector: 'app-candy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './candy.component.html',
  styleUrl: './candy.component.css'
})
export class CandyComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private cart = inject(CartService);

  productosRaw = signal<any[]>([]);
  
  filtroBusqueda = signal<string>('');
  filtroCategoria = signal<string>('todos'); // 'todos', 'combo', 'Bebida', 'Snack', etc.

  // Filtros dinámicos basados en los datos (excluyendo "Combo" si está como categoría porque lo manejamos por nombre)
  categoriasDisponibles = computed(() => {
    const cats = new Set(this.productosRaw().map(p => p.categoria));
    cats.delete('Combo'); // We handle combo specifically via name
    return Array.from(cats).filter(c => c);
  });

  async ngOnInit() {
    await this.cargarProductos();
  }

  async cargarProductos() {
    const data = await this.supabase.getTableData<any>('candy_products');
    if (data) {
      this.productosRaw.set(data);
    }
  }

  // Carrusel de Recomendados (Combos)
  combosRecomendados = computed(() => {
    return this.productosRaw().filter(p => p.nombre.toLowerCase().startsWith('combo')).slice(0, 5);
  });

  todosLosCombos = computed(() => {
    return this.productosRaw().filter(p => p.nombre.toLowerCase().startsWith('combo'));
  });

  todosLosProductosIndividuales = computed(() => {
    return this.productosRaw().filter(p => !p.nombre.toLowerCase().startsWith('combo'));
  });

  // Lista general filtrada
  productosFiltrados = computed(() => {
    let filtrados = this.productosRaw();

    const busqueda = this.filtroBusqueda().toLowerCase();
    if (busqueda) {
      filtrados = filtrados.filter(p => p.nombre.toLowerCase().includes(busqueda));
    }

    const cat = this.filtroCategoria();
    if (cat !== 'todos') {
      if (cat === 'combo') {
        filtrados = filtrados.filter(p => p.nombre.toLowerCase().startsWith('combo'));
      } else {
        filtrados = filtrados.filter(p => p.categoria === cat);
      }
    }

    return filtrados;
  });

  seleccionarFiltro(cat: string) {
    this.filtroCategoria.set(cat);
  }

  buscar(event: Event) {
    const el = event.target as HTMLInputElement;
    this.filtroBusqueda.set(el.value);
  }

  agregar(producto: any) {
    if (this.cart.tickets().length === 0) {
      alert('🎟️ ¡Ey! Primero tenés que elegir al menos una entrada de cine antes de pasar por el Candy Bar.');
      return;
    }
    this.cart.addCandy(producto, 1);
  }
}
