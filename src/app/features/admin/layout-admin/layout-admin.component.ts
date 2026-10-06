import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-layout-admin',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './layout-admin.component.html',
  styleUrl: './layout-admin.component.css'
})
export class LayoutAdminComponent {
  authService = inject(AuthService);
  private router = inject(Router);

  async logout() {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }
}
