import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './core/services/supabase.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('cin1erParcial');

  private supabase = inject(SupabaseService);

  // 🔹 Si tenés un botón o método en tu componente principal,
  //    puedes llamar a este método para hacer la carga.
  ngOnInit(): void {
    //funcion para poblar peliculas en bdd (usar solo una vez para no duplicar las peliculas en la bdd)
    //this.supabase.poblarBaseDeDatos();

    //funcion para poblar proximos estrenos (usar solo una vez para no duplicar las peliculas en la bdd)
    //this.supabase.poblarProximosEstrenos();
  }
}
