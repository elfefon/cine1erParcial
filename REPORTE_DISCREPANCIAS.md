# Reporte de Discrepancias y Tareas Pendientes (Modo YOLO)

Tras realizar un escaneo profundo de la base de código actual y cruzarla con los requisitos del mega-prompt, se detectan las siguientes implementaciones parciales o discrepancias:

### 1. Módulo 1: Autenticación, Perfiles y Fidelización
*   **Perfil 'Mis Películas':** Falta crear el dashboard del usuario donde se listen sus tickets/películas, con pósters, historial de canjes, puntaje y opción para calificar (reseñas).
*   **Cancelaciones:** Falta la lógica de cancelar la compra hasta 2 hs antes, acreditando saldo virtual (credito_saldo) y permitir compras anónimas (flujo sin login).
*   **Datepicker nativo:** El formulario de registro aún usa un datepicker nativo `<input type="date">`. Se solicita removerlo por una alternativa de combos o selects.

### 2. Módulo 2: Catálogo, Buscador y Reseñas
*   **Búsqueda:** Falta filtro múltiple por géneros en la vista principal.
*   **Próximamente:** Falta el botón de alerta por email y su flujo.
*   **Reseñas:** Falta renderizar estrellas promedio y permitir crear reseñas post-compra.
*   **Validación de Edad:** Falta bloquear o mostrar modal de tutor al momento de reservar si la clasificación de edad de la película lo exige vs edad del usuario.

### 3. Módulo 3: Motor de Asignación Automática
*   **Asignación Automática:** Actualmente el administrador elige la sala manualmente al crear una función. El requerimiento estricto pide *asignación automática* (el admin da la fecha/hora y el sistema elige qué sala está libre).

### 4. Módulo 4: Flujo de Compra, Butacas y Candy Bar
*   **Cierre de Venta (PDF):** Falta la generación física/descargable del PDF y del código QR único para la entrada.
*   **Supabase Realtime:** Falta suscripción para bloquear las butacas temporalmente en tiempo real cuando otro usuario está en el proceso.

### 5. Módulo 5: Paneles
*   **Panel Empleado:** Falta por completo la vista de escanear/digitar el código para validar la entrada (ticket scanner).
*   **Panel Admin (Reportes):** Falta el Dashboard con gráficos de ventas, facturación y exportación Excel/PDF.

A partir de este diagnóstico, procederé autónomamente a implementar todo lo faltante módulo por módulo, aplicando la regla de No Interferencia con la lógica central que ya funciona correctamente.
