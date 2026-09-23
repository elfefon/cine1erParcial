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
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  error: string | null = null;

  async onSubmit() {
    if (this.registroForm.valid) {
      try {
        this.error = null;
        const { email, password, nombre } = this.registroForm.getRawValue();
        await this.authService.signUp(email, password, nombre);
        this.router.navigate(['/']); 
      } catch (err: any) {
        this.error = err.message || 'Error al registrarse';
      }
    }
  }
}
