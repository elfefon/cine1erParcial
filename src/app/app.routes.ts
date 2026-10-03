import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegistroComponent } from './features/auth/registro/registro.component';
import { LayoutAdminComponent } from './features/admin/layout-admin/layout-admin.component';
import { GestionPeliculasComponent } from './features/admin/gestion-peliculas/gestion-peliculas.component';
import { GestionCombosComponent } from './features/admin/gestion-combos/gestion-combos.component';
import { HistorialAccionesComponent } from './features/admin/historial-acciones/historial-acciones.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

import { LayoutClienteComponent } from './features/cliente/layout-cliente/layout-cliente.component';
import { CarteleraComponent } from './features/cliente/cartelera/cartelera.component';
import { DetallePeliculaComponent } from './features/cliente/detalle-pelicula/detalle-pelicula.component';
import { ReservaButacasComponent } from './features/cliente/reserva-butacas/reserva-butacas.component';
import { CandyComponent } from './features/cliente/candy/candy.component';
import { CarritoComponent } from './features/cliente/carrito/carrito.component';
import { PerfilUsuarioComponent } from './features/cliente/perfil-usuario/perfil-usuario.component';

import { HomeComponent } from './features/admin/home/home.component';
import { CuponesComponent } from './features/admin/cupones/cupones.component';

import { ProximamenteComponent } from './features/cliente/proximamente/proximamente';
import { MisReservasComponent } from './features/cliente/mis-reservas/mis-reservas.component';
import { DetalleReservaComponent } from './features/cliente/detalle-reserva/detalle-reserva.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },
  {
    path: 'admin',
    component: LayoutAdminComponent,
    canActivate: [authGuard],
    canMatch: [adminGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomeComponent },
      { path: 'peliculas', component: GestionPeliculasComponent },
      { path: 'combos', component: GestionCombosComponent },
      { path: 'historial', component: HistorialAccionesComponent },
      { path: 'cupones', component: CuponesComponent }
    ]
  },
  {
    path: '',
    component: LayoutClienteComponent,
    children: [
      { path: '', redirectTo: 'cartelera', pathMatch: 'full' },
      { path: 'cartelera', component: CarteleraComponent },
      { path: 'proximamente', component: ProximamenteComponent },
      { path: 'pelicula/:id', component: DetallePeliculaComponent },
      { path: 'reserva/:id', component: ReservaButacasComponent },
      { path: 'candy', component: CandyComponent },
      { path: 'carrito', component: CarritoComponent },
      { path: 'mis-reservas', component: MisReservasComponent, canActivate: [authGuard] },
      { path: 'mis-reservas/:id', component: DetalleReservaComponent, canActivate: [authGuard] },
      { path: 'perfil', component: PerfilUsuarioComponent }
    ]
  },
  { path: '**', redirectTo: 'cartelera' }
];
