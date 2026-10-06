-- ==========================================
-- T3.1: RPC VALIDAR QR
-- ==========================================
-- Agregamos las columnas necesarias a tickets si no existen
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS usado_en TIMESTAMP WITH TIME ZONE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS usado_por UUID REFERENCES profiles(id);

CREATE OR REPLACE FUNCTION validar_qr(p_codigo TEXT)
RETURNS JSONB AS $$
DECLARE
  v_ticket RECORD;
  v_result JSONB;
  v_showtime_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- 1. Verificar si el llamador es empleado o admin/gerente
  IF NOT (auth.is_empleado() OR auth.is_admin_or_gerente()) THEN
    RAISE EXCEPTION 'No tienes permiso para validar tickets.';
  END IF;

  -- 2. Obtener el ticket (si existe) y bloquearlo para update
  SELECT * INTO v_ticket FROM tickets WHERE codigo_venta = p_codigo FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found_or_invalid');
  END IF;

  IF v_ticket.estado = 'usado' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_used');
  END IF;

  IF v_ticket.estado = 'cancelado' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'cancelled');
  END IF;

  -- 3. Verificar ventana horaria si es ticket de cine
  -- Si tiene reservas, es de cine. Sino, es de candy.
  SELECT s.fecha_hora INTO v_showtime_time
  FROM seat_reservations sr
  JOIN showtimes s ON sr.showtime_id = s.id
  WHERE sr.ticket_id = v_ticket.id
  LIMIT 1;

  IF v_showtime_time IS NOT NULL THEN
    IF now() < (v_showtime_time - INTERVAL '30 minutes') THEN
       RETURN jsonb_build_object('success', false, 'reason', 'too_early', 'showtime', v_showtime_time);
    END IF;
    IF now() > (v_showtime_time + INTERVAL '60 minutes') THEN
       RETURN jsonb_build_object('success', false, 'reason', 'too_late', 'showtime', v_showtime_time);
    END IF;
  END IF;

  -- 4. Marcar como usado
  UPDATE tickets 
  SET estado = 'usado', usado_en = now(), usado_por = auth.uid()
  WHERE id = v_ticket.id;

  -- 3. Si lo marcó con éxito, devolver los datos necesarios
  -- Para candy_items, podríamos incluirlos, pero lo haremos desde el front o acá.
  -- Mejor mandamos que todo ok y el id.
  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket.id,
    'qr_data', v_ticket.qr_codigo
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
