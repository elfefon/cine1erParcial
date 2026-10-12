import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { gerenteGuard } from './core/guards/gerente.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'registro',
    loadComponent: () => import('./features/auth/registro/registro.component').then(m => m.RegistroComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/layout-admin/layout-admin.component').then(m => m.LayoutAdminComponent),
    canActivate: [authGuard],
    canMatch: [gerenteGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () => import('./features/admin/home/home.component').then(m => m.HomeComponent)
      },
      { 
        path: 'peliculas', 
        loadComponent: () => import('./features/admin/gestion-peliculas/gestion-peliculas.component').then(m => m.GestionPeliculasComponent),
        children: [
          { path: '', redirectTo: 'menu', pathMatch: 'full' },
          {
            path: 'menu',
            loadComponent: () => import('./features/admin/gestion-peliculas/components/gp-menu/gp-menu').then(m => m.GpMenuComponent)
          },
          {
            path: 'crear-pelicula',
            loadComponent: () => import('./features/admin/gestion-peliculas/components/gp-crear-pelicula/gp-crear-pelicula').then(m => m.GpCrearPeliculaComponent)
          },
          {
            path: 'ver-peliculas',
            loadComponent: () => import('./features/admin/gestion-peliculas/components/gp-ver-peliculas/gp-ver-peliculas').then(m => m.GpVerPeliculasComponent)
          },
          {
            path: 'recomendaciones',
            loadComponent: () => import('./features/admin/gestion-peliculas/components/gp-recomendaciones/gp-recomendaciones').then(m => m.GpRecomendacionesComponent)
          },
          {
            path: 'proximamente',
            loadComponent: () => import('./features/admin/gestion-peliculas/components/gp-proximamente/gp-proximamente').then(m => m.GpProximamenteComponent)
          },
          {
            path: 'crear-funcion',
            loadComponent: () => import('./features/admin/gestion-peliculas/components/gp-crear-funcion/gp-crear-funcion').then(m => m.GpCrearFuncionComponent)
          },
          {
            path: 'ver-funciones',
            loadComponent: () => import('./features/admin/gestion-peliculas/components/gp-ver-funciones/gp-ver-funciones').then(m => m.GpVerFuncionesComponent)
          }
        ]
      },
      { 
        path: 'combos', 
        loadComponent: () => import('./features/admin/gestion-combos/gestion-combos.component').then(m => m.GestionCombosComponent),
        children: [
          { path: '', redirectTo: 'menu', pathMatch: 'full' },
          {
            path: 'menu',
            loadComponent: () => import('./features/admin/gestion-combos/components/gc-menu/gc-menu').then(m => m.GcMenuComponent)
          },
          {
            path: 'crear-producto',
            loadComponent: () => import('./features/admin/gestion-combos/components/gc-crear-producto/gc-crear-producto').then(m => m.GcCrearProductoComponent)
          },
          {
            path: 'ver-productos',
            loadComponent: () => import('./features/admin/gestion-combos/components/gc-ver-productos/gc-ver-productos').then(m => m.GcVerProductosComponent)
          },
          {
            path: 'crear-combo',
            loadComponent: () => import('./features/admin/gestion-combos/components/gc-crear-combo/gc-crear-combo').then(m => m.GcCrearComboComponent)
          },
          {
            path: 'ver-combos',
            loadComponent: () => import('./features/admin/gestion-combos/components/gc-ver-combos/gc-ver-combos').then(m => m.GcVerCombosComponent)
          }
        ]
      },
      {
        path: 'historial',
        loadComponent: () => import('./features/admin/historial-acciones/historial-acciones.component').then(m => m.HistorialAccionesComponent),
        canMatch: [adminGuard]
      },
      {
        path: 'cupones',
        loadComponent: () => import('./features/admin/cupones/cupones.component').then(m => m.CuponesComponent),
        canMatch: [adminGuard]
      },
      {
        path: 'salas',
        loadComponent: () => import('./features/admin/salas/salas').then(m => m.SalasComponent),
        canMatch: [adminGuard]
      }
    ]
  },
  {
    path: '',
    loadComponent: () => import('./features/cliente/layout-cliente/layout-cliente.component').then(m => m.LayoutClienteComponent),
    children: [
      { path: '', redirectTo: 'cartelera', pathMatch: 'full' },
      {
        path: 'cartelera',
        loadComponent: () => import('./features/cliente/cartelera/cartelera.component').then(m => m.CarteleraComponent)
      },
      {
        path: 'proximamente',
        loadComponent: () => import('./features/cliente/proximamente/proximamente').then(m => m.ProximamenteComponent)
      },
      {
        path: 'pelicula/:id',
        loadComponent: () => import('./features/cliente/detalle-pelicula/detalle-pelicula.component').then(m => m.DetallePeliculaComponent)
      },
      {
        path: 'reserva/:id',
        loadComponent: () => import('./features/cliente/reserva-butacas/reserva-butacas.component').then(m => m.ReservaButacasComponent)
      },
      {
        path: 'candy',
        loadComponent: () => import('./features/cliente/candy/candy.component').then(m => m.CandyComponent)
      },
      {
        path: 'carrito',
        loadComponent: () => import('./features/cliente/carrito/carrito.component').then(m => m.CarritoComponent)
      },
      {
        path: 'mis-reservas',
        loadComponent: () => import('./features/cliente/mis-reservas/mis-reservas.component').then(m => m.MisReservasComponent),
        canActivate: [authGuard]
      },
      {
        path: 'mis-reservas/:id',
        loadComponent: () => import('./features/cliente/detalle-reserva/detalle-reserva.component').then(m => m.DetalleReservaComponent),
        canActivate: [authGuard]
      },
      {
        path: 'perfil',
        loadComponent: () => import('./features/cliente/perfil-usuario/perfil-usuario.component').then(m => m.PerfilUsuarioComponent),
        canActivate: [authGuard]
      }
    ]
  },
  {
    path: 'empleado/scanner',
    loadComponent: () => import('./features/empleado/scanner/scanner').then(m => m.ScannerComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: 'cartelera' }
];
