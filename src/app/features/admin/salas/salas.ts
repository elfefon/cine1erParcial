import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ToastService } from '../../../core/services/toast';

export interface Sala {
  id: string;
  nombre: string;
  filas: number;
  columnas: number;
  estado: string; // 'activa', 'mantenimiento'
}

@Component({
  selector: 'app-salas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './salas.html',
  styleUrl: './salas.css'
})
export class SalasComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);

  salas = signal<Sala[]>([]);
  loading = signal(true);
  
  showModal = signal(false);
  isEditing = signal(false);
  currentId = signal<string | null>(null);

  salaForm = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(50)]],
    filas: [10, [Validators.required, Validators.min(1), Validators.max(26)]],
    columnas: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
    estado: ['activa', Validators.required]
  });

  async ngOnInit() {
    await this.cargarSalas();
  }

  async cargarSalas() {
    this.loading.set(true);
    const { data, error } = await this.supabase.client
      .from('rooms')
      .select('*')
      .order('nombre');
      
    if (data) {
      this.salas.set(data);
    }
    this.loading.set(false);
  }

  abrirCrear() {
    this.isEditing.set(false);
    this.currentId.set(null);
    this.salaForm.reset({
      nombre: '',
      filas: 10,
      columnas: 10,
      estado: 'activa'
    });
    this.showModal.set(true);
  }

  abrirEditar(sala: Sala) {
    this.isEditing.set(true);
    this.currentId.set(sala.id);
    this.salaForm.patchValue({
      nombre: sala.nombre,
      filas: sala.filas,
      columnas: sala.columnas,
      estado: sala.estado
    });
    this.showModal.set(true);
  }

  cerrarModal() {
    this.showModal.set(false);
  }

  async guardar() {
    if (this.salaForm.invalid) {
      this.salaForm.markAllAsTouched();
      return;
    }

    const val = this.salaForm.getRawValue();
    
    // Check para nombre duplicado
    const nombreNormalizado = val.nombre.trim().toLowerCase();
    const duplicado = this.salas().find(s => 
      s.nombre.toLowerCase() === nombreNormalizado && 
      (!this.isEditing() || s.id !== this.currentId())
    );

    if (duplicado) {
      this.toast.error("Ya existe una sala con ese nombre.");
      return;
    }

    const payload = {
      nombre: val.nombre.trim(),
      filas: val.filas,
      columnas: val.columnas,
      estado: val.estado
    };

    if (this.isEditing() && this.currentId()) {
      const { error } = await this.supabase.client.from('rooms').update(payload).eq('id', this.currentId());
      if (error) {
        this.toast.error("Error al actualizar la sala.");
        console.error(error);
        return;
      } else {
        this.toast.success("Sala actualizada exitosamente.");
      }
    } else {
      const { error } = await this.supabase.client.from('rooms').insert(payload);
      if (error) {
        this.toast.error("Error al crear la sala.");
        console.error(error);
        return;
      } else {
        this.toast.success("Sala creada exitosamente.");
      }
    }

    this.cerrarModal();
    await this.cargarSalas();
  }

  async eliminar() {
    if (!this.currentId()) return;
    
    if (confirm("¿Estás seguro de que deseas eliminar esta sala? Se perderán las butacas configuradas.")) {
      const { error } = await this.supabase.client.from('rooms').delete().eq('id', this.currentId());
      if (error) {
        this.toast.error("Error al eliminar la sala.");
      } else {
        this.toast.success("Sala eliminada exitosamente.");
        this.cerrarModal();
        await this.cargarSalas();
      }
    }
  }
}
