import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css'
})
export class RegistroComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  registroForm = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    fecha_nacimiento: ['', Validators.required],
    tipo_sangre: ['', Validators.required],
    color_ojos: ['', Validators.required],
    vacaciones_anuales: ['', Validators.required]
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
        this.error = err.message || 'Error al registrarse';
      }
    } else {
      console.log('El formulario es inválido y no se enviará. Revisa los campos y las validaciones.');
    }
  }
}
