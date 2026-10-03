import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

// Validador personalizado para edad (mínima y máxima)
export function edadRangoValidator(edadMinima: number, edadMaxima: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    
    const fechaNacimiento = new Date(control.value);
    const hoy = new Date();
    
    let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const m = hoy.getMonth() - fechaNacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
      edad--;
    }
    
    if (edad < edadMinima || edad > edadMaxima) return { edadInvalida: true };
    return null;
  };
}

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css'
})
export class RegistroComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  dias = Array.from({length: 31}, (_, i) => i + 1);
  meses = Array.from({length: 12}, (_, i) => i + 1);
  anios = Array.from({length: 100}, (_, i) => new Date().getFullYear() - 10 - i); // 10 to 110 years ago

  registroForm = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(30)]],
    nacimiento_dia: ['', Validators.required],
    nacimiento_mes: ['', Validators.required],
    nacimiento_anio: ['', Validators.required],
    tipo_sangre: ['', Validators.required],
    color_ojos: ['', Validators.required],
    vacaciones_anuales: ['', [Validators.required, Validators.min(0), Validators.max(365)]]
  });

  error: string | null = null;

  async onSubmit() {
    if (this.registroForm.valid) {
      try {
        this.error = null;
        const formValue = this.registroForm.getRawValue();
        const { email, password, nombre, tipo_sangre, color_ojos, vacaciones_anuales } = formValue;
        
        // Armar fecha y validar edad
        const fecha_nacimiento = `${formValue.nacimiento_anio}-${String(formValue.nacimiento_mes).padStart(2, '0')}-${String(formValue.nacimiento_dia).padStart(2, '0')}`;
        const fechaObj = new Date(fecha_nacimiento);
        if (isNaN(fechaObj.getTime())) {
          this.error = 'Fecha de nacimiento inválida.';
          return;
        }

        const hoy = new Date();
        let edad = hoy.getFullYear() - fechaObj.getFullYear();
        if (hoy.getMonth() < fechaObj.getMonth() || (hoy.getMonth() === fechaObj.getMonth() && hoy.getDate() < fechaObj.getDate())) {
          edad--;
        }

        if (edad < 10 || edad > 100) {
          this.error = 'Debes tener entre 10 y 100 años para registrarte.';
          return;
        }

        console.log(`Intentando registrar usuario: ${nombre} - Email: ${email}`);

        await this.authService.signUp(email, password, nombre, fecha_nacimiento, tipo_sangre, color_ojos, vacaciones_anuales);

        console.log(`¡Usuario registrado exitosamente!: ${nombre} - Email: ${email}`);
        this.router.navigate(['/']);
      } catch (err: any) {
        console.error('Error arrojado por Supabase al registrar:', err);
        if (err.message === 'User already registered') {
          this.error = 'El correo electrónico ya está registrado. Por favor, iniciá sesión.';
        } else if (err.message?.includes('Password should be')) {
          this.error = 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
        } else if (err.message?.includes('out of range')) {
          this.error = 'Uno de los números ingresados es demasiado grande.';
        } else {
          this.error = 'Ocurrió un error al registrarse: ' + (err.message || 'Error desconocido.');
        }
      }
    } else {
      console.log('El formulario es inválido y no se enviará. Revisa los campos y las validaciones.');
    }
  }
}
