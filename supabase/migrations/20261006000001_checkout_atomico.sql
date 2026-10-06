-- ==========================================
-- T2.2: UNIQUE CONSTRAINT PARA EVITAR DOBLE BOOKING
-- ==========================================
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
-- ==========================================
-- Evita el doble booking a nivel de la base de datos
ALTER TABLE seat_reservations 
ADD CONSTRAINT unique_showtime_seat UNIQUE (showtime_id, seat_id);

-- ==========================================
-- T2.6: TABLA DE RECUPERACION PARA INVITADOS
-- ==========================================
CREATE TABLE IF NOT EXISTS guest_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  magic_link_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- T4.1: HISTORIAL DE PUNTOS (Dependencia para la compra)
-- ==========================================
CREATE TABLE IF NOT EXISTS puntos_movimientos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('acumulacion', 'canje')),
  delta INTEGER NOT NULL,
  origen TEXT NOT NULL, -- Ej: 'compra', 'canje_candy'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- T4.2: USO DE CUPONES (Dependencia)
-- ==========================================
CREATE TABLE IF NOT EXISTS cupon_usos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cupon_id UUID NOT NULL, -- asumiendo que hay una tabla cupones, no referenciamos fuerte por si no existe aún
  user_id UUID NOT NULL REFERENCES profiles(id),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  descuento_aplicado NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- T2.1, T2.3, T2.7: RPC TRANSACCIONAL DE COMPRA
-- ==========================================

-- Tipo para butacas (pasado como JSON array)
-- Tipo para candy items (pasado como JSON array de {product_id, cantidad, precio_unitario})

CREATE OR REPLACE FUNCTION comprar_checkout(
  p_user_id UUID,
  p_email_invitado TEXT,
  p_tickets JSONB, -- Array de { showtime_id, pelicula_nombre, butacas: [numero_butaca], precioTotal, precioButaca, room_id, id_pelicula }
  p_candy JSONB, -- Array de { product_id, cantidad, precio_unitario }
  p_usa_saldo BOOLEAN,
  p_usa_puntos BOOLEAN,
  p_cupon_codigo TEXT,
  p_idempotency_key TEXT
) RETURNS JSONB AS $$
DECLARE
  v_total_pesos NUMERIC := 0;
  v_total_tickets NUMERIC := 0;
  v_total_candy NUMERIC := 0;
  v_saldo_usado NUMERIC := 0;
  v_saldo_disponible NUMERIC := 0;
  v_puntos_disponibles INTEGER := 0;
  v_puntos_usados INTEGER := 0;
  v_puntos_generados INTEGER := 0;
  v_ticket_id UUID;
  v_main_ticket_id UUID;
  v_tkt_item JSONB;
  v_seat_numero TEXT;
  v_seat_id UUID;
  v_seat_tipo TEXT;
  v_codigo_venta TEXT;
  v_qr_data JSONB;
  v_candy_item JSONB;
  v_ticket_payload JSONB;
  v_magic_token TEXT;
  v_cupon_id UUID;
  v_descuento_cupon NUMERIC := 0;
BEGIN
  -- 1. Idempotency Check
  -- Asumimos que podemos usar un campo "idempotency_key" en tickets o una tabla separada.
  -- Para simplificar, agregaremos una columna idempotency_key a tickets
  -- Si ya existe, retornamos error (o el ticket anterior)
  IF EXISTS (SELECT 1 FROM tickets WHERE idempotency_key = p_idempotency_key) THEN
    RAISE EXCEPTION 'Compra ya procesada (Idempotency Key duplicada).';
  END IF;

  -- 2. Calcular totales
  FOR v_tkt_item IN SELECT * FROM jsonb_array_elements(p_tickets) LOOP
    v_total_tickets := v_total_tickets + (v_tkt_item->>'precioTotal')::NUMERIC;
  END LOOP;
  
  FOR v_candy_item IN SELECT * FROM jsonb_array_elements(p_candy) LOOP
    v_total_candy := v_total_candy + ((v_candy_item->>'precio_unitario')::NUMERIC * (v_candy_item->>'cantidad')::NUMERIC);
  END LOOP;

  v_total_pesos := v_total_tickets + v_total_candy;

  IF v_total_pesos = 0 THEN
    RAISE EXCEPTION 'El carrito esta vacio.';
  END IF;

  IF jsonb_array_length(p_tickets) = 0 AND jsonb_array_length(p_candy) > 0 THEN
    -- Habilitar compra solo-candy.
    -- La logica frontend la puede bloquear, pero aca la permitimos y funciona.
    NULL;
  END IF;

  -- 3. Descuento por Cupon (si existe)
  IF p_cupon_codigo IS NOT NULL AND p_cupon_codigo != '' THEN
  DECLARE
    v_limite_usos INTEGER;
    v_usos_actuales INTEGER;
  BEGIN
    SELECT id, porcentaje_descuento, limite_usos INTO v_cupon_id, v_descuento_cupon, v_limite_usos
    FROM coupons
    WHERE codigo = p_cupon_codigo AND activo = true
      AND (fecha_expiracion IS NULL OR fecha_expiracion >= now());

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cupon invalido o expirado';
    END IF;

    IF v_limite_usos IS NOT NULL THEN
      SELECT count(*) INTO v_usos_actuales FROM cupon_usos WHERE cupon_id = v_cupon_id;
      IF v_usos_actuales >= v_limite_usos THEN
        RAISE EXCEPTION 'Este cupon ha alcanzado su limite de usos';
      END IF;
    END IF;

    -- Aplicar descuento
    v_descuento_cupon := v_total_pesos * (v_descuento_cupon / 100.0);
    v_total_pesos := v_total_pesos - v_descuento_cupon;
  END;
  END IF;

  -- 4. Puntos y Saldo
  IF p_user_id IS NOT NULL THEN
    SELECT credito_saldo, puntos INTO v_saldo_disponible, v_puntos_disponibles
    FROM profiles WHERE id = p_user_id;

    IF p_usa_saldo AND v_saldo_disponible > 0 THEN
      IF v_saldo_disponible >= v_total_pesos THEN
        v_saldo_usado := v_total_pesos;
        v_total_pesos := 0;
      ELSE
        v_saldo_usado := v_saldo_disponible;
        v_total_pesos := v_total_pesos - v_saldo_disponible;
      END IF;
    END IF;

    IF p_usa_puntos AND v_total_pesos > 0 THEN
      IF v_puntos_disponibles >= v_total_pesos THEN
        v_puntos_usados := v_total_pesos; -- 1 punto = 1 peso
        v_total_pesos := 0;
      ELSE
        -- Logica real de consigna: no permite pago parcial con puntos o si permite?
        -- Asumiremos que gasta todo lo necesario. Si no alcanza, lanza error o usa lo que tiene?
        -- El TS decia if(puntos >= total). Si no alcanza, no se usa.
        RAISE EXCEPTION 'Puntos insuficientes para pagar la totalidad restante.';
      END IF;
    END IF;
    
    -- Los puntos se generan sobre la porción de dinero (pesos) que efectivamente pagó, no sobre el saldo ni puntos
    IF v_total_pesos > 0 THEN
      v_puntos_generados := floor(v_total_pesos / 5); -- Costo en puntos = total / 5 ? NO, generacion: "Gana 1 punto por cada 5 pesos gastados".
    END IF;
  ELSE
    -- Invitado
    IF v_total_pesos > 0 THEN
      v_puntos_generados := floor(v_total_pesos / 5);
    END IF;
  END IF;

  -- Generamos un único ticket maestro o múltiples? 
  -- El frontend viejo creaba un ticket por pelicula. Haremos lo mismo para no romper la UI,
  -- pero el candy se asocia al primero.
  
  -- Para simplificar, insertamos Candy asociado al primer ticket si hay tickets,
  -- o a un ticket solo-candy si no hay.

  IF jsonb_array_length(p_tickets) = 0 THEN
    -- COMPRA SOLO CANDY
    v_codigo_venta := 'CANDY-' || extract(epoch from now())::TEXT || '-' || substring(md5(random()::text) from 1 for 6);
    
    v_qr_data := jsonb_build_object(
      'codigo', v_codigo_venta,
      'user_id', p_user_id,
      'email', p_email_invitado,
      'total', v_total_pesos,
      'is_candy_only', true
    );

    INSERT INTO tickets (user_id, total_pagado, puntos_generados, codigo_venta, qr_codigo, estado, fecha_compra, idempotency_key)
    VALUES (p_user_id, v_total_pesos, v_puntos_generados, v_codigo_venta, v_qr_data, 'valido', now(), p_idempotency_key)
    RETURNING id INTO v_main_ticket_id;

  ELSE
    -- COMPRA CINE
    FOR v_tkt_item IN SELECT * FROM jsonb_array_elements(p_tickets) LOOP
      v_codigo_venta := 'TKT-' || extract(epoch from now())::TEXT || '-' || substring(md5(random()::text) from 1 for 6);
      
      -- Proporcionalizamos pagos para el ticket
      v_qr_data := jsonb_build_object(
        'codigo', v_codigo_venta,
        'user_id', p_user_id,
        'email', p_email_invitado,
        'showtime_id', v_tkt_item->>'showtime_id',
        'seats', v_tkt_item->'butacas',
        'total', v_tkt_item->>'precioTotal'
      );

      -- Si es el primer ticket, le asignamos el candy al total y usamos el id
      IF v_main_ticket_id IS NULL THEN
        INSERT INTO tickets (user_id, total_pagado, puntos_generados, codigo_venta, qr_codigo, estado, fecha_compra, idempotency_key)
        VALUES (p_user_id, v_total_pesos, v_puntos_generados, v_codigo_venta, v_qr_data, 'valido', now(), p_idempotency_key)
        RETURNING id INTO v_main_ticket_id;
        v_ticket_id := v_main_ticket_id;
      ELSE
        -- Los tickets secundarios quedan con 0 pesos total pagado ya que todo se agrupo en el principal
        -- O se podría prorratear. Lo dejamos en 0 para no duplicar ventas
        INSERT INTO tickets (user_id, total_pagado, puntos_generados, codigo_venta, qr_codigo, estado, fecha_compra, idempotency_key)
        VALUES (p_user_id, 0, 0, v_codigo_venta, v_qr_data, 'valido', now(), p_idempotency_key || '-' || (v_tkt_item->>'showtime_id'))
        RETURNING id INTO v_ticket_id;
      END IF;

      -- Reservar butacas
      FOR v_seat_numero IN SELECT * FROM jsonb_array_elements_text(v_tkt_item->'butacas') LOOP
        SELECT id, tipo_butaca INTO v_seat_id, v_seat_tipo
        FROM seats 
        WHERE room_id = (v_tkt_item->>'room_id')::UUID AND numero_butaca = v_seat_numero;

        IF v_seat_id IS NULL THEN
          RAISE EXCEPTION 'Butaca % no encontrada en sala %', v_seat_numero, v_tkt_item->>'room_id';
        END IF;

        -- Esto fallará si el constraint unique_showtime_seat falla (doble booking)
        INSERT INTO seat_reservations (showtime_id, ticket_id, seat_id, tipo_butaca, precio_pagado)
        VALUES ((v_tkt_item->>'showtime_id')::UUID, v_ticket_id, v_seat_id, v_seat_tipo, (v_tkt_item->>'precioButaca')::NUMERIC);
      END LOOP;

      -- Actualizar ventas pelicula
      UPDATE movies 
      SET ventas_totales = COALESCE(ventas_totales, 0) + jsonb_array_length(v_tkt_item->'butacas')
      WHERE id = (v_tkt_item->>'id_pelicula')::UUID;
    END LOOP;
  END IF;

  -- 5. Insertar Candy
  FOR v_candy_item IN SELECT * FROM jsonb_array_elements(p_candy) LOOP
    INSERT INTO ticket_candy_items (ticket_id, product_id, cantidad, precio_unitario)
    VALUES (v_main_ticket_id, (v_candy_item->>'product_id')::UUID, (v_candy_item->>'cantidad')::INTEGER, (v_candy_item->>'precio_unitario')::NUMERIC);
  END LOOP;

  -- 6. Actualizar Profiles
  IF p_user_id IS NOT NULL THEN
    IF v_saldo_usado > 0 THEN
      UPDATE profiles SET credito_saldo = credito_saldo - v_saldo_usado WHERE id = p_user_id;
    END IF;
    
    IF v_puntos_usados > 0 THEN
      UPDATE profiles SET puntos = puntos - v_puntos_usados WHERE id = p_user_id;
      INSERT INTO puntos_movimientos (user_id, tipo, delta, origen) VALUES (p_user_id, 'canje', -v_puntos_usados, 'compra');
    END IF;

    IF v_puntos_generados > 0 THEN
      UPDATE profiles SET puntos = puntos + v_puntos_generados WHERE id = p_user_id;
      INSERT INTO puntos_movimientos (user_id, tipo, delta, origen) VALUES (p_user_id, 'acumulacion', v_puntos_generados, 'compra');
    END IF;

    IF v_cupon_id IS NOT NULL THEN
      INSERT INTO cupon_usos (cupon_id, user_id, ticket_id, descuento_aplicado)
      VALUES (v_cupon_id, p_user_id, v_main_ticket_id, v_descuento_cupon);
    END IF;
  ELSE
    -- Guardar la recovery de invitado
    v_magic_token := substring(md5(random()::text) from 1 for 16);
    INSERT INTO guest_purchases (email, ticket_id, magic_link_token)
    VALUES (p_email_invitado, v_main_ticket_id, v_magic_token);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'main_ticket_id', v_main_ticket_id,
    'magic_token', v_magic_token
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
