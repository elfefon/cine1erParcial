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
    
    if (edad < edadMinima) return { edadInvalida: 'min' };
    if (edad > edadMaxima) return { edadInvalida: 'max' };
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

  registroForm = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(30)]],
    fecha_nacimiento: ['', [Validators.required, edadRangoValidator(10, 100)]],
    tipo_sangre: ['', Validators.required],
    color_ojos: ['', Validators.required],
    vacaciones_anuales: ['', [Validators.required, Validators.min(0), Validators.max(365)]]
  });

  error: string | null = null;

  async onSubmit() {
    if (this.registroForm.valid) {
      try {
        this.error = null;
        const { email, password, nombre, fecha_nacimiento, tipo_sangre, color_ojos, vacaciones_anuales } = this.registroForm.getRawValue();
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
