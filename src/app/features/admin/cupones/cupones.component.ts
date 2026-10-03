import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';

export interface Coupon {
  id: string;
  codigo: string;
  porcentaje_descuento: number;
  es_primera_compra: boolean;
  edad_minima: number;
  activo: boolean;
  fecha_expiracion: string | null;
}

@Component({
  selector: 'app-cupones',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cupones.component.html',
  styleUrl: './cupones.component.css'
})
export class CuponesComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private fb = inject(FormBuilder);

  cupones = signal<Coupon[]>([]);
  loading = signal(true);
  
  // Modal states
  showModal = signal(false);
  isEditing = signal(false);
  currentId = signal<string | null>(null);

  cuponForm = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    porcentaje_descuento: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
    es_primera_compra: [false],
    edad_minima: [0, [Validators.min(0)]],
    activo: [true],
    fecha_expiracion: ['']
  });

  async ngOnInit() {
    await this.cargarCupones();
    await this.asegurarCuponesPorDefecto();
  }

  async cargarCupones() {
    this.loading.set(true);
    const { data, error } = await this.supabase.client
      .from('coupons')
      .select('*')
      .order('codigo');
      
    if (data) {
      this.cupones.set(data);
    } else {
      console.error('Error fetching coupons', error);
    }
    this.loading.set(false);
  }

  async asegurarCuponesPorDefecto() {
    // Si no hay cupones, podríamos crearlos, pero mejor buscamos si existen por código
    const primeraCompra = this.cupones().find(c => c.codigo === 'BIENVENIDA');
    const mayores65 = this.cupones().find(c => c.codigo === 'MAYORES65');

    let reload = false;

    if (!primeraCompra) {
      await this.supabase.client.from('coupons').insert({
        codigo: 'BIENVENIDA',
        porcentaje_descuento: 20,
        es_primera_compra: true,
        edad_minima: 0,
        activo: true
      });
      reload = true;
    }

    if (!mayores65) {
      await this.supabase.client.from('coupons').insert({
        codigo: 'MAYORES65',
        porcentaje_descuento: 30,
        es_primera_compra: false,
        edad_minima: 65,
        activo: true
      });
      reload = true;
    }

    if (reload) {
      await this.cargarCupones();
    }
  }

  abrirCrear() {
    this.isEditing.set(false);
    this.currentId.set(null);
    this.cuponForm.reset({
      codigo: '',
      porcentaje_descuento: 10,
      es_primera_compra: false,
      edad_minima: 0,
      activo: true,
      fecha_expiracion: ''
    });
    this.showModal.set(true);
  }

  abrirEditar(cupon: Coupon) {
    this.isEditing.set(true);
    this.currentId.set(cupon.id);
    
    // Formatear fecha para el input datetime-local si existe
    let fExp = '';
    if (cupon.fecha_expiracion) {
      const d = new Date(cupon.fecha_expiracion);
      // Ajuste simple para datetime-local (YYYY-MM-DDThh:mm)
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      fExp = d.toISOString().slice(0, 16);
    }

    this.cuponForm.patchValue({
      codigo: cupon.codigo,
      porcentaje_descuento: cupon.porcentaje_descuento,
      es_primera_compra: cupon.es_primera_compra,
      edad_minima: cupon.edad_minima,
      activo: cupon.activo,
      fecha_expiracion: fExp
    });
    this.showModal.set(true);
  }

  cerrarModal() {
    this.showModal.set(false);
  }

  async guardar() {
    if (this.cuponForm.invalid) {
      this.cuponForm.markAllAsTouched();
      return;
    }

    const val = this.cuponForm.getRawValue();
    
    // Validar descuento
    if (val.porcentaje_descuento < 1 || val.porcentaje_descuento > 100) {
      alert("El descuento debe ser entre 1 y 100%");
      return;
    }

    const payload = {
      codigo: val.codigo.toUpperCase().trim(),
      porcentaje_descuento: val.porcentaje_descuento,
      es_primera_compra: val.es_primera_compra,
      edad_minima: val.edad_minima,
      activo: val.activo,
      fecha_expiracion: val.fecha_expiracion ? new Date(val.fecha_expiracion).toISOString() : null
    };

    if (this.isEditing() && this.currentId()) {
      const { error } = await this.supabase.client.from('coupons').update(payload).eq('id', this.currentId());
      if (error) {
        alert("Error al actualizar (quizás el código ya existe).");
        return;
      }
    } else {
      const { error } = await this.supabase.client.from('coupons').insert(payload);
      if (error) {
        alert("Error al crear (quizás el código ya existe).");
        return;
      }
    }

    this.cerrarModal();
    await this.cargarCupones();
  }

  async eliminar() {
    if (!this.currentId()) return;
    
    if (confirm("¿Estás seguro de que deseas eliminar este cupón permanentemente?")) {
      const { error } = await this.supabase.client.from('coupons').delete().eq('id', this.currentId());
      if (error) {
        alert("Error al eliminar el cupón.");
      } else {
        this.cerrarModal();
        await this.cargarCupones();
      }
    }
  }
}
