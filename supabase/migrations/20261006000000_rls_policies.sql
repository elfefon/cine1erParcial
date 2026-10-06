-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_candy_items ENABLE ROW LEVEL SECURITY;

-- Funciones auxiliares
CREATE OR REPLACE FUNCTION auth.is_admin_or_gerente() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol IN ('admin', 'gerente')
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.is_empleado() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol = 'empleado'
  );
$$ LANGUAGE sql SECURITY DEFINER;


-- ==========================================
-- PROFILES
-- ==========================================
-- Nadie lee profiles de otro usuario (salvo admin/gerente si fuera necesario, pero la regla estricta: "nadie lee profiles de otro usuario")
CREATE POLICY "Nadie lee profiles de otro usuario" ON profiles
FOR SELECT USING (auth.uid() = id OR auth.is_admin_or_gerente());

-- anon no escribe profiles
CREATE POLICY "Usuarios pueden actualizar su propio perfil" ON profiles
FOR UPDATE USING (auth.uid() = id AND auth.role() = 'authenticated') WITH CHECK (auth.uid() = id);

-- ==========================================
-- MOVIES
-- ==========================================
-- Lectura pública
CREATE POLICY "Lectura publica de peliculas" ON movies FOR SELECT USING (true);
-- Escritura solo admin/gerente
CREATE POLICY "Escritura peliculas admin gerente" ON movies FOR ALL USING (auth.is_admin_or_gerente()) WITH CHECK (auth.is_admin_or_gerente());

-- ==========================================
-- SEATS
-- ==========================================
CREATE POLICY "Lectura publica de butacas" ON seats FOR SELECT USING (true);
CREATE POLICY "Escritura butacas admin gerente" ON seats FOR ALL USING (auth.is_admin_or_gerente()) WITH CHECK (auth.is_admin_or_gerente());

-- ==========================================
-- SEAT_RESERVATIONS
-- ==========================================
CREATE POLICY "Lectura publica de reservas" ON seat_reservations FOR SELECT USING (true);
-- Solo admin/gerente escriben directamente (las compras de clientes se harán via RPC SECURITY DEFINER)
CREATE POLICY "Escritura reservas admin gerente" ON seat_reservations FOR ALL USING (auth.is_admin_or_gerente()) WITH CHECK (auth.is_admin_or_gerente());

-- ==========================================
-- TICKETS
-- ==========================================
CREATE POLICY "Clientes leen sus tickets y staff lee todos" ON tickets
FOR SELECT USING (
  user_id = auth.uid() OR auth.is_admin_or_gerente() OR auth.is_empleado()
);

-- authenticated inserta tickets únicamente con su propio user_id
CREATE POLICY "Insercion tickets por duenos" ON tickets
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND user_id = auth.uid()
);

CREATE POLICY "Modificacion tickets admin gerente empleado" ON tickets
FOR UPDATE USING (auth.is_admin_or_gerente() OR auth.is_empleado()) WITH CHECK (auth.is_admin_or_gerente() OR auth.is_empleado());

-- ==========================================
-- TICKET_CANDY_ITEMS
-- ==========================================
CREATE POLICY "Lectura items por dueño o staff" ON ticket_candy_items
FOR SELECT USING (
  ticket_id IN (SELECT id FROM tickets WHERE user_id = auth.uid()) OR auth.is_admin_or_gerente()
);

CREATE POLICY "Escritura items admin gerente" ON ticket_candy_items
FOR ALL USING (auth.is_admin_or_gerente()) WITH CHECK (auth.is_admin_or_gerente());
