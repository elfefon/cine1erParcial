# Cine UTN - Sistema de Gestión de Cine

Sistema completo de venta de entradas, reservas de butacas, carrito de Candy Bar y panel administrativo para un cine.

## Requisitos

- Node.js v18+
- Angular CLI v17+
- Proyecto en Supabase

## Instalación

1. Clonar el repositorio.
2. Ejecutar \`npm install\` para instalar las dependencias.

## Configuración de Variables de Entorno

Crear el archivo \`src/environments/environment.development.ts\` y \`src/environments/environment.ts\` basándote en la siguiente estructura:

\`\`\`typescript
export const environment = {
  production: false,
  supabaseUrl: 'TU_SUPABASE_URL',
  supabaseKey: 'TU_SUPABASE_ANON_KEY',
  tmdbKey: 'TU_TMDB_API_KEY' // Si utilizas una API de terceros, mantenela segura
};
\`\`\`

## Levantar la Aplicación

Para desarrollo:
\`\`\`bash
npm start
# o
ng serve
\`\`\`
La aplicación estará disponible en \`http://localhost:4200/\`.

## Base de Datos (Supabase)

La base de datos utiliza Supabase (PostgreSQL).
Toda la estructura, tablas y políticas RLS ya se encuentran configuradas en el proyecto de Supabase vinculado, por lo que no es necesario ejecutar migraciones de forma local.

## Roles de Usuario

El sistema cuenta con los siguientes roles, definidos en la tabla \`profiles\`:
- \`cliente\`: Usuario estándar que puede comprar entradas y candy.
- \`empleado\`: Puede escanear QR de entradas.
- \`gerente\`: Puede ver y gestionar las carteleras y combos.
- \`admin\`: Acceso total al sistema.

## Credenciales de Prueba

Si configuraste los datos iniciales, puedes usar estos usuarios para probar:
- **Admin**: admin@cineutn.com / admin123
- **Gerente**: gerente@cineutn.com / gerente123
- **Empleado**: empleado@cineutn.com / empleado123
- **Cliente**: cliente@cineutn.com / cliente123
