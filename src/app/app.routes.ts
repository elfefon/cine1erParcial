import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegistroComponent } from './features/auth/registro/registro.component';
import { LayoutAdminComponent } from './features/admin/layout-admin/layout-admin.component';
import { GestionPeliculasComponent } from './features/admin/gestion-peliculas/gestion-peliculas.component';
import { GestionCombosComponent } from './features/admin/gestion-combos/gestion-combos.component';
import { HistorialAccionesComponent } from './features/admin/historial-acciones/historial-acciones.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { gerenteGuard } from './core/guards/gerente.guard';

// Subrutas Gestion Peliculas
import { GpMenuComponent } from './features/admin/gestion-peliculas/components/gp-menu/gp-menu';
import { GpCrearPeliculaComponent } from './features/admin/gestion-peliculas/components/gp-crear-pelicula/gp-crear-pelicula';
import { GpVerPeliculasComponent } from './features/admin/gestion-peliculas/components/gp-ver-peliculas/gp-ver-peliculas';
import { GpRecomendacionesComponent } from './features/admin/gestion-peliculas/components/gp-recomendaciones/gp-recomendaciones';
import { GpProximamenteComponent } from './features/admin/gestion-peliculas/components/gp-proximamente/gp-proximamente';
import { GpCrearFuncionComponent } from './features/admin/gestion-peliculas/components/gp-crear-funcion/gp-crear-funcion';
import { GpVerFuncionesComponent } from './features/admin/gestion-peliculas/components/gp-ver-funciones/gp-ver-funciones';

// Subrutas Gestion Combos
import { GcMenuComponent } from './features/admin/gestion-combos/components/gc-menu/gc-menu';
import { GcCrearProductoComponent } from './features/admin/gestion-combos/components/gc-crear-producto/gc-crear-producto';
import { GcVerProductosComponent } from './features/admin/gestion-combos/components/gc-ver-productos/gc-ver-productos';
import { GcCrearComboComponent } from './features/admin/gestion-combos/components/gc-crear-combo/gc-crear-combo';
import { GcVerCombosComponent } from './features/admin/gestion-combos/components/gc-ver-combos/gc-ver-combos';

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

import { ScannerComponent } from './features/empleado/scanner/scanner';
import { CanjesComponent } from './features/cliente/canjes/canjes';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },
  {
    path: 'admin',
    component: LayoutAdminComponent,
    canActivate: [authGuard],
    canMatch: [gerenteGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomeComponent },
      { 
        path: 'peliculas', 
        component: GestionPeliculasComponent,
        children: [
          { path: '', redirectTo: 'menu', pathMatch: 'full' },
          { path: 'menu', component: GpMenuComponent },
          { path: 'crear-pelicula', component: GpCrearPeliculaComponent },
          { path: 'ver-peliculas', component: GpVerPeliculasComponent },
          { path: 'recomendaciones', component: GpRecomendacionesComponent },
          { path: 'proximamente', component: GpProximamenteComponent },
          { path: 'crear-funcion', component: GpCrearFuncionComponent },
          { path: 'ver-funciones', component: GpVerFuncionesComponent }
        ]
      },
      { 
        path: 'combos', 
        component: GestionCombosComponent,
        children: [
          { path: '', redirectTo: 'menu', pathMatch: 'full' },
          { path: 'menu', component: GcMenuComponent },
          { path: 'crear-producto', component: GcCrearProductoComponent },
          { path: 'ver-productos', component: GcVerProductosComponent },
          { path: 'crear-combo', component: GcCrearComboComponent },
          { path: 'ver-combos', component: GcVerCombosComponent }
        ]
      },
      { path: 'historial', component: HistorialAccionesComponent, canMatch: [adminGuard] },
      { path: 'cupones', component: CuponesComponent, canMatch: [adminGuard] }
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
      { path: 'canjes', component: CanjesComponent, canActivate: [authGuard] },
      { path: 'perfil', component: PerfilUsuarioComponent, canActivate: [authGuard] }
    ]
  },
  {
    path: 'empleado/scanner',
    component: ScannerComponent,
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: 'cartelera' }
];
