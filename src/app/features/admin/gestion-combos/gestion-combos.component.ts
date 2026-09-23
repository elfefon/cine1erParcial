import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Combo } from '../../../models/combo.interface';

@Component({
  selector: 'app-gestion-combos',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './gestion-combos.component.html',
  styleUrl: './gestion-combos.component.css'
})
export class GestionCombosComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);

  combos = signal<Combo[]>([]);
  
  comboForm = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    descripcion: ['', Validators.required]
  });

  async ngOnInit() {
    await this.cargarCombos();
  }

  async cargarCombos() {
    const data = await this.supabase.getTableData<Combo>('combos');
    this.combos.set(data);
  }

  async onSubmit() {
    if (this.comboForm.valid) {
      const combo = this.comboForm.getRawValue();
      await this.supabase.insertData('combos', combo);
      this.comboForm.reset({ precio: 0 });
      await this.cargarCombos();
      await this.registrarAccion('CREATE_COMBO');
    }
  }

  private async registrarAccion(tipo: string) {
    const user = await this.supabase.auth.getUser();
    if (user.data.user) {
      await this.supabase.insertData('historial_acciones', {
        tipo,
        administrador: user.data.user.email,
        fecha: new Date().toISOString()
      });
    }
  }
}
