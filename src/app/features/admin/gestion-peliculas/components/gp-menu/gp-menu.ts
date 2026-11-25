import { Component, OnInit, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PropuestasService } from '../../../../../core/services/propuestas.service';

@Component({
  selector: 'app-gp-menu',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './gp-menu.html'
})
export class GpMenuComponent implements OnInit {
  propuestasService = inject(PropuestasService);

  pendientesCount = computed(() =>
    this.propuestasService.propuestas().filter(p => p.estado === 'pendiente').length
  );

  async ngOnInit() {
    await this.propuestasService.obtenerTodasLasPropuestas();
  }
}
