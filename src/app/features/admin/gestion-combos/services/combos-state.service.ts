import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { Combo } from '../../../../models/combo.interface';

@Injectable({
  providedIn: 'root'
})
export class CombosStateService {
  private supabase = inject(SupabaseService);

  combos = signal<Combo[]>([]);
  productos = signal<any[]>([]);

  constructor() {
    this.cargarCombos();
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

  async registrarAccion(tipo: string) {
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
