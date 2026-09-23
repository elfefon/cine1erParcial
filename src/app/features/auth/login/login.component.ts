import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  error: string | null = null;

  async onSubmit() {
    if (this.loginForm.valid) {
      try {
        this.error = null;
        const { email, password } = this.loginForm.getRawValue();
        await this.authService.signIn(email, password);
        this.router.navigate(['/']);
      } catch (err: any) {
        this.error = err.message || 'Error al iniciar sesión';
      }
    }
  }
}
