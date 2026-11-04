-- =============================================================================
-- MIGRACIÓN SQL: NUEVOS REQUERIMIENTOS DEL CLIENTE ("EMPRESARIO IMPORTANTE")
-- =============================================================================

-- 1. PROPUESTAS DE PELÍCULAS POR CLIENTES (máx. 1 pendiente por usuario)
CREATE TABLE IF NOT EXISTS public.movie_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text NOT NULL,
  motivo text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único parcial: garantiza a nivel base de datos que cada cliente solo pueda tener 1 propuesta pendiente a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_proposal_per_user
  ON public.movie_proposals (user_id)
  WHERE (estado = 'pendiente');

-- 2. ROLES CONFIGURABLES CON PERMISOS POR SECCIÓN DEL PANEL DE ADMINISTRACIÓN
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  descripcion text NOT NULL DEFAULT '',
  permisos text[] NOT NULL DEFAULT '{}',
  es_sistema boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Permitir roles personalizados en profiles.role si existiera un constraint restrictivo previo
DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. LISTA DE ESPERA PARA FUNCIONES AGOTADAS (CON VENTANA DE 15 MINUTOS)
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  showtime_id uuid NOT NULL REFERENCES public.showtimes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'en_espera' CHECK (estado IN ('en_espera', 'notificado', 'expirado', 'comprado', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  notificado_at timestamptz,
  expira_at timestamptz
);

-- 4. NOTIFICACIONES A USUARIOS (WAITLIST 15 MIN, CANCELACIÓN DE FUNCIÓN Y REUBICACIÓN, PROPUESTAS)
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  mensaje text NOT NULL,
  leida boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. FUNCIÓN RPC: ROTAR EXPIRADOS Y NOTIFICAR AL SIGUIENTE EN LA LISTA DE ESPERA (15 MINUTOS)
CREATE OR REPLACE FUNCTION public.notificar_siguiente_waitlist(p_showtime_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actual record;
  v_siguiente record;
  v_pelicula_nombre text;
  v_movie_id uuid;
  v_expira timestamptz;
BEGIN
  -- 1. Expirar turnos cuya ventana de 15 minutos haya vencido
  UPDATE public.waitlist_entries
  SET estado = 'expirado'
  WHERE showtime_id = p_showtime_id
    AND estado = 'notificado'
    AND expira_at IS NOT NULL
    AND expira_at <= now();

  -- 2. Si todavía hay alguien con ventana activa de 15 min, mantener su prioridad
  SELECT * INTO v_actual
  FROM public.waitlist_entries
  WHERE showtime_id = p_showtime_id
    AND estado = 'notificado'
    AND expira_at > now()
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'user_id', v_actual.user_id, 'ya_notificado', true);
  END IF;

  -- 3. Tomar al primero en 'en_espera' por orden de llegada (FIFO)
  SELECT * INTO v_siguiente
  FROM public.waitlist_entries
  WHERE showtime_id = p_showtime_id
    AND estado = 'en_espera'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'user_id', null);
  END IF;

  v_expira := now() + interval '15 minutes';

  UPDATE public.waitlist_entries
  SET estado = 'notificado',
      notificado_at = now(),
      expira_at = v_expira
  WHERE id = v_siguiente.id;

  SELECT m.nombre, s.movie_id
  INTO v_pelicula_nombre, v_movie_id
  FROM public.showtimes s
  LEFT JOIN public.movies m ON m.id = s.movie_id
  WHERE s.id = p_showtime_id;

  INSERT INTO public.user_notifications (user_id, tipo, mensaje, metadata)
  VALUES (
    v_siguiente.user_id,
    'WAITLIST_TURNO',
    format('🎟️ ¡Se liberaron butacas para "%s"! Estás #1 en la lista de espera: tenés 15 minutos para realizar tu compra antes de que el turno pase al siguiente.', COALESCE(v_pelicula_nombre, 'la función')),
    jsonb_build_object(
      'showtime_id', p_showtime_id,
      'movie_id', v_movie_id,
      'pelicula_nombre', COALESCE(v_pelicula_nombre, 'Película'),
      'expira_at', v_expira
    )
  );

  RETURN jsonb_build_object('ok', true, 'user_id', v_siguiente.user_id, 'expira_at', v_expira);
END;
$$;

-- 6. FUNCIÓN RPC ATÓMICA: CANCELAR FUNCIÓN COMPLETA DESDE ADMIN CON REEMBOLSO TOTAL (ENTRADAS + CANDY) Y REUBICACIÓN
CREATE OR REPLACE FUNCTION public.cancelar_funcion_admin(
  p_showtime_id uuid,
  p_motivo text DEFAULT 'Problema técnico en la sala'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_showtime record;
  v_pelicula_nombre text;
  v_sala_nombre text;
  v_ticket record;
  v_monto_candy numeric;
  v_monto_butacas numeric;
  v_monto_reembolso numeric;
  v_afectados int := 0;
BEGIN
  -- Todo ocurre dentro de la misma transacción PostgreSQL (atómica: o se acredita a todos o hace ROLLBACK completo)
  SELECT s.*, m.nombre AS movie_nombre, r.nombre AS room_nombre
  INTO v_showtime
  FROM public.showtimes s
  LEFT JOIN public.movies m ON m.id = s.movie_id
  LEFT JOIN public.rooms r ON r.id = s.room_id
  WHERE s.id = p_showtime_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la función solicitada.';
  END IF;

  v_pelicula_nombre := COALESCE(v_showtime.movie_nombre, 'la película');
  v_sala_nombre := COALESCE(v_showtime.room_nombre, 'la sala');

  -- Recorrer todos los tickets activos vinculados a esta función
  FOR v_ticket IN
    SELECT DISTINCT t.id, t.user_id, t.total_pagado, t.estado
    FROM public.tickets t
    INNER JOIN public.seat_reservations sr ON sr.ticket_id = t.id
    WHERE sr.showtime_id = p_showtime_id
      AND COALESCE(t.estado, 'activo') <> 'cancelado'
    FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(cantidad * precio_unitario), 0)
    INTO v_monto_candy
    FROM public.ticket_candy_items
    WHERE ticket_id = v_ticket.id;

    SELECT COALESCE(SUM(precio_pagado), 0)
    INTO v_monto_butacas
    FROM public.seat_reservations
    WHERE ticket_id = v_ticket.id;

    v_monto_reembolso := GREATEST(COALESCE(v_ticket.total_pagado, 0), v_monto_butacas + v_monto_candy);

    IF v_ticket.user_id IS NOT NULL AND v_monto_reembolso > 0 THEN
      UPDATE public.profiles
      SET credito_saldo = COALESCE(credito_saldo, 0) + v_monto_reembolso
      WHERE id = v_ticket.user_id;

      INSERT INTO public.user_notifications (user_id, tipo, mensaje, metadata)
      VALUES (
        v_ticket.user_id,
        'FUNCION_CANCELADA',
        format('⚠️ La función de "%s" (%s) fue cancelada por el cine (%s). Se acreditaron $%s (entradas + candy) en tu cuenta. Podés reubicarte en otra función de "%s" usando ese crédito.',
          v_pelicula_nombre, v_sala_nombre, p_motivo, v_monto_reembolso, v_pelicula_nombre),
        jsonb_build_object(
          'movie_id', v_showtime.movie_id,
          'pelicula_nombre', v_pelicula_nombre,
          'monto_acreditado', v_monto_reembolso,
          'motivo', p_motivo,
          'accion', 'REUBICAR_FUNCION'
        )
      );

      v_afectados := v_afectados + 1;
    END IF;

    UPDATE public.tickets
    SET estado = 'cancelado'
    WHERE id = v_ticket.id;
  END LOOP;

  -- Liberar todas las butacas reservadas y bloqueadas de la función
  DELETE FROM public.seat_reservations WHERE showtime_id = p_showtime_id;
  DELETE FROM public.locked_seats WHERE showtime_id = p_showtime_id;
  DELETE FROM public.waitlist_entries WHERE showtime_id = p_showtime_id;

  -- Eliminar la función cancelada
  DELETE FROM public.showtimes WHERE id = p_showtime_id;

  RETURN jsonb_build_object(
    'ok', true,
    'compradores_afectados', v_afectados
  );
END;
$$;
